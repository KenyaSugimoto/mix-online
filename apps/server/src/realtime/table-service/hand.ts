import { randomUUID } from "node:crypto";
import {
  CardVisibility,
  DealEndReason,
  GameType,
  type GameType as GameTypeType,
  HandStatus,
  SeatStateChangeAppliesFrom,
  SeatStateChangeReason,
  SeatStatus,
  ShowdownAction,
  Street,
  StreetAdvanceReason,
  TableEventName,
  TableStatus,
  ThirdStreetCardPosition,
} from "@mix-online/shared";
import { resolveGameRule } from "../game-rule";
import { createShowdownOutcome } from "../showdown-evaluator";
import { createShuffledDeck } from "./deck";
import { canStartHand } from "./turn";
import type {
  CardValue,
  HandPlayerState,
  HandState,
  PendingEvent,
  TableState,
} from "./types";

const determineBringInSeat = (
  gameType: GameTypeType,
  players: HandPlayerState[],
): number => {
  const gameRule = resolveGameRule(gameType);
  return gameRule.determineBringIn(
    players.map((player) => ({
      seatNo: player.seatNo,
      upCards: player.cardsUp,
      hasPairOnBoard: false,
    })),
  );
};

const MIX_GAME_TYPES: GameTypeType[] = [
  GameType.STUD_HI,
  GameType.RAZZ,
  GameType.STUD_8,
];

const STREET_SEQUENCE: Street[] = [
  Street.THIRD,
  Street.FOURTH,
  Street.FIFTH,
  Street.SIXTH,
  Street.SEVENTH,
];

const resolveNextStreet = (
  street: Street,
): Exclude<Street, typeof Street.THIRD> | null => {
  const index = STREET_SEQUENCE.indexOf(street);
  if (index < 0 || index >= STREET_SEQUENCE.length - 1) {
    return null;
  }
  return (STREET_SEQUENCE[index + 1] ?? null) as Exclude<
    Street,
    typeof Street.THIRD
  > | null;
};

const resolveInHandPlayers = (hand: HandState): HandPlayerState[] =>
  hand.players.filter((player) => player.inHand);

const resolveActionablePlayers = (hand: HandState): HandPlayerState[] =>
  hand.players.filter((player) => player.inHand && !player.allIn);

const resolveStreetAdvanceReason = (
  hand: HandState,
):
  | typeof StreetAdvanceReason.BETTING_ROUND_COMPLETE
  | typeof StreetAdvanceReason.ALL_IN_RUNOUT => {
  return resolveActionablePlayers(hand).length === 0
    ? StreetAdvanceReason.ALL_IN_RUNOUT
    : StreetAdvanceReason.BETTING_ROUND_COMPLETE;
};

const resolveNextDealerSeatNo = (table: TableState): number => {
  return (table.dealerSeatNo % table.seats.length) + 1;
};

const applyMixRotation = (table: TableState) => {
  let nextHandsSinceRotation = table.handsSinceRotation + 1;
  let nextMixIndex = table.mixIndex;
  if (nextHandsSinceRotation >= 6) {
    nextMixIndex = (nextMixIndex + 1) % MIX_GAME_TYPES.length;
    nextHandsSinceRotation = 0;
  }

  const nextGameType = MIX_GAME_TYPES[nextMixIndex] ?? GameType.STUD_HI;
  table.mixIndex = nextMixIndex;
  table.handsSinceRotation = nextHandsSinceRotation;
  table.gameType = nextGameType;

  return {
    nextGameType,
    mixIndex: nextMixIndex,
    handsSinceRotation: nextHandsSinceRotation,
  };
};

const resolveFirstToAct = (
  table: TableState,
  hand: HandState,
  street: Street,
): number | null => {
  const actionablePlayers = resolveActionablePlayers(hand);
  if (actionablePlayers.length === 0) {
    return null;
  }

  const gameRule = resolveGameRule(table.gameType);
  const firstToAct = gameRule.determineFirstToAct(
    street,
    actionablePlayers.map((player) => ({
      seatNo: player.seatNo,
      upCards: player.cardsUp,
      hasPairOnBoard: false,
    })),
  );

  if (
    firstToAct !== null &&
    actionablePlayers.some((player) => player.seatNo === firstToAct)
  ) {
    return firstToAct;
  }

  return (
    actionablePlayers.sort((left, right) => left.seatNo - right.seatNo)[0]
      ?.seatNo ?? null
  );
};

/**
 * テーブルの状態を元に、ハンド終了後のシートの状態遷移を適用し、発生するイベントを生成します。
 * - スタックが0になったプレイヤーは卓から自動退席させる
 * - 次のハンド開始待ちのプレイヤーは次のハンド開始とともにアクティブにする
 */
const applySeatTransitionsAfterHand = (table: TableState): PendingEvent[] => {
  const events: PendingEvent[] = [];

  for (const seat of table.seats) {
    // スタックが0のプレイヤーは卓から自動退席させる
    if (seat.status !== SeatStatus.EMPTY && seat.stack === 0) {
      const previousStatus = seat.status;
      seat.status = SeatStatus.EMPTY;
      seat.statusBeforeDisconnect = null;
      seat.userId = null;
      seat.displayName = null;
      seat.stack = 0;
      seat.disconnectStreak = 0;
      seat.joinedAt = null;

      events.push({
        handId: null,
        eventName: TableEventName.SeatStateChangedEvent,
        payload: {
          seatNo: seat.seatNo,
          previousStatus,
          currentStatus: SeatStatus.EMPTY,
          reason: SeatStateChangeReason.AUTO_LEAVE_ZERO_STACK,
          user: null,
          stack: 0,
          appliesFrom: SeatStateChangeAppliesFrom.IMMEDIATE,
        },
      });
      continue;
    }

    // 次のハンド開始待ちのプレイヤーは次のハンド開始とともにアクティブにする
    if (
      seat.status === SeatStatus.SEATED_WAIT_NEXT_HAND &&
      seat.userId !== null &&
      seat.displayName !== null
    ) {
      const previousStatus = seat.status;
      seat.status = SeatStatus.ACTIVE;
      events.push({
        handId: null,
        eventName: TableEventName.SeatStateChangedEvent,
        payload: {
          seatNo: seat.seatNo,
          previousStatus,
          currentStatus: SeatStatus.ACTIVE,
          reason: SeatStateChangeReason.NEXT_HAND_ACTIVATE,
          user: {
            userId: seat.userId,
            displayName: seat.displayName,
          },
          stack: seat.stack,
          appliesFrom: SeatStateChangeAppliesFrom.IMMEDIATE,
        },
      });
    }
  }

  return events;
};

const buildHandResultRows = (params: {
  table: TableState;
  hand: HandState;
  payoutBySeatNo: Map<number, number>;
}) => {
  return params.hand.players
    .map((player) => {
      const seat = params.table.seats.find(
        (candidate) => candidate.seatNo === player.seatNo,
      );
      return {
        seatNo: player.seatNo,
        userId: player.userId,
        displayName: player.displayName,
        delta:
          (params.payoutBySeatNo.get(player.seatNo) ?? 0) -
          player.totalContribution,
        stackAfter: seat?.stack ?? 0,
      };
    })
    .sort((left, right) => left.seatNo - right.seatNo);
};

const dealNextStreet = (params: {
  table: TableState;
  hand: HandState;
  toStreet: Exclude<Street, typeof Street.THIRD>;
  reason:
    | typeof StreetAdvanceReason.BETTING_ROUND_COMPLETE
    | typeof StreetAdvanceReason.ALL_IN_RUNOUT;
}): PendingEvent[] => {
  const { table, hand, toStreet, reason } = params;
  const fromStreet = hand.street;
  const inHandPlayers = resolveInHandPlayers(hand);

  hand.street = toStreet;
  hand.raiseCount = 0;
  hand.streetBetTo = 0;
  hand.toActSeatNo = null;
  for (const player of hand.players) {
    player.streetContribution = 0;
    player.actedThisRound = !player.inHand || player.allIn;
  }

  const dealtCards = inHandPlayers.map((player) => {
    const dealtCard = hand.deck.shift() ?? null;
    if (dealtCard) {
      if (toStreet === Street.SEVENTH) {
        player.cardsDown.push(dealtCard);
      } else {
        player.cardsUp.push(dealtCard);
      }
    }
    return {
      seatNo: player.seatNo,
      visibility:
        toStreet === Street.SEVENTH
          ? CardVisibility.DOWN_SELF
          : CardVisibility.UP,
      card: dealtCard,
    };
  });

  const nextToActSeatNo = resolveFirstToAct(table, hand, toStreet);
  hand.toActSeatNo = nextToActSeatNo;
  table.status = TableStatus.BETTING;

  return [
    {
      handId: hand.handId,
      eventName: TableEventName.StreetAdvanceEvent,
      payload: {
        fromStreet,
        toStreet,
        potTotal: hand.potTotal,
        activeSeatNos: inHandPlayers.map((player) => player.seatNo),
        nextToActSeatNo,
        tableStatus: TableStatus.BETTING,
        reason,
      },
    },
    {
      handId: hand.handId,
      eventName: TableEventName.DealCardEvent,
      payload: {
        street: toStreet,
        cards: dealtCards,
        toActSeatNo: nextToActSeatNo,
        potAfter: hand.potTotal,
      },
    },
  ];
};

const finishUncontestedHand = (params: {
  table: TableState;
  hand: HandState;
}): PendingEvent[] => {
  const { table, hand } = params;
  const inHandPlayers = resolveInHandPlayers(hand);
  const winner = inHandPlayers[0];

  const payoutBySeatNo = new Map<number, number>();
  if (winner) {
    const winnerSeat = table.seats.find(
      (seat) => seat.seatNo === winner.seatNo,
    );
    if (winnerSeat) {
      winnerSeat.stack += hand.potTotal;
      payoutBySeatNo.set(winner.seatNo, hand.potTotal);
    }
  }

  table.status = TableStatus.HAND_END;
  hand.status = HandStatus.HAND_END;

  const nextDealerSeatNo = resolveNextDealerSeatNo(table);
  table.dealerSeatNo = nextDealerSeatNo;
  const mixState = applyMixRotation(table);

  const events: PendingEvent[] = [
    {
      handId: hand.handId,
      eventName: TableEventName.StreetAdvanceEvent,
      payload: {
        fromStreet: hand.street,
        toStreet: null,
        potTotal: hand.potTotal,
        activeSeatNos: inHandPlayers.map((player) => player.seatNo),
        nextToActSeatNo: null,
        tableStatus: TableStatus.HAND_END,
        reason: StreetAdvanceReason.HAND_CLOSED,
      },
    },
    {
      handId: hand.handId,
      eventName: TableEventName.DealEndEvent,
      payload: {
        endReason: DealEndReason.UNCONTESTED,
        finalPot: hand.potTotal,
        results: buildHandResultRows({ table, hand, payoutBySeatNo }),
        nextDealerSeatNo,
        nextGameType: mixState.nextGameType,
        mixIndex: mixState.mixIndex,
        handsSinceRotation: mixState.handsSinceRotation,
      },
    },
  ];

  table.pendingNextHandStart = true;

  return events;
};

const finishShowdownHand = (params: {
  table: TableState;
  hand: HandState;
  reason:
    | typeof StreetAdvanceReason.BETTING_ROUND_COMPLETE
    | typeof StreetAdvanceReason.ALL_IN_RUNOUT;
}): PendingEvent[] => {
  const { table, hand, reason } = params;
  const inHandPlayers = resolveInHandPlayers(hand);

  table.status = TableStatus.SHOWDOWN;
  hand.status = HandStatus.SHOWDOWN;

  const outcome = createShowdownOutcome({
    gameType: table.gameType,
    dealerSeatNo: table.dealerSeatNo,
    players: hand.players.map((player) => ({
      seatNo: player.seatNo,
      userId: player.userId,
      displayName: player.displayName,
      cardsUp: player.cardsUp,
      cardsDown: player.cardsDown,
      contribution: player.totalContribution,
      isFolded: !player.inHand,
    })),
  });

  const payoutBySeatNo = new Map<number, number>();
  for (const pot of outcome.potResults) {
    for (const winner of pot.winners) {
      const seat = table.seats.find(
        (candidate) => candidate.seatNo === winner.seatNo,
      );
      if (!seat) {
        continue;
      }
      seat.stack += winner.amount;
      payoutBySeatNo.set(
        winner.seatNo,
        (payoutBySeatNo.get(winner.seatNo) ?? 0) + winner.amount,
      );
    }
  }

  const handLabelByUserId = new Map<string, string | null>();
  const winningSeatNos = new Set<number>();
  for (const potResult of outcome.potResults) {
    for (const winner of potResult.winners) {
      winningSeatNos.add(winner.seatNo);
      if (!handLabelByUserId.has(winner.userId)) {
        handLabelByUserId.set(winner.userId, winner.handLabel);
      }
    }
  }

  const showdownOrder = inHandPlayers
    .map((player) => player.seatNo)
    .sort((left, right) => left - right);

  table.status = TableStatus.HAND_END;
  hand.status = HandStatus.HAND_END;

  const nextDealerSeatNo = resolveNextDealerSeatNo(table);
  table.dealerSeatNo = nextDealerSeatNo;
  const mixState = applyMixRotation(table);

  const events: PendingEvent[] = [
    {
      handId: hand.handId,
      eventName: TableEventName.StreetAdvanceEvent,
      payload: {
        fromStreet: hand.street,
        toStreet: null,
        potTotal: hand.potTotal,
        activeSeatNos: showdownOrder,
        nextToActSeatNo: null,
        tableStatus: TableStatus.SHOWDOWN,
        reason,
      },
    },
    {
      handId: hand.handId,
      eventName: TableEventName.ShowdownEvent,
      payload: {
        hasShowdown: true,
        showdownOrder,
        players: inHandPlayers.map((player) => {
          const showed = winningSeatNos.has(player.seatNo);
          return {
            seatNo: player.seatNo,
            userId: player.userId,
            displayName: player.displayName,
            action: showed ? ShowdownAction.SHOW : ShowdownAction.MUCK,
            cardsUp: player.cardsUp,
            cardsDown: showed ? player.cardsDown : [],
            handLabel: showed
              ? (handLabelByUserId.get(player.userId) ?? null)
              : null,
          };
        }),
        potResults: outcome.potResults,
      },
    },
    {
      handId: hand.handId,
      eventName: TableEventName.DealEndEvent,
      payload: {
        endReason: DealEndReason.SHOWDOWN,
        finalPot: hand.potTotal,
        results: buildHandResultRows({ table, hand, payoutBySeatNo }),
        nextDealerSeatNo,
        nextGameType: mixState.nextGameType,
        mixIndex: mixState.mixIndex,
        handsSinceRotation: mixState.handsSinceRotation,
      },
    },
  ];

  table.pendingNextHandStart = true;

  return events;
};

export const startThirdStreet = (table: TableState): PendingEvent[] => {
  const participants = table.seats
    .filter(
      (seat) => seat.status === SeatStatus.ACTIVE && seat.stack >= table.ante,
    )
    .map<HandPlayerState>((seat) => ({
      seatNo: seat.seatNo,
      userId: seat.userId ?? "",
      displayName: seat.displayName ?? "",
      startStack: seat.stack,
      totalContribution: 0,
      streetContribution: 0,
      cardsUp: [],
      cardsDown: [],
      inHand: true,
      allIn: false,
      actedThisRound: false,
    }));

  if (participants.length < 2) {
    return [];
  }

  table.pendingNextHandStart = false;
  table.status = TableStatus.DEALING;
  const handId = randomUUID();
  const handNo = table.nextHandNo;
  table.nextHandNo += 1;

  const hand: HandState = {
    handId,
    handNo,
    status: HandStatus.IN_PROGRESS,
    street: Street.THIRD,
    potTotal: 0,
    toActSeatNo: null,
    bringInSeatNo: null,
    players: participants,
    streetBetTo: 0,
    raiseCount: 0,
    deck: [],
  };

  const dealInitEvent: PendingEvent = {
    handId,
    eventName: TableEventName.DealInitEvent,
    payload: {
      handNo,
      gameType: table.gameType,
      street: Street.THIRD,
      dealerSeatNo: table.dealerSeatNo,
      mixIndex: table.mixIndex,
      handsSinceRotation: table.handsSinceRotation,
      stakes: {
        smallBet: table.smallBet,
        bigBet: table.bigBet,
        ante: table.ante,
        bringIn: table.bringIn,
      },
      participants: participants.map((player) => ({
        seatNo: player.seatNo,
        userId: player.userId,
        displayName: player.displayName,
        startStack: player.startStack,
      })),
    },
  };

  const postAnteContributions: Array<{
    seatNo: number;
    amount: number;
    stackAfter: number;
    isAllIn: boolean;
  }> = [];

  for (const player of hand.players) {
    const seat = table.seats.find((entry) => entry.seatNo === player.seatNo);
    if (!seat) {
      continue;
    }

    const ante = Math.min(table.ante, seat.stack);
    seat.stack -= ante;
    player.totalContribution += ante;
    if (seat.stack === 0) {
      player.allIn = true;
    }

    hand.potTotal += ante;
    postAnteContributions.push({
      seatNo: seat.seatNo,
      amount: ante,
      stackAfter: seat.stack,
      isAllIn: seat.stack === 0,
    });
  }
  const postAnteEvent: PendingEvent = {
    handId,
    eventName: TableEventName.PostAnteEvent,
    payload: {
      street: Street.THIRD,
      contributions: postAnteContributions,
      potAfter: hand.potTotal,
    },
  };

  const deck = createShuffledDeck();
  hand.deck = deck;
  const thirdStreetCards: Array<{
    seatNo: number;
    cards: Array<{
      position:
        | typeof ThirdStreetCardPosition.HOLE_1
        | typeof ThirdStreetCardPosition.HOLE_2
        | typeof ThirdStreetCardPosition.UP_3;
      visibility:
        | typeof CardVisibility.DOWN_HIDDEN
        | typeof CardVisibility.DOWN_SELF
        | typeof CardVisibility.UP;
      card: CardValue | null;
    }>;
  }> = [];

  for (const player of hand.players) {
    const hole1 = deck.shift();
    const hole2 = deck.shift();
    const up3 = deck.shift();
    if (!hole1 || !hole2 || !up3) {
      continue;
    }

    player.cardsDown.push(hole1, hole2);
    player.cardsUp.push(up3);

    thirdStreetCards.push({
      seatNo: player.seatNo,
      cards: [
        {
          position: ThirdStreetCardPosition.HOLE_1,
          visibility: CardVisibility.DOWN_SELF,
          card: hole1,
        },
        {
          position: ThirdStreetCardPosition.HOLE_2,
          visibility: CardVisibility.DOWN_SELF,
          card: hole2,
        },
        {
          position: ThirdStreetCardPosition.UP_3,
          visibility: CardVisibility.UP,
          card: up3,
        },
      ],
    });
  }

  const bringInSeatNo = determineBringInSeat(table.gameType, hand.players);
  hand.bringInSeatNo = bringInSeatNo;
  hand.toActSeatNo = bringInSeatNo;
  table.status = TableStatus.BETTING;
  table.currentHand = hand;

  const dealCards3rdEvent: PendingEvent = {
    handId,
    eventName: TableEventName.DealCards3rdEvent,
    payload: {
      street: Street.THIRD,
      bringInSeatNo,
      cards: thirdStreetCards,
    },
  };

  return [dealInitEvent, postAnteEvent, dealCards3rdEvent];
};

export const startNextHandAfterRevealWait = (
  table: TableState,
): PendingEvent[] => {
  if (!table.pendingNextHandStart || table.status !== TableStatus.HAND_END) {
    return [];
  }

  table.pendingNextHandStart = false;
  table.currentHand = null;
  table.status = TableStatus.WAITING;

  const events: PendingEvent[] = [...applySeatTransitionsAfterHand(table)];
  if (canStartHand(table)) {
    events.push(...startThirdStreet(table));
  }

  return events;
};

/**
 * テーブルの状態を元に、ハンドのアクション後の状態遷移を適用し、発生するイベントを生成します。
 * - ベッティングラウンドが完了していれば次のストリートに進行させる
 * - 全員オールインであれば次のストリートに進行させる
 * - ハンド終了条件を満たしていればハンドを終了させる
 */
export const progressHandAfterAction = (table: TableState): PendingEvent[] => {
  const events: PendingEvent[] = [];

  while (true) {
    const hand = table.currentHand;
    if (!hand || table.status !== TableStatus.BETTING) {
      return events;
    }
    if (hand.toActSeatNo !== null) {
      return events;
    }

    const inHandPlayers = resolveInHandPlayers(hand);
    if (inHandPlayers.length <= 1) {
      events.push(...finishUncontestedHand({ table, hand }));
      return events;
    }

    const nextStreet = resolveNextStreet(hand.street);
    if (nextStreet === null) {
      events.push(
        ...finishShowdownHand({
          table,
          hand,
          reason: resolveStreetAdvanceReason(hand),
        }),
      );
      return events;
    }

    events.push(
      ...dealNextStreet({
        table,
        hand,
        toStreet: nextStreet,
        reason: resolveStreetAdvanceReason(hand),
      }),
    );
  }
};
