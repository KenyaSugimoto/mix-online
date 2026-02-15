import {
  DealEndReason,
  RealtimeErrorCode,
  type RealtimeTableCommand,
  RealtimeTableCommandType,
  type RealtimeTableEventMessage,
  SeatStateChangeReason,
  SeatStatus,
  SnapshotReason,
  Street,
  StreetAdvanceReason,
  TableBuyIn,
  TableCommandAction,
  TableEventName,
  TableStatus,
} from "@mix-online/shared";
import { describe, expect, it } from "vitest";
import type { SessionUser } from "../../auth-session";
import {
  TABLE_RESUME_RESULT_KIND,
  TABLE_SNAPSHOT_MESSAGE_TYPE,
  createRealtimeTableService,
} from "../../realtime/table-service";

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

const expectBringInSeatNoFromDeal3rd = (
  events: RealtimeTableEventMessage[],
): number =>
  expectEvent(
    events.find(
      (event) => event.eventName === TableEventName.DealCards3rdEvent,
    ),
    TableEventName.DealCards3rdEvent,
  ).payload.bringInSeatNo;

const toThirdStreetCardSequence = (events: RealtimeTableEventMessage[]) => {
  const dealCards3rd = expectEvent(
    events.find(
      (event) => event.eventName === TableEventName.DealCards3rdEvent,
    ),
    TableEventName.DealCards3rdEvent,
  );
  return dealCards3rd.payload.cards.flatMap((seatCard) =>
    seatCard.cards.map((card) => {
      const value = card.card ? `${card.card.rank}${card.card.suit}` : "null";
      return `${seatCard.seatNo}:${card.position}:${value}`;
    }),
  );
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

  it("2人目着席で DealInit/PostAnte/DealCards3rd を自動発行する", async () => {
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
    ]);

    expect(secondJoin.events.map((event) => event.tableSeq)).toEqual([
      2, 3, 4, 5,
    ]);
    expect(secondJoin.events[1]?.handSeq).toBe(1);
    expect(secondJoin.events[3]?.handSeq).toBe(3);

    const postAnte = expectEvent(
      secondJoin.events[2],
      TableEventName.PostAnteEvent,
    );
    expect(postAnte.payload.potAfter).toBe(10);
    const dealCards3rd = expectEvent(
      secondJoin.events[3],
      TableEventName.DealCards3rdEvent,
    );
    expect(dealCards3rd.payload.street).toBe(Street.THIRD);
    expect(typeof dealCards3rd.payload.bringInSeatNo).toBe("number");
  });

  it("新規ハンド開始時の3rd配札が固定カード列にならない", async () => {
    const startTwoPlayerHand = async (baseUserIndex: number) => {
      const service = createRealtimeTableService();
      const firstJoin = await service.executeCommand({
        command: createCommand({
          type: RealtimeTableCommandType.JOIN,
          payload: { buyIn: BUY_IN_HIGH },
        }),
        user: createUser(baseUserIndex),
        occurredAt: NOW,
      });
      expect(firstJoin.ok).toBe(true);

      const secondJoin = await service.executeCommand({
        command: createCommand({
          type: RealtimeTableCommandType.JOIN,
          payload: { buyIn: BUY_IN_HIGH },
          requestId: createRequestId(baseUserIndex + 1),
        }),
        user: createUser(baseUserIndex + 1),
        occurredAt: NOW,
      });
      expect(secondJoin.ok).toBe(true);
      if (!secondJoin.ok) {
        return [];
      }

      return toThirdStreetCardSequence(secondJoin.events);
    };

    const firstSequence = await startTwoPlayerHand(101);
    const secondSequence = await startTwoPlayerHand(201);

    expect(firstSequence.length).toBe(6);
    expect(secondSequence.length).toBe(6);
    expect(firstSequence).not.toEqual(secondSequence);
  });

  it("非手番アクションと toCall あり CHECK を拒否する", async () => {
    const service = createRealtimeTableService();
    const user1 = createUser(1);
    const user2 = createUser(2);

    // 両ユーザー着席してハンド開始まで進める
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

    // 着席イベントから席番号を取得
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

    // 3rd配札で確定した bring-in 席が最初の手番
    const nextToActSeatNo = expectBringInSeatNoFromDeal3rd(joined2.events);
    const nonTurnUser =
      seatByUserId.get(user1.userId) === nextToActSeatNo ? user2 : user1;

    // 非手番ユーザーが CALL するのを拒否する
    const notYourTurn = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.CALL },
      }),
      user: nonTurnUser,
      occurredAt: NOW,
    });
    expect(notYourTurn.ok).toBe(false);
    if (!notYourTurn.ok) {
      expect(notYourTurn.error.code).toBe(RealtimeErrorCode.NOT_YOUR_TURN);
    }

    // 非手番ユーザーが CHECK するのを拒否する（toCall ありのため）
    const turnUser = nonTurnUser.userId === user1.userId ? user2 : user1;
    const checkRejected = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.CHECK },
      }),
      user: turnUser,
      occurredAt: NOW,
    });
    expect(checkRejected.ok).toBe(false);
    if (!checkRejected.ok) {
      expect(checkRejected.error.code).toBe(RealtimeErrorCode.INVALID_ACTION);
    }
  });

  it("3rd 未アクション局面では BRING_IN/COMPLETE 以外を拒否する", async () => {
    const service = createRealtimeTableService();
    const user1 = createUser(1);
    const user2 = createUser(2);

    // 両ユーザー着席してハンド開始まで進める
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

    // 着席イベントから席番号を取得し、3rd配札の bring-in 席を手番ユーザーとして特定する
    const joined1Seat = expectEvent(
      joined1.events[0],
      TableEventName.SeatStateChangedEvent,
    ).payload.seatNo;
    const actionSeatNo = expectBringInSeatNoFromDeal3rd(joined2.events);
    const turnUser = joined1Seat === actionSeatNo ? user1 : user2;

    const betRejected = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.BET },
      }),
      user: turnUser,
      occurredAt: NOW,
    });
    expect(betRejected.ok).toBe(false);
    if (!betRejected.ok) {
      expect(betRejected.error.code).toBe(RealtimeErrorCode.INVALID_ACTION);
    }

    const callRejected = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.CALL },
      }),
      user: turnUser,
      occurredAt: NOW,
    });
    expect(callRejected.ok).toBe(false);
    if (!callRejected.ok) {
      expect(callRejected.error.code).toBe(RealtimeErrorCode.INVALID_ACTION);
    }

    const bringInAccepted = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.BRING_IN },
      }),
      user: turnUser,
      occurredAt: NOW,
    });
    expect(bringInAccepted.ok).toBe(true);
    if (!bringInAccepted.ok) {
      return;
    }
    expect(bringInAccepted.events[0]?.eventName).toBe(
      TableEventName.BringInEvent,
    );
  });

  it("4th の no-bet 局面では CHECK/BET 以外を拒否し、BET を受理する", async () => {
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
    const userBySeatNo = (seatNo: number): SessionUser =>
      seatByUserId.get(user1.userId) === seatNo ? user1 : user2;

    const bringInSeatNo = expectBringInSeatNoFromDeal3rd(joined2.events);
    const bringInDone = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.BRING_IN },
      }),
      user: userBySeatNo(bringInSeatNo),
      occurredAt: NOW,
    });
    expect(bringInDone.ok).toBe(true);
    if (!bringInDone.ok) {
      return;
    }
    const completeSeatNo = expectEvent(
      bringInDone.events[0],
      TableEventName.BringInEvent,
    ).payload.nextToActSeatNo as number;
    const complete = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.COMPLETE },
      }),
      user: userBySeatNo(completeSeatNo),
      occurredAt: NOW,
    });
    expect(complete.ok).toBe(true);
    if (!complete.ok) {
      return;
    }

    const callSeatNo = expectEvent(
      complete.events[0],
      TableEventName.CompleteEvent,
    ).payload.nextToActSeatNo as number;
    const call = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.CALL },
      }),
      user: userBySeatNo(callSeatNo),
      occurredAt: NOW,
    });
    expect(call.ok).toBe(true);
    if (!call.ok) {
      return;
    }

    const dealCard = expectEvent(
      call.events.find(
        (event) => event.eventName === TableEventName.DealCardEvent,
      ),
      TableEventName.DealCardEvent,
    );
    const fourthToActSeatNo = dealCard.payload.toActSeatNo as number;
    const fourthToActUser = userBySeatNo(fourthToActSeatNo);

    const callRejected = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.CALL },
      }),
      user: fourthToActUser,
      occurredAt: NOW,
    });
    expect(callRejected.ok).toBe(false);
    if (!callRejected.ok) {
      expect(callRejected.error.code).toBe(RealtimeErrorCode.INVALID_ACTION);
    }

    const foldRejected = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.FOLD },
      }),
      user: fourthToActUser,
      occurredAt: NOW,
    });
    expect(foldRejected.ok).toBe(false);
    if (!foldRejected.ok) {
      expect(foldRejected.error.code).toBe(RealtimeErrorCode.INVALID_ACTION);
    }

    const bet = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.BET },
      }),
      user: fourthToActUser,
      occurredAt: NOW,
    });
    expect(bet.ok).toBe(true);
    if (!bet.ok) {
      return;
    }

    const betEvent = expectEvent(bet.events[0], TableEventName.BetEvent);
    expect(betEvent.payload.street).toBe(Street.FOURTH);
    expect(betEvent.payload.amount).toBeGreaterThan(0);
  });

  it("ベッティングラウンド完了で StreetAdvance/DealCard を発行し 4th に進む", async () => {
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

    const userBySeatNo = (seatNo: number): SessionUser =>
      seatByUserId.get(user1.userId) === seatNo ? user1 : user2;

    const bringInSeatNo = expectBringInSeatNoFromDeal3rd(joined2.events);
    const bringInDone = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.BRING_IN },
      }),
      user: userBySeatNo(bringInSeatNo),
      occurredAt: NOW,
    });
    expect(bringInDone.ok).toBe(true);
    if (!bringInDone.ok) {
      return;
    }
    const completeSeatNo = expectEvent(
      bringInDone.events[0],
      TableEventName.BringInEvent,
    ).payload.nextToActSeatNo as number;

    const complete = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.COMPLETE },
      }),
      user: userBySeatNo(completeSeatNo),
      occurredAt: NOW,
    });
    expect(complete.ok).toBe(true);
    if (!complete.ok) {
      return;
    }

    const callSeatNo = expectEvent(
      complete.events[0],
      TableEventName.CompleteEvent,
    ).payload.nextToActSeatNo as number;
    const call = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.CALL },
      }),
      user: userBySeatNo(callSeatNo),
      occurredAt: NOW,
    });
    expect(call.ok).toBe(true);
    if (!call.ok) {
      return;
    }

    expect(call.events[0]?.eventName).toBe(TableEventName.CallEvent);
    const streetAdvance = expectEvent(
      call.events.find(
        (event) => event.eventName === TableEventName.StreetAdvanceEvent,
      ),
      TableEventName.StreetAdvanceEvent,
    );
    expect(streetAdvance.payload.fromStreet).toBe(Street.THIRD);
    expect(streetAdvance.payload.toStreet).toBe(Street.FOURTH);
    expect(streetAdvance.payload.reason).toBe(
      StreetAdvanceReason.BETTING_ROUND_COMPLETE,
    );
    expect(streetAdvance.payload.tableStatus).toBe(TableStatus.BETTING);

    const dealCard = expectEvent(
      call.events.find(
        (event) => event.eventName === TableEventName.DealCardEvent,
      ),
      TableEventName.DealCardEvent,
    );
    expect(dealCard.payload.street).toBe(Street.FOURTH);
    expect(typeof dealCard.payload.toActSeatNo).toBe("number");
    expect(Array.isArray(dealCard.payload.cards)).toBe(true);
    expect(dealCard.payload.cards.length).toBeGreaterThanOrEqual(2);
  });

  it("残り1人で StreetAdvance(HAND_CLOSED) と DealEnd(UNCONTESTED) へ遷移する", async () => {
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

    const bringInSeatNo = expectBringInSeatNoFromDeal3rd(joined2.events);
    const bringInDone = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.BRING_IN },
      }),
      user: seatByUserId.get(user1.userId) === bringInSeatNo ? user1 : user2,
      occurredAt: NOW,
    });
    expect(bringInDone.ok).toBe(true);
    if (!bringInDone.ok) {
      return;
    }
    const foldSeatNo = expectEvent(
      bringInDone.events[0],
      TableEventName.BringInEvent,
    ).payload.nextToActSeatNo as number;
    const foldUser =
      seatByUserId.get(user1.userId) === foldSeatNo ? user1 : user2;

    const folded = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.FOLD },
      }),
      user: foldUser,
      occurredAt: NOW,
    });
    expect(folded.ok).toBe(true);
    if (!folded.ok) {
      return;
    }

    expect(folded.events[0]?.eventName).toBe(TableEventName.FoldEvent);
    const streetAdvance = expectEvent(
      folded.events.find(
        (event) => event.eventName === TableEventName.StreetAdvanceEvent,
      ),
      TableEventName.StreetAdvanceEvent,
    );
    expect(streetAdvance.payload.reason).toBe(StreetAdvanceReason.HAND_CLOSED);
    expect(streetAdvance.payload.tableStatus).toBe(TableStatus.HAND_END);
    expect(streetAdvance.payload.toStreet).toBeNull();

    const dealEnd = expectEvent(
      folded.events.find(
        (event) => event.eventName === TableEventName.DealEndEvent,
      ),
      TableEventName.DealEndEvent,
    );
    expect(dealEnd.payload.endReason).toBe(DealEndReason.UNCONTESTED);
    expect(dealEnd.payload.finalPot).toBeGreaterThan(0);
  });

  it("7th完了時に Showdown と DealEnd(SHOWDOWN) を発行する", async () => {
    const service = createRealtimeTableService() as unknown as {
      executeCommand: ReturnType<
        typeof createRealtimeTableService
      >["executeCommand"];
      executeRevealWaitTimeout: ReturnType<
        typeof createRealtimeTableService
      >["executeRevealWaitTimeout"];
      tables: Map<
        string,
        {
          seats: Array<{
            seatNo: number;
            userId: string | null;
            stack: number;
          }>;
          currentHand: {
            street: string;
            toActSeatNo: number | null;
            streetBetTo: number;
            raiseCount: number;
            players: Array<{
              seatNo: number;
              streetContribution: number;
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

    const table = service.tables.get(TABLE_ID);
    if (!table?.currentHand) {
      throw new Error("進行中ハンドが見つかりません。");
    }

    const firstSeat = table.currentHand.players[0];
    const secondSeat = table.currentHand.players[1];
    if (!firstSeat || !secondSeat) {
      throw new Error("ショーダウン検証用プレイヤーが不足しています。");
    }

    table.currentHand.street = Street.SEVENTH;
    table.currentHand.toActSeatNo = firstSeat.seatNo;
    table.currentHand.streetBetTo = 0;
    table.currentHand.raiseCount = 0;
    firstSeat.streetContribution = 0;
    secondSeat.streetContribution = 0;
    firstSeat.inHand = true;
    secondSeat.inHand = true;
    firstSeat.allIn = false;
    secondSeat.allIn = false;
    firstSeat.actedThisRound = false;
    secondSeat.actedThisRound = true;

    const check = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.CHECK },
      }),
      user:
        table.seats.find((seat) => seat.seatNo === firstSeat.seatNo)?.userId ===
        user1.userId
          ? user1
          : user2,
      occurredAt: NOW,
    });
    expect(check.ok).toBe(true);
    if (!check.ok) {
      return;
    }

    expect(check.events[0]?.eventName).toBe(TableEventName.CheckEvent);
    expect(check.events[1]?.eventName).toBe(TableEventName.StreetAdvanceEvent);
    expect(check.events[2]?.eventName).toBe(TableEventName.ShowdownEvent);
    expect(check.events[3]?.eventName).toBe(TableEventName.DealEndEvent);

    const streetAdvance = expectEvent(
      check.events[1],
      TableEventName.StreetAdvanceEvent,
    );
    expect(streetAdvance.payload.toStreet).toBeNull();
    expect(streetAdvance.payload.tableStatus).toBe(TableStatus.SHOWDOWN);

    const showdown = expectEvent(check.events[2], TableEventName.ShowdownEvent);
    expect(showdown.payload.hasShowdown).toBe(true);
    expect(showdown.payload.players.length).toBeGreaterThanOrEqual(2);
    expect(showdown.payload.potResults.length).toBeGreaterThanOrEqual(1);

    const dealEnd = expectEvent(check.events[3], TableEventName.DealEndEvent);
    expect(dealEnd.payload.endReason).toBe(DealEndReason.SHOWDOWN);
    expect(dealEnd.payload.finalPot).toBeGreaterThan(0);
    expect(
      check.events.some(
        (event) => event.eventName === TableEventName.DealInitEvent,
      ),
    ).toBe(false);

    const revealWaitDone = await service.executeRevealWaitTimeout({
      tableId: TABLE_ID,
      occurredAt: NOW,
    });
    expect(revealWaitDone.ok).toBe(true);
    if (!revealWaitDone.ok) {
      return;
    }
    expect(
      revealWaitDone.events.some(
        (event) => event.eventName === TableEventName.DealInitEvent,
      ),
    ).toBe(true);
  });

  it("ALL_IN_RUNOUT では 5th-7th を自動進行して Showdown/DealEnd する", async () => {
    const service = createRealtimeTableService() as unknown as {
      executeCommand: ReturnType<
        typeof createRealtimeTableService
      >["executeCommand"];
      tables: Map<
        string,
        {
          seats: Array<{
            seatNo: number;
            status: string;
            userId: string | null;
            stack: number;
          }>;
          currentHand: {
            street: string;
            toActSeatNo: number | null;
            streetBetTo: number;
            raiseCount: number;
            players: Array<{
              seatNo: number;
              inHand: boolean;
              allIn: boolean;
              actedThisRound: boolean;
              streetContribution: number;
            }>;
          } | null;
        }
      >;
    };

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

    const table = service.tables.get(TABLE_ID);
    if (!table?.currentHand) {
      throw new Error("進行中ハンドが見つかりません。");
    }

    const actingPlayer = table.currentHand.players[0];
    const waitingPlayer = table.currentHand.players[1];
    if (!actingPlayer || !waitingPlayer) {
      throw new Error("ALL_IN_RUNOUT 検証用プレイヤーが不足しています。");
    }

    const actingSeat = table.seats.find(
      (seat) => seat.seatNo === actingPlayer.seatNo,
    );
    const waitingSeat = table.seats.find(
      (seat) => seat.seatNo === waitingPlayer.seatNo,
    );
    if (!actingSeat || !waitingSeat) {
      throw new Error("対象シートが見つかりません。");
    }

    // 次ハンド自動開始を避け、今回ハンドの進行イベントだけを検証しやすくする。
    waitingSeat.status = SeatStatus.SIT_OUT;

    table.currentHand.street = Street.FOURTH;
    table.currentHand.toActSeatNo = actingPlayer.seatNo;
    table.currentHand.streetBetTo = 20;
    table.currentHand.raiseCount = 0;

    actingPlayer.inHand = true;
    actingPlayer.allIn = false;
    actingPlayer.actedThisRound = false;
    actingPlayer.streetContribution = 0;
    actingSeat.stack = 20;

    waitingPlayer.inHand = true;
    waitingPlayer.allIn = true;
    waitingPlayer.actedThisRound = true;
    waitingPlayer.streetContribution = 20;
    waitingSeat.stack = 0;

    const call = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.CALL },
      }),
      user: actingSeat.userId === user1.userId ? user1 : user2,
      occurredAt: NOW,
    });
    expect(call.ok).toBe(true);
    if (!call.ok) {
      return;
    }

    expect(call.events[0]?.eventName).toBe(TableEventName.CallEvent);

    const streetAdvances = call.events.filter(
      (
        event,
      ): event is Extract<
        RealtimeTableEventMessage,
        { eventName: typeof TableEventName.StreetAdvanceEvent }
      > => event.eventName === TableEventName.StreetAdvanceEvent,
    );
    expect(streetAdvances).toHaveLength(4);
    expect(streetAdvances[0]?.payload.toStreet).toBe(Street.FIFTH);
    expect(streetAdvances[1]?.payload.toStreet).toBe(Street.SIXTH);
    expect(streetAdvances[2]?.payload.toStreet).toBe(Street.SEVENTH);
    expect(streetAdvances[3]?.payload.toStreet).toBeNull();
    expect(streetAdvances[3]?.payload.tableStatus).toBe(TableStatus.SHOWDOWN);
    for (const streetAdvance of streetAdvances) {
      expect(streetAdvance.payload.reason).toBe(
        StreetAdvanceReason.ALL_IN_RUNOUT,
      );
    }

    const dealCards = call.events.filter(
      (
        event,
      ): event is Extract<
        RealtimeTableEventMessage,
        { eventName: typeof TableEventName.DealCardEvent }
      > => event.eventName === TableEventName.DealCardEvent,
    );
    expect(dealCards.map((event) => event.payload.street)).toEqual([
      Street.FIFTH,
      Street.SIXTH,
      Street.SEVENTH,
    ]);
    expect(dealCards.every((event) => event.payload.toActSeatNo === null)).toBe(
      true,
    );

    const showdownIndex = call.events.findIndex(
      (event) => event.eventName === TableEventName.ShowdownEvent,
    );
    const dealEndIndex = call.events.findIndex(
      (event) => event.eventName === TableEventName.DealEndEvent,
    );
    expect(showdownIndex).toBeGreaterThan(0);
    expect(dealEndIndex).toBeGreaterThan(showdownIndex);

    const dealEnd = expectEvent(
      call.events[dealEndIndex],
      TableEventName.DealEndEvent,
    );
    expect(dealEnd.payload.endReason).toBe(DealEndReason.SHOWDOWN);
  });

  it("SEATED_WAIT_NEXT_HAND の席はリビール待機完了後に ACTIVE 化され次ハンドへ参加できる", async () => {
    const service = createRealtimeTableService();
    const user1 = createUser(1);
    const user2 = createUser(2);
    const user3 = createUser(3);

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

    const user1SeatNo = expectEvent(
      joined1.events[0],
      TableEventName.SeatStateChangedEvent,
    ).payload.seatNo;

    const joined3 = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.JOIN,
        payload: { buyIn: 1000 },
      }),
      user: user3,
      occurredAt: NOW,
    });
    expect(joined3.ok).toBe(true);
    if (!joined3.ok) {
      return;
    }
    const joined3SeatEvent = expectEvent(
      joined3.events[0],
      TableEventName.SeatStateChangedEvent,
    );
    expect(joined3SeatEvent.payload.currentStatus).toBe(
      SeatStatus.SEATED_WAIT_NEXT_HAND,
    );
    const joined3SeatNo = joined3SeatEvent.payload.seatNo;

    const bringInSeatNo = expectBringInSeatNoFromDeal3rd(joined2.events);
    const bringInDone = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.BRING_IN },
      }),
      user: user1SeatNo === bringInSeatNo ? user1 : user2,
      occurredAt: NOW,
    });
    expect(bringInDone.ok).toBe(true);
    if (!bringInDone.ok) {
      return;
    }
    const foldSeatNo = expectEvent(
      bringInDone.events[0],
      TableEventName.BringInEvent,
    ).payload.nextToActSeatNo as number;

    const folded = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.FOLD },
      }),
      user: foldSeatNo === user1SeatNo ? user1 : user2,
      occurredAt: NOW,
    });
    expect(folded.ok).toBe(true);
    if (!folded.ok) {
      return;
    }

    expect(
      folded.events.some(
        (event) => event.eventName === TableEventName.SeatStateChangedEvent,
      ),
    ).toBe(false);
    expect(
      folded.events.some(
        (event) => event.eventName === TableEventName.DealInitEvent,
      ),
    ).toBe(false);

    const revealWaitDone = await service.executeRevealWaitTimeout({
      tableId: TABLE_ID,
      occurredAt: NOW,
    });
    expect(revealWaitDone.ok).toBe(true);
    if (!revealWaitDone.ok) {
      return;
    }

    const activatedEvent = revealWaitDone.events.find(
      (
        event,
      ): event is Extract<
        RealtimeTableEventMessage,
        { eventName: typeof TableEventName.SeatStateChangedEvent }
      > =>
        event.eventName === TableEventName.SeatStateChangedEvent &&
        event.payload.reason === SeatStateChangeReason.NEXT_HAND_ACTIVATE &&
        event.payload.seatNo === joined3SeatNo,
    );
    expect(activatedEvent).toBeDefined();
    if (!activatedEvent) {
      return;
    }
    expect(activatedEvent.payload.currentStatus).toBe(SeatStatus.ACTIVE);

    const activatedEventIndex = revealWaitDone.events.findIndex(
      (event) => event === activatedEvent,
    );
    const nextDealInitIndex = revealWaitDone.events.findIndex(
      (event, index) =>
        index > activatedEventIndex &&
        event.eventName === TableEventName.DealInitEvent,
    );
    expect(nextDealInitIndex).toBeGreaterThan(activatedEventIndex);

    const nextDealInit = expectEvent(
      revealWaitDone.events[nextDealInitIndex],
      TableEventName.DealInitEvent,
    );
    expect(
      nextDealInit.payload.participants.some(
        (participant) => participant.seatNo === joined3SeatNo,
      ),
    ).toBe(true);
  });

  it("ハンド終了時に stack=0 の席は AUTO_LEAVE_ZERO_STACK で退席する", async () => {
    const service = createRealtimeTableService() as unknown as {
      executeCommand: ReturnType<
        typeof createRealtimeTableService
      >["executeCommand"];
      executeRevealWaitTimeout: ReturnType<
        typeof createRealtimeTableService
      >["executeRevealWaitTimeout"];
      tables: Map<
        string,
        {
          seats: Array<{
            seatNo: number;
            stack: number;
          }>;
          currentHand: {
            toActSeatNo: number | null;
            players: Array<{
              seatNo: number;
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

    const user1SeatNo = expectEvent(
      joined1.events[0],
      TableEventName.SeatStateChangedEvent,
    ).payload.seatNo;
    const bringInSeatNo = expectBringInSeatNoFromDeal3rd(joined2.events);
    const bringInDone = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.BRING_IN },
      }),
      user: user1SeatNo === bringInSeatNo ? user1 : user2,
      occurredAt: NOW,
    });
    expect(bringInDone.ok).toBe(true);
    if (!bringInDone.ok) {
      return;
    }
    const foldSeatNo = expectEvent(
      bringInDone.events[0],
      TableEventName.BringInEvent,
    ).payload.nextToActSeatNo as number;
    const foldUser = foldSeatNo === user1SeatNo ? user1 : user2;

    const table = service.tables.get(TABLE_ID);
    if (!table?.currentHand) {
      throw new Error("進行中ハンドが見つかりません。");
    }
    const foldSeat = table.seats.find((seat) => seat.seatNo === foldSeatNo);
    const foldPlayer = table.currentHand.players.find(
      (player) => player.seatNo === foldSeatNo,
    );
    if (!foldSeat || !foldPlayer) {
      throw new Error("対象プレイヤーが見つかりません。");
    }

    foldSeat.stack = 0;
    foldPlayer.inHand = true;
    foldPlayer.allIn = false;
    foldPlayer.actedThisRound = false;
    table.currentHand.toActSeatNo = foldSeatNo;

    const folded = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.FOLD },
      }),
      user: foldUser,
      occurredAt: NOW,
    });
    expect(folded.ok).toBe(true);
    if (!folded.ok) {
      return;
    }

    const revealWaitDone = await service.executeRevealWaitTimeout({
      tableId: TABLE_ID,
      occurredAt: NOW,
    });
    expect(revealWaitDone.ok).toBe(true);
    if (!revealWaitDone.ok) {
      return;
    }

    const autoLeaveEvent = revealWaitDone.events.find(
      (
        event,
      ): event is Extract<
        RealtimeTableEventMessage,
        { eventName: typeof TableEventName.SeatStateChangedEvent }
      > =>
        event.eventName === TableEventName.SeatStateChangedEvent &&
        event.payload.reason === SeatStateChangeReason.AUTO_LEAVE_ZERO_STACK &&
        event.payload.seatNo === foldSeatNo,
    );
    expect(autoLeaveEvent).toBeDefined();
    if (!autoLeaveEvent) {
      return;
    }
    expect(autoLeaveEvent.payload.currentStatus).toBe(SeatStatus.EMPTY);
  });

  it("ヘッズアップでも5bet cap超過のRAISEを拒否する", async () => {
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

    const bringInSeatNo = expectBringInSeatNoFromDeal3rd(joined2.events);
    const bringInDone = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.BRING_IN },
      }),
      user: seatByUserId.get(user1.userId) === bringInSeatNo ? user1 : user2,
      occurredAt: NOW,
    });
    expect(bringInDone.ok).toBe(true);
    if (!bringInDone.ok) {
      return;
    }
    let toActSeatNo = expectEvent(
      bringInDone.events[0],
      TableEventName.BringInEvent,
    ).payload.nextToActSeatNo as number;

    const userBySeat = (seatNo: number): SessionUser =>
      seatByUserId.get(user1.userId) === seatNo ? user1 : user2;

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
    toActSeatNo = expectEvent(complete.events[0], TableEventName.CompleteEvent)
      .payload.nextToActSeatNo as number;

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
      toActSeatNo = expectEvent(raised.events[0], TableEventName.RaiseEvent)
        .payload.nextToActSeatNo as number;
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
      command: createCommand({
        type: RealtimeTableCommandType.JOIN,
        payload: { buyIn: 1000 },
      }),
      user: user1,
      occurredAt: NOW,
    });
    await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.JOIN,
        payload: { buyIn: 1000 },
      }),
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
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.RAISE },
      }),
      user: user3,
      occurredAt: NOW,
    });

    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.error.code).toBe(RealtimeErrorCode.INVALID_ACTION);
    }
  });

  it("切断と再接続で PlayerDisconnected/PlayerReconnected を発行する", async () => {
    const service = createRealtimeTableService();
    const user = createUser(1);

    const joined = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.JOIN,
        payload: { buyIn: 1000 },
      }),
      user,
      occurredAt: NOW,
    });
    expect(joined.ok).toBe(true);

    // 切断・再接続をシミュレート
    const disconnected = await service.handleDisconnect({
      tableId: TABLE_ID,
      user,
      occurredAt: NOW,
    });
    expect(disconnected.ok).toBe(true);
    if (!disconnected.ok) {
      return;
    }
    expect(disconnected.events).toHaveLength(1);
    const disconnectedEvent = expectEvent(
      disconnected.events[0],
      TableEventName.PlayerDisconnectedEvent,
    );
    expect(disconnectedEvent.payload.seatStatus).toBe(SeatStatus.DISCONNECTED);
    expect(disconnectedEvent.payload.disconnectStreak).toBe(1);

    const reconnected = await service.handleReconnect({
      tableId: TABLE_ID,
      user,
      occurredAt: NOW,
    });
    expect(reconnected.ok).toBe(true);
    if (!reconnected.ok) {
      return;
    }
    expect(reconnected.events).toHaveLength(1);
    const reconnectedEvent = expectEvent(
      reconnected.events[0],
      TableEventName.PlayerReconnectedEvent,
    );
    expect(reconnectedEvent.payload.disconnectStreakResetTo).toBe(0);
  });

  it("タイムアウト自動アクションで isAuto=true の CheckEvent を発行する", async () => {
    const service = createRealtimeTableService() as unknown as {
      executeCommand: ReturnType<
        typeof createRealtimeTableService
      >["executeCommand"];
      executeAutoAction: ReturnType<
        typeof createRealtimeTableService
      >["executeAutoAction"];
      tables: Map<
        string,
        {
          currentHand: {
            street: string;
            toActSeatNo: number | null;
            streetBetTo: number;
            players: Array<{
              seatNo: number;
              streetContribution: number;
              inHand: boolean;
              allIn: boolean;
            }>;
          } | null;
        }
      >;
    };

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

    const table = service.tables.get(TABLE_ID);
    if (!table?.currentHand) {
      throw new Error("進行中ハンドが見つかりません。");
    }

    const targetPlayer = table.currentHand.players[0];
    if (!targetPlayer) {
      throw new Error("対象プレイヤーが見つかりません。");
    }
    // 対象プレイヤーに手番を回す
    table.currentHand.toActSeatNo = targetPlayer.seatNo;
    // no-bet局面にして toCall=0（CHECKのみ合法）を作る
    table.currentHand.street = Street.FOURTH;
    table.currentHand.streetBetTo = 0;
    targetPlayer.streetContribution = 0;

    // 対象プレイヤーの inHand を true にする
    const autoAction = await service.executeAutoAction({
      tableId: TABLE_ID,
      seatNo: targetPlayer.seatNo,
      occurredAt: NOW,
    });

    expect(autoAction.ok).toBe(true);
    if (!autoAction.ok) {
      return;
    }
    const checkEvent = expectEvent(
      autoAction.events[0],
      TableEventName.CheckEvent,
    );
    expect(checkEvent.payload.isAuto).toBe(true);
  });

  it("タイムアウト自動アクション(FOLD)でも終局イベントまで進行する", async () => {
    const service = createRealtimeTableService() as unknown as {
      executeCommand: ReturnType<
        typeof createRealtimeTableService
      >["executeCommand"];
      executeAutoAction: ReturnType<
        typeof createRealtimeTableService
      >["executeAutoAction"];
    };

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

    const bringInSeatNo = expectBringInSeatNoFromDeal3rd(joined2.events);
    const bringInDone = await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.ACT,
        payload: { action: TableCommandAction.BRING_IN },
      }),
      user:
        expectEvent(joined1.events[0], TableEventName.SeatStateChangedEvent)
          .payload.seatNo === bringInSeatNo
          ? user1
          : user2,
      occurredAt: NOW,
    });
    expect(bringInDone.ok).toBe(true);
    if (!bringInDone.ok) {
      return;
    }
    const autoSeatNo = expectEvent(
      bringInDone.events[0],
      TableEventName.BringInEvent,
    ).payload.nextToActSeatNo as number;

    const autoAction = await service.executeAutoAction({
      tableId: TABLE_ID,
      seatNo: autoSeatNo,
      occurredAt: NOW,
    });
    expect(autoAction.ok).toBe(true);
    if (!autoAction.ok) {
      return;
    }

    const foldEvent = expectEvent(
      autoAction.events[0],
      TableEventName.FoldEvent,
    );
    expect(foldEvent.payload.isAuto).toBe(true);

    const streetAdvanceIndex = autoAction.events.findIndex(
      (event) => event.eventName === TableEventName.StreetAdvanceEvent,
    );
    const dealEndIndex = autoAction.events.findIndex(
      (event) => event.eventName === TableEventName.DealEndEvent,
    );
    expect(streetAdvanceIndex).toBeGreaterThan(0);
    expect(dealEndIndex).toBeGreaterThan(streetAdvanceIndex);

    const streetAdvance = expectEvent(
      autoAction.events[streetAdvanceIndex],
      TableEventName.StreetAdvanceEvent,
    );
    expect(streetAdvance.payload.reason).toBe(StreetAdvanceReason.HAND_CLOSED);
    expect(streetAdvance.payload.toStreet).toBeNull();

    const dealEnd = expectEvent(
      autoAction.events[dealEndIndex],
      TableEventName.DealEndEvent,
    );
    expect(dealEnd.payload.endReason).toBe(DealEndReason.UNCONTESTED);
  });

  it("disconnectStreak>=3 の切断席は自動FOLD後に自動LEAVEする", async () => {
    const service = createRealtimeTableService() as unknown as {
      executeCommand: ReturnType<
        typeof createRealtimeTableService
      >["executeCommand"];
      executeAutoAction: ReturnType<
        typeof createRealtimeTableService
      >["executeAutoAction"];
      tables: Map<
        string,
        {
          seats: Array<{
            seatNo: number;
            status: string;
            statusBeforeDisconnect: string | null;
            userId: string | null;
            displayName: string | null;
            stack: number;
            disconnectStreak: number;
            joinedAt: string | null;
          }>;
          currentHand: {
            toActSeatNo: number | null;
            streetBetTo: number;
            players: Array<{
              seatNo: number;
              streetContribution: number;
            }>;
          } | null;
        }
      >;
    };

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

    const table = service.tables.get(TABLE_ID);
    if (!table?.currentHand) {
      throw new Error("進行中ハンドが見つかりません。");
    }

    const targetSeat = table.seats.find((seat) => seat.userId === user1.userId);
    const targetPlayer = table.currentHand.players.find(
      (player) => player.seatNo === targetSeat?.seatNo,
    );
    if (!targetSeat || !targetPlayer) {
      throw new Error("対象プレイヤーが見つかりません。");
    }

    targetSeat.status = SeatStatus.DISCONNECTED;
    targetSeat.statusBeforeDisconnect = SeatStatus.ACTIVE;
    targetSeat.disconnectStreak = 3;
    table.currentHand.toActSeatNo = targetSeat.seatNo;
    table.currentHand.streetBetTo = 20;
    targetPlayer.streetContribution = 0;

    const autoAction = await service.executeAutoAction({
      tableId: TABLE_ID,
      seatNo: targetSeat.seatNo,
      occurredAt: NOW,
    });

    expect(autoAction.ok).toBe(true);
    if (!autoAction.ok) {
      return;
    }
    const foldEvent = expectEvent(
      autoAction.events[0],
      TableEventName.FoldEvent,
    );
    expect(foldEvent.payload.isAuto).toBe(true);
    const seatStateChangedEvent = expectEvent(
      autoAction.events[1],
      TableEventName.SeatStateChangedEvent,
    );
    expect(seatStateChangedEvent.payload.currentStatus).toBe(SeatStatus.EMPTY);
    expect(seatStateChangedEvent.payload.reason).toBe(
      SeatStateChangeReason.LEAVE,
    );
  });

  it("HP-09 table.resume で差分イベントを連番再送できる", async () => {
    const service = createRealtimeTableService();

    await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.JOIN,
        payload: { buyIn: 1000 },
      }),
      user: createUser(1),
      occurredAt: NOW,
    });
    await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.JOIN,
        payload: { buyIn: 1000 },
      }),
      user: createUser(2),
      occurredAt: NOW,
    });

    const resumed = await service.resumeFrom({
      tableId: TABLE_ID,
      lastTableSeq: 2,
      occurredAt: NOW,
    });

    expect(resumed.kind).toBe(TABLE_RESUME_RESULT_KIND.EVENTS);
    if (resumed.kind !== TABLE_RESUME_RESULT_KIND.EVENTS) {
      return;
    }
    expect(resumed.events.length).toBeGreaterThan(0);
    expect(resumed.events[0]?.tableSeq).toBe(3);
    for (let index = 1; index < resumed.events.length; index += 1) {
      expect(resumed.events[index]?.tableSeq).toBe(
        (resumed.events[index - 1]?.tableSeq ?? 0) + 1,
      );
    }
  });

  it("HP-11 差分保持外の table.resume は snapshot を返す", async () => {
    const service = createRealtimeTableService({ retainedEventLimit: 2 });

    await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.JOIN,
        payload: { buyIn: 1000 },
      }),
      user: createUser(1),
      occurredAt: NOW,
    });
    await service.executeCommand({
      command: createCommand({
        type: RealtimeTableCommandType.JOIN,
        payload: { buyIn: 1000 },
      }),
      user: createUser(2),
      occurredAt: NOW,
    });

    const resumed = await service.resumeFrom({
      tableId: TABLE_ID,
      lastTableSeq: 1,
      occurredAt: NOW,
    });

    expect(resumed.kind).toBe(TABLE_RESUME_RESULT_KIND.SNAPSHOT);
    if (resumed.kind !== TABLE_RESUME_RESULT_KIND.SNAPSHOT) {
      return;
    }
    expect(resumed.snapshot.type).toBe(TABLE_SNAPSHOT_MESSAGE_TYPE);
    expect(resumed.snapshot.payload.reason).toBe(SnapshotReason.OUT_OF_RANGE);
    expect(resumed.snapshot.payload.table).toMatchObject({
      status: expect.any(String),
      gameType: expect.any(String),
      stakes: {
        smallBet: expect.any(Number),
        bigBet: expect.any(Number),
        ante: expect.any(Number),
        bringIn: expect.any(Number),
      },
      seats: expect.any(Array),
      currentHand: expect.anything(),
      dealerSeatNo: expect.any(Number),
      mixIndex: expect.any(Number),
      handsSinceRotation: expect.any(Number),
    });
  });
});
