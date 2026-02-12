import {
  RealtimeErrorCode,
  type RealtimeTableCommand,
  RealtimeTableCommandType,
  type RealtimeTableEventMessage,
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

const expectEvent = <TName extends RealtimeTableEventMessage["eventName"]>(
  event: RealtimeTableEventMessage | undefined,
  eventName: TName,
): Extract<RealtimeTableEventMessage, { eventName: TName }> => {
  expect(event?.eventName).toBe(eventName);
  if (!event || event.eventName !== eventName) {
    throw new Error(`${eventName} が見つかりません`);
  }
  return event as Extract<RealtimeTableEventMessage, { eventName: TName }>;
};

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

    const joinEvent = expectEvent(
      join.events[0],
      TableEventName.SeatStateChangedEvent,
    );
    expect(joinEvent.tableSeq).toBe(1);
    expect(joinEvent.payload.previousStatus).toBe(SeatStatus.EMPTY);
    expect(joinEvent.payload.currentStatus).toBe(SeatStatus.ACTIVE);
    expect(joinEvent.payload.reason).toBe(SeatStateChangeReason.JOIN);

    const sitOut = await service.executeCommand({
      command: createCommand({ type: RealtimeTableCommandType.SIT_OUT }),
      user,
      occurredAt: NOW,
    });
    expect(sitOut.ok).toBe(true);
    if (!sitOut.ok) {
      return;
    }
    const sitOutEvent = expectEvent(
      sitOut.events[0],
      TableEventName.SeatStateChangedEvent,
    );
    expect(sitOutEvent.tableSeq).toBe(2);
    expect(sitOutEvent.payload.currentStatus).toBe(SeatStatus.SIT_OUT);
    expect(sitOutEvent.payload.reason).toBe(SeatStateChangeReason.SIT_OUT);

    const back = await service.executeCommand({
      command: createCommand({ type: RealtimeTableCommandType.RETURN }),
      user,
      occurredAt: NOW,
    });
    expect(back.ok).toBe(true);
    if (!back.ok) {
      return;
    }
    const backEvent = expectEvent(
      back.events[0],
      TableEventName.SeatStateChangedEvent,
    );
    expect(backEvent.tableSeq).toBe(3);
    expect(backEvent.payload.currentStatus).toBe(SeatStatus.ACTIVE);
    expect(backEvent.payload.reason).toBe(SeatStateChangeReason.RETURN);

    const leave = await service.executeCommand({
      command: createCommand({ type: RealtimeTableCommandType.LEAVE }),
      user,
      occurredAt: NOW,
    });
    expect(leave.ok).toBe(true);
    if (!leave.ok) {
      return;
    }
    const leaveEvent = expectEvent(
      leave.events[0],
      TableEventName.SeatStateChangedEvent,
    );
    expect(leaveEvent.tableSeq).toBe(4);
    expect(leaveEvent.payload.currentStatus).toBe(SeatStatus.EMPTY);
    expect(leaveEvent.payload.reason).toBe(SeatStateChangeReason.LEAVE);
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

    const postAnte = expectEvent(
      secondJoin.events[2],
      TableEventName.PostAnteEvent,
    );
    expect(postAnte.payload.potAfter).toBe(10);

    const bringIn = expectEvent(
      secondJoin.events[4],
      TableEventName.BringInEvent,
    );
    expect(bringIn.payload.street).toBe("THIRD");
    expect(bringIn.payload.amount).toBe(10);
    expect(bringIn.payload.potAfter).toBe(20);
  });

  it("非手番アクションと toCall あり CHECK を拒否する", async () => {
    const service = createRealtimeTableService();
    const user1 = createUser(1);
    const user2 = createUser(2);

    const joined1 = await service.executeCommand({
      command: createCommand({
        type: "table.join",
        payload: { buyIn: 1000 },
      }),
      user: user1,
      occurredAt: NOW,
    });
    const joined2 = await service.executeCommand({
      command: createCommand({
        type: "table.join",
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

    const joined1Seat = expectEvent(
      joined1.events[0],
      TableEventName.SeatStateChangedEvent,
    ).payload.seatNo;
    const joined2Seat = expectEvent(
      joined2.events[0],
      TableEventName.SeatStateChangedEvent,
    ).payload.seatNo;
    const seatByUserId = new Map<string, number>();
    seatByUserId.set(user1.userId, joined1Seat);
    seatByUserId.set(user2.userId, joined2Seat);

    const bringIn = expectEvent(
      joined2.events.find(
        (event) => event.eventName === TableEventName.BringInEvent,
      ),
      TableEventName.BringInEvent,
    );
    const nextToActSeatNo = bringIn.payload.nextToActSeatNo as number;
    const nonTurnUser =
      seatByUserId.get(user1.userId) === nextToActSeatNo ? user2 : user1;

    const notYourTurn = await service.executeCommand({
      command: createCommand({
        type: "table.act",
        payload: { action: "CALL" },
      }),
      user: nonTurnUser,
      occurredAt: NOW,
    });
    expect(notYourTurn.ok).toBe(false);
    if (!notYourTurn.ok) {
      expect(notYourTurn.error.code).toBe(RealtimeErrorCode.NOT_YOUR_TURN);
    }

    const turnUser = nonTurnUser.userId === user1.userId ? user2 : user1;
    const checkRejected = await service.executeCommand({
      command: createCommand({
        type: "table.act",
        payload: { action: "CHECK" },
      }),
      user: turnUser,
      occurredAt: NOW,
    });
    expect(checkRejected.ok).toBe(false);
    if (!checkRejected.ok) {
      expect(checkRejected.error.code).toBe(RealtimeErrorCode.INVALID_ACTION);
    }
  });

  it("ヘッズアップでは5bet capを超えるRAISEを許可する", async () => {
    const service = createRealtimeTableService();
    const user1 = createUser(1);
    const user2 = createUser(2);

    const joined1 = await service.executeCommand({
      command: createCommand({
        type: "table.join",
        payload: { buyIn: 1000 },
      }),
      user: user1,
      occurredAt: NOW,
    });
    const joined2 = await service.executeCommand({
      command: createCommand({
        type: "table.join",
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

    const joined1Seat = expectEvent(
      joined1.events[0],
      TableEventName.SeatStateChangedEvent,
    ).payload.seatNo;
    const joined2Seat = expectEvent(
      joined2.events[0],
      TableEventName.SeatStateChangedEvent,
    ).payload.seatNo;
    const seatByUserId = new Map<string, number>();
    seatByUserId.set(user1.userId, joined1Seat);
    seatByUserId.set(user2.userId, joined2Seat);

    const bringIn = expectEvent(
      joined2.events.find(
        (event) => event.eventName === TableEventName.BringInEvent,
      ),
      TableEventName.BringInEvent,
    );
    let toActSeatNo = bringIn.payload.nextToActSeatNo as number;

    const userBySeat = (seatNo: number): SessionUser =>
      seatByUserId.get(user1.userId) === seatNo ? user1 : user2;

    const complete = await service.executeCommand({
      command: createCommand({
        type: "table.act",
        payload: { action: "COMPLETE" },
      }),
      user: userBySeat(toActSeatNo),
      occurredAt: NOW,
    });
    expect(complete.ok).toBe(true);
    if (!complete.ok) {
      return;
    }
    toActSeatNo = expectEvent(complete.events[0], TableEventName.CompleteEvent)
      .payload.nextToActSeatNo as number;

    for (let count = 0; count < 5; count += 1) {
      const raised = await service.executeCommand({
        command: createCommand({
          type: "table.act",
          payload: { action: "RAISE" },
        }),
        user: userBySeat(toActSeatNo),
        occurredAt: NOW,
      });
      expect(raised.ok).toBe(true);
      if (!raised.ok) {
        return;
      }
      toActSeatNo = expectEvent(raised.events[0], TableEventName.RaiseEvent)
        .payload.nextToActSeatNo as number;
    }
  });

  it("マルチウェイでは5bet cap超過のRAISEを拒否する", async () => {
    const service = createRealtimeTableService() as unknown as {
      executeCommand: ReturnType<
        typeof createRealtimeTableService
      >["executeCommand"];
      tables: Map<
        string,
        {
          tableId: string;
          status: string;
          seats: Array<{
            seatNo: number;
            status: string;
            userId: string | null;
            displayName: string | null;
            stack: number;
            disconnectStreak: number;
            joinedAt: string | null;
          }>;
          currentHand: {
            handId: string;
            street: string;
            toActSeatNo: number | null;
            streetBetTo: number;
            raiseCount: number;
            potTotal: number;
            players: Array<{
              seatNo: number;
              userId: string;
              displayName: string;
              startStack: number;
              totalContribution: number;
              streetContribution: number;
              cardsUp: unknown[];
              cardsDown: unknown[];
              inHand: boolean;
              allIn: boolean;
              actedThisRound: boolean;
            }>;
          } | null;
        }
      >;
    };

    const user1 = createUser(1);
    const user2 = createUser(2);
    const user3 = createUser(3);

    await service.executeCommand({
      command: createCommand({ type: "table.join", payload: { buyIn: 1000 } }),
      user: user1,
      occurredAt: NOW,
    });
    await service.executeCommand({
      command: createCommand({ type: "table.join", payload: { buyIn: 1000 } }),
      user: user2,
      occurredAt: NOW,
    });

    const table = service.tables.get(TABLE_ID);
    if (!table?.currentHand) {
      throw new Error("テスト用の進行中ハンドが見つかりません。");
    }

    table.seats[2] = {
      seatNo: 3,
      status: SeatStatus.ACTIVE,
      userId: user3.userId,
      displayName: user3.displayName,
      stack: 1000,
      disconnectStreak: 0,
      joinedAt: NOW.toISOString(),
    };
    table.currentHand.players.push({
      seatNo: 3,
      userId: user3.userId,
      displayName: user3.displayName,
      startStack: 1000,
      totalContribution: 20,
      streetContribution: 20,
      cardsUp: [],
      cardsDown: [],
      inHand: true,
      allIn: false,
      actedThisRound: false,
    });
    table.currentHand.toActSeatNo = 3;
    table.currentHand.streetBetTo = 20;
    table.currentHand.raiseCount = 4;

    const rejected = await service.executeCommand({
      command: createCommand({
        type: "table.act",
        payload: { action: "RAISE" },
      }),
      user: user3,
      occurredAt: NOW,
    });

    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.error.code).toBe(RealtimeErrorCode.INVALID_ACTION);
    }
  });
});
