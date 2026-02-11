import {
  RealtimeErrorCode,
  SeatStatus,
  TableEventName,
} from "@mix-online/shared";
import { describe, expect, it } from "vitest";
import type { SessionUser } from "../../auth-session";
import { createRealtimeTableService } from "../../realtime/table-service";

const NOW = new Date("2026-02-11T12:00:00.000Z");
const TABLE_ID = "a1b2c3d4-0001-4000-8000-000000000001";

const createUser = (index: number, walletBalance = 4000): SessionUser => ({
  userId: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
  displayName: `U${index}`,
  walletBalance,
});

const createCommand = (params: {
  type: "table.join" | "table.sitOut" | "table.return" | "table.leave";
  requestId?: string;
  payload?: Record<string, unknown>;
}) => ({
  type: params.type,
  requestId: params.requestId ?? "11111111-1111-4111-8111-111111111111",
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
        type: "table.join",
        payload: { buyIn: 1000 },
      }),
      user,
      occurredAt: NOW,
    });
    expect(join.ok).toBe(true);
    if (!join.ok) {
      return;
    }

    expect(join.event.tableSeq).toBe(1);
    expect(join.event.eventName).toBe(TableEventName.SeatStateChangedEvent);
    expect(join.event.payload.previousStatus).toBe(SeatStatus.EMPTY);
    expect(join.event.payload.currentStatus).toBe(SeatStatus.ACTIVE);
    expect(join.event.payload.reason).toBe("JOIN");

    const sitOut = await service.executeCommand({
      command: createCommand({ type: "table.sitOut" }),
      user,
      occurredAt: NOW,
    });
    expect(sitOut.ok).toBe(true);
    if (!sitOut.ok) {
      return;
    }
    expect(sitOut.event.tableSeq).toBe(2);
    expect(sitOut.event.payload.currentStatus).toBe(SeatStatus.SIT_OUT);
    expect(sitOut.event.payload.reason).toBe("SIT_OUT");

    const back = await service.executeCommand({
      command: createCommand({ type: "table.return" }),
      user,
      occurredAt: NOW,
    });
    expect(back.ok).toBe(true);
    if (!back.ok) {
      return;
    }
    expect(back.event.tableSeq).toBe(3);
    expect(back.event.payload.currentStatus).toBe(SeatStatus.ACTIVE);
    expect(back.event.payload.reason).toBe("RETURN");

    const leave = await service.executeCommand({
      command: createCommand({ type: "table.leave" }),
      user,
      occurredAt: NOW,
    });
    expect(leave.ok).toBe(true);
    if (!leave.ok) {
      return;
    }
    expect(leave.event.tableSeq).toBe(4);
    expect(leave.event.payload.currentStatus).toBe(SeatStatus.EMPTY);
    expect(leave.event.payload.reason).toBe("LEAVE");
  });

  it("buyIn 範囲外を拒否する", async () => {
    const service = createRealtimeTableService();
    const user = createUser(1);

    const result = await service.executeCommand({
      command: createCommand({
        type: "table.join",
        payload: { buyIn: 399 },
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
          type: "table.join",
          payload: { buyIn: 500 },
          requestId: `11111111-1111-4111-8111-${index.toString().padStart(12, "0")}`,
        }),
        user: createUser(index),
        occurredAt: NOW,
      });
      expect(joined.ok).toBe(true);
    }

    const overflow = await service.executeCommand({
      command: createCommand({
        type: "table.join",
        payload: { buyIn: 500 },
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
        type: "table.join",
        payload: { buyIn: 400 },
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
        type: "table.join",
        payload: { buyIn: 500 },
      }),
      user: richUser,
      occurredAt: NOW,
    });
    expect(joined.ok).toBe(true);

    const duplicate = await service2.executeCommand({
      command: createCommand({
        type: "table.join",
        payload: { buyIn: 500 },
      }),
      user: richUser,
      occurredAt: NOW,
    });

    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.error.code).toBe(RealtimeErrorCode.ALREADY_SEATED);
    }
  });
});
