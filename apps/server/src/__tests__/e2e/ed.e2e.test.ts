import {
  RealtimeErrorCode,
  type RealtimeTableCommand,
  RealtimeTableCommandType,
  TableCommandAction,
  TableEventName,
} from "@mix-online/shared";
import { describe, expect, it } from "vitest";
import type { SessionUser } from "../../auth-session";
import { createRealtimeTableService } from "../../realtime/table-service";

const NOW = new Date("2026-02-11T12:00:00.000Z");
const TABLE_ID = "a1b2c3d4-0001-4000-8000-000000000001";
const DEFAULT_REQUEST_ID = "11111111-1111-4111-8111-111111111111";

const createUser = (index: number, walletBalance = 4000): SessionUser => ({
  userId: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
  displayName: `U${index}`,
  walletBalance,
});

type CommandByType<TType extends RealtimeTableCommand["type"]> = Extract<
  RealtimeTableCommand,
  { type: TType }
>;

const createCommand = <TType extends RealtimeTableCommand["type"]>(params: {
  type: TType;
  requestId?: string;
  payload?: Partial<CommandByType<TType>["payload"]>;
}): CommandByType<TType> =>
  ({
    type: params.type,
    requestId: params.requestId ?? DEFAULT_REQUEST_ID,
    sentAt: NOW.toISOString(),
    payload: {
      tableId: TABLE_ID,
      ...(params.payload ?? {}),
    },
  }) as CommandByType<TType>;

describe("E2E 境界値", () => {
  it("ED-11 ヘッズアップでも5bet cap超過のRAISEを拒否する", async () => {
    const service = createRealtimeTableService();
    const user1 = createUser(1);
    const user2 = createUser(2);

    const joined1 = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.JOIN,
        payload: { buyIn: 1000 },
      }),
      user: user1,
      occurredAt: NOW,
    });
    const joined2 = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.JOIN,
        payload: { buyIn: 1000 },
      }),
      user: user2,
      occurredAt: NOW,
    });
    expect(joined1.ok).toBe(true);
    expect(joined2.ok).toBe(true);
    if (!joined1.ok || !joined2.ok) {
      return;
    }

    const joined1Seat = joined1.events[0];
    const joined2Seat = joined2.events[0];
    expect(joined1Seat?.eventName).toBe(TableEventName.SeatStateChangedEvent);
    expect(joined2Seat?.eventName).toBe(TableEventName.SeatStateChangedEvent);
    if (
      !joined1Seat ||
      !joined2Seat ||
      joined1Seat.eventName !== TableEventName.SeatStateChangedEvent ||
      joined2Seat.eventName !== TableEventName.SeatStateChangedEvent
    ) {
      return;
    }

    const seatByUserId = new Map<string, number>();
    seatByUserId.set(user1.userId, joined1Seat.payload.seatNo);
    seatByUserId.set(user2.userId, joined2Seat.payload.seatNo);

    const dealCards3rd = joined2.events.find(
      (event) => event.eventName === TableEventName.DealCards3rdEvent,
    );
    expect(dealCards3rd?.eventName).toBe(TableEventName.DealCards3rdEvent);
    if (
      !dealCards3rd ||
      dealCards3rd.eventName !== TableEventName.DealCards3rdEvent
    ) {
      return;
    }

    const userBySeat = (seatNo: number): SessionUser =>
      seatByUserId.get(user1.userId) === seatNo ? user1 : user2;

    const bringIn = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.BRING_IN },
      }),
      user: userBySeat(dealCards3rd.payload.bringInSeatNo),
      occurredAt: NOW,
    });
    expect(bringIn.ok).toBe(true);
    if (!bringIn.ok) {
      return;
    }
    const bringInEvent = bringIn.events[0];
    expect(bringInEvent?.eventName).toBe(TableEventName.BringInEvent);
    if (
      !bringInEvent ||
      bringInEvent.eventName !== TableEventName.BringInEvent
    ) {
      return;
    }
    let toActSeatNo = bringInEvent.payload.nextToActSeatNo as number;

    const complete = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.COMPLETE },
      }),
      user: userBySeat(toActSeatNo),
      occurredAt: NOW,
    });
    expect(complete.ok).toBe(true);
    if (!complete.ok) {
      return;
    }
    const completeEvent = complete.events[0];
    expect(completeEvent?.eventName).toBe(TableEventName.CompleteEvent);
    if (
      !completeEvent ||
      completeEvent.eventName !== TableEventName.CompleteEvent
    ) {
      return;
    }
    toActSeatNo = completeEvent.payload.nextToActSeatNo as number;

    for (let count = 0; count < 4; count += 1) {
      const raised = await service.executeCommand({
        command: createCommand({
          type: RealtimeTableCommandType.ACT,
          payload: { action: TableCommandAction.RAISE },
        }),
        user: userBySeat(toActSeatNo),
        occurredAt: NOW,
      });
      expect(raised.ok).toBe(true);
      if (!raised.ok) {
        return;
      }
      const raiseEvent = raised.events[0];
      expect(raiseEvent?.eventName).toBe(TableEventName.RaiseEvent);
      if (!raiseEvent || raiseEvent.eventName !== TableEventName.RaiseEvent) {
        return;
      }
      toActSeatNo = raiseEvent.payload.nextToActSeatNo as number;
    }

    const rejected = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.RAISE },
      }),
      user: userBySeat(toActSeatNo),
      occurredAt: NOW,
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.error.code).toBe(RealtimeErrorCode.INVALID_ACTION);
    }
  });
});
