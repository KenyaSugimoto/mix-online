import {
  RealtimeErrorCode,
  type RealtimeTableCommand,
  RealtimeTableCommandType,
  SeatStateChangeReason,
  SeatStatus,
  TableBuyIn,
  TableEventName,
} from "@mix-online/shared";
import { describe, expect, it } from "vitest";
import type { SessionUser } from "../../auth-session";
import { createRealtimeTableService } from "../../realtime/table-service";

const NOW = new Date("2026-02-11T12:00:00.000Z");
const TABLE_ID = "a1b2c3d4-0001-4000-8000-000000000001";
const DEFAULT_REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID_PREFIX = "11111111-1111-4111-8111-";
const BUY_IN_STANDARD = TableBuyIn.MIN + 100;
const BUY_IN_HIGH = TableBuyIn.MIN + 600;

const createUser = (index: number, walletBalance = 4000): SessionUser => ({
  userId: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
  displayName: `U${index}`,
  walletBalance,
});

const createRequestId = (index: number): string =>
  `${REQUEST_ID_PREFIX}${index.toString().padStart(12, "0")}`;

const createCommand = (params: {
  type: RealtimeTableCommandType;
  requestId?: string;
  payload?: Record<string, unknown>;
}): RealtimeTableCommand => ({
  type: params.type,
  requestId: params.requestId ?? DEFAULT_REQUEST_ID,
  sentAt: NOW.toISOString(),
  payload: {
    tableId: TABLE_ID,
    ...(params.payload ?? {}),
  },
});

describe("RealtimeTableService 席管理", () => {
  it("join/sitOut/return/leave の状態遷移を処理できる", async () => {
    const service = createRealtimeTableService();
    const user = createUser(1);

    const join = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.JOIN,
        payload: { buyIn: BUY_IN_HIGH },
      }),
      user,
      occurredAt: NOW,
    });
    expect(join.ok).toBe(true);
    if (!join.ok) {
      return;
    }

    const joinEvent = join.events[0];
    expect(joinEvent?.tableSeq).toBe(1);
    expect(joinEvent?.eventName).toBe(TableEventName.SeatStateChangedEvent);
    expect(joinEvent?.payload.previousStatus).toBe(SeatStatus.EMPTY);
    expect(joinEvent?.payload.currentStatus).toBe(SeatStatus.ACTIVE);
    expect(joinEvent?.payload.reason).toBe(SeatStateChangeReason.JOIN);

    const sitOut = await service.executeCommand({
      command: createCommand({ type: RealtimeTableCommandType.SIT_OUT }),
      user,
      occurredAt: NOW,
    });
    expect(sitOut.ok).toBe(true);
    if (!sitOut.ok) {
      return;
    }
    const sitOutEvent = sitOut.events[0];
    expect(sitOutEvent?.tableSeq).toBe(2);
    expect(sitOutEvent?.payload.currentStatus).toBe(SeatStatus.SIT_OUT);
    expect(sitOutEvent?.payload.reason).toBe(SeatStateChangeReason.SIT_OUT);

    const back = await service.executeCommand({
      command: createCommand({ type: RealtimeTableCommandType.RETURN }),
      user,
      occurredAt: NOW,
    });
    expect(back.ok).toBe(true);
    if (!back.ok) {
      return;
    }
    const backEvent = back.events[0];
    expect(backEvent?.tableSeq).toBe(3);
    expect(backEvent?.payload.currentStatus).toBe(SeatStatus.ACTIVE);
    expect(backEvent?.payload.reason).toBe(SeatStateChangeReason.RETURN);

    const leave = await service.executeCommand({
      command: createCommand({ type: RealtimeTableCommandType.LEAVE }),
      user,
      occurredAt: NOW,
    });
    expect(leave.ok).toBe(true);
    if (!leave.ok) {
      return;
    }
    const leaveEvent = leave.events[0];
    expect(leaveEvent?.tableSeq).toBe(4);
    expect(leaveEvent?.payload.currentStatus).toBe(SeatStatus.EMPTY);
    expect(leaveEvent?.payload.reason).toBe(SeatStateChangeReason.LEAVE);
  });

  it("buyIn 範囲外を拒否する", async () => {
    const service = createRealtimeTableService();
    const user = createUser(1);

    const result = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.JOIN,
        payload: { buyIn: TableBuyIn.MIN - 1 },
      }),
      user,
      occurredAt: NOW,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe(RealtimeErrorCode.BUYIN_OUT_OF_RANGE);
  });

  it("空席がない場合は TABLE_FULL を返す", async () => {
    const service = createRealtimeTableService();

    for (let index = 1; index <= 6; index += 1) {
      const joined = await service.executeCommand({
        command: createCommand({
          type: RealtimeTableCommandType.JOIN,
          payload: { buyIn: BUY_IN_STANDARD },
          requestId: createRequestId(index),
        }),
        user: createUser(index),
        occurredAt: NOW,
      });
      expect(joined.ok).toBe(true);
    }

    const overflow = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.JOIN,
        payload: { buyIn: BUY_IN_STANDARD },
      }),
      user: createUser(7),
      occurredAt: NOW,
    });

    expect(overflow.ok).toBe(false);
    if (overflow.ok) {
      return;
    }
    expect(overflow.error.code).toBe(RealtimeErrorCode.TABLE_FULL);
  });

  it("残高不足と重複着席を拒否する", async () => {
    const service = createRealtimeTableService();
    const user = createUser(1, 300);

    const insufficient = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.JOIN,
        payload: { buyIn: TableBuyIn.MIN },
      }),
      user,
      occurredAt: NOW,
    });
    expect(insufficient.ok).toBe(false);
    if (!insufficient.ok) {
      expect(insufficient.error.code).toBe(
        RealtimeErrorCode.INSUFFICIENT_CHIPS,
      );
    }

    const service2 = createRealtimeTableService();
    const richUser = createUser(2, 4000);
    const joined = await service2.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.JOIN,
        payload: { buyIn: BUY_IN_STANDARD },
      }),
      user: richUser,
      occurredAt: NOW,
    });
    expect(joined.ok).toBe(true);

    const duplicate = await service2.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.JOIN,
        payload: { buyIn: BUY_IN_STANDARD },
      }),
      user: richUser,
      occurredAt: NOW,
    });

    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.error.code).toBe(RealtimeErrorCode.ALREADY_SEATED);
    }
  });

  it("2人目着席で DealInit/PostAnte/DealCards3rd/BringIn を自動発行する", async () => {
    const service = createRealtimeTableService();

    const firstJoin = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.JOIN,
        payload: { buyIn: BUY_IN_HIGH },
      }),
      user: createUser(1),
      occurredAt: NOW,
    });
    expect(firstJoin.ok).toBe(true);

    const secondJoin = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.JOIN,
        payload: { buyIn: BUY_IN_HIGH },
      }),
      user: createUser(2),
      occurredAt: NOW,
    });
    expect(secondJoin.ok).toBe(true);
    if (!secondJoin.ok) {
      return;
    }

    const eventNames = secondJoin.events.map((event) => event.eventName);
    expect(eventNames).toEqual([
      TableEventName.SeatStateChangedEvent,
      TableEventName.DealInitEvent,
      TableEventName.PostAnteEvent,
      TableEventName.DealCards3rdEvent,
      TableEventName.BringInEvent,
    ]);

    expect(secondJoin.events.map((event) => event.tableSeq)).toEqual([
      2, 3, 4, 5, 6,
    ]);
    expect(secondJoin.events[1]?.handSeq).toBe(1);
    expect(secondJoin.events[4]?.handSeq).toBe(4);

    const postAnte = secondJoin.events[2];
    expect(postAnte?.payload.potAfter).toBe(10);

    const bringIn = secondJoin.events[4];
    expect(bringIn?.payload.street).toBe("THIRD");
    expect(bringIn?.payload.amount).toBe(10);
    expect(bringIn?.payload.potAfter).toBe(20);
  });
});
