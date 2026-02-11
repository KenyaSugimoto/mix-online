import { randomUUID } from "node:crypto";
import {
  type CardRank,
  type CardSuit,
  CardVisibility,
  GameType,
  type GameType as GameTypeType,
  HandStatus,
  RealtimeErrorCode,
  SeatStateChangeAppliesFrom,
  SeatStateChangeReason,
  SeatStatus,
  type SeatStatus as SeatStatusType,
  Street,
  TableEventName,
  TableStatus,
  type TableStatus as TableStatusType,
  ThirdStreetCardPosition,
} from "@mix-online/shared";
import type { SessionUser } from "../auth-session";
import { createStandardDeck } from "../testing/fixed-deck-harness";
import { resolveGameRule } from "./game-rule";
import {
  type TableActorRegistry,
  createTableActorRegistry,
} from "./table-actor";

type TableCommandType =
  | "table.join"
  | "table.sitOut"
  | "table.return"
  | "table.leave"
  | "table.act"
  | "table.resume";

type BaseCommand = {
  type: TableCommandType;
  requestId: string;
  sentAt: string;
  payload: Record<string, unknown>;
};

type TableSeat = {
  seatNo: number;
  status: SeatStatusType;
  userId: string | null;
  displayName: string | null;
  stack: number;
  disconnectStreak: number;
  joinedAt: string | null;
};

type TableState = {
  tableId: string;
  status: TableStatusType;
  gameType: GameTypeType;
  mixIndex: number;
  handsSinceRotation: number;
  dealerSeatNo: number;
  smallBet: number;
  bigBet: number;
  ante: number;
  bringIn: number;
  currentHand: HandState | null;
  nextHandNo: number;
  seats: TableSeat[];
};

type HandPlayerState = {
  seatNo: number;
  userId: string;
  displayName: string;
  startStack: number;
  totalContribution: number;
  streetContribution: number;
  cardsUp: CardValue[];
  cardsDown: CardValue[];
  inHand: boolean;
  allIn: boolean;
  actedThisRound: boolean;
};

type CardValue = {
  rank: CardRank;
  suit: CardSuit;
};

type HandState = {
  handId: string;
  handNo: number;
  status: HandStatus;
  street: Street;
  potTotal: number;
  toActSeatNo: number | null;
  bringInSeatNo: number | null;
  players: HandPlayerState[];
  streetBetTo: number;
  raiseCount: number;
};

type TableEventMessage = {
  type: "table.event";
  tableId: string;
  tableSeq: number;
  handId: string | null;
  handSeq: number | null;
  occurredAt: string;
  eventName: (typeof TableEventName)[keyof typeof TableEventName];
  payload: Record<string, unknown>;
};

type TableServiceError = {
  code: (typeof RealtimeErrorCode)[keyof typeof RealtimeErrorCode];
  message: string;
  tableId: string | null;
  requestId: string;
};

type TableServiceResult =
  | {
      ok: true;
      tableId: string;
      events: TableEventMessage[];
    }
  | {
      ok: false;
      error: TableServiceError;
    };

type RealtimeTableServiceOptions = {
  actorRegistry?: TableActorRegistry;
};

type PendingEvent = {
  handId: string | null;
  eventName: (typeof TableEventName)[keyof typeof TableEventName];
  payload: Record<string, unknown>;
};

const BUY_IN_MIN = 400;
const BUY_IN_MAX = 2000;

const createDefaultTableState = (tableId: string): TableState => ({
  tableId,
  status: TableStatus.WAITING,
  gameType: GameType.STUD_HI,
  mixIndex: 0,
  handsSinceRotation: 0,
  dealerSeatNo: 1,
  smallBet: 20,
  bigBet: 40,
  ante: 5,
  bringIn: 10,
  currentHand: null,
  nextHandNo: 1,
  seats: Array.from({ length: 6 }, (_, index) => ({
    seatNo: index + 1,
    status: SeatStatus.EMPTY,
    userId: null,
    displayName: null,
    stack: 0,
    disconnectStreak: 0,
    joinedAt: null,
  })),
});

export class RealtimeTableService {
  private readonly actorRegistry: TableActorRegistry;
  private readonly tables = new Map<string, TableState>();
  private readonly walletByUserId = new Map<string, number>();

  constructor(options: RealtimeTableServiceOptions = {}) {
    this.actorRegistry = options.actorRegistry ?? createTableActorRegistry();
  }

  async executeCommand(params: {
    command: BaseCommand;
    user: SessionUser;
    occurredAt: Date;
  }): Promise<TableServiceResult> {
    const tableId = this.resolveTableId(params.command.payload);

    if (tableId === null) {
      return {
        ok: false,
        error: {
          code: RealtimeErrorCode.INVALID_ACTION,
          message: "tableId は必須です。",
          tableId: null,
          requestId: params.command.requestId,
        },
      };
    }

    const actor = this.actorRegistry.getOrCreate(tableId);
    return actor.enqueue(({ allocateTableSeq, allocateHandSeq }) => {
      const table = this.getOrCreateTable(tableId);
      const currentBalance = this.resolveWalletBalance(params.user);

      const outcome = this.applyCommand({
        table,
        user: params.user,
        command: params.command,
        currentBalance,
        occurredAt: params.occurredAt,
      });

      if (outcome.ok === false) {
        return outcome;
      }

      if (outcome.startHand) {
        outcome.events.push(...this.startThirdStreet(table));
      }

      this.walletByUserId.set(params.user.userId, outcome.nextWalletBalance);
      return {
        ok: true,
        tableId,
        events: outcome.events.map((event) => ({
          type: "table.event",
          tableId,
          tableSeq: allocateTableSeq(),
          handId: event.handId,
          handSeq: event.handId ? allocateHandSeq(event.handId) : null,
          occurredAt: params.occurredAt.toISOString(),
          eventName: event.eventName,
          payload: event.payload,
        })),
      };
    });
  }

  private resolveTableId(payload: Record<string, unknown>): string | null {
    const raw = payload.tableId;
    if (typeof raw !== "string" || raw.length === 0) {
      return null;
    }
    return raw;
  }

  private getOrCreateTable(tableId: string): TableState {
    const existing = this.tables.get(tableId);
    if (existing) {
      return existing;
    }

    const created = createDefaultTableState(tableId);
    this.tables.set(tableId, created);
    return created;
  }

  private resolveWalletBalance(user: SessionUser): number {
    return this.walletByUserId.get(user.userId) ?? user.walletBalance;
  }

  private applyCommand(params: {
    table: TableState;
    user: SessionUser;
    command: BaseCommand;
    currentBalance: number;
    occurredAt: Date;
  }):
    | {
        ok: true;
        events: PendingEvent[];
        nextWalletBalance: number;
        startHand: boolean;
      }
    | {
        ok: false;
        error: TableServiceError;
      } {
    const seat = params.table.seats.find(
      (entry) => entry.userId === params.user.userId,
    );

    if (params.command.type === "table.join") {
      if (seat) {
        return this.fail(
          RealtimeErrorCode.ALREADY_SEATED,
          "同卓に重複着席はできません。",
          params.command.requestId,
          params.table.tableId,
        );
      }

      const buyIn = params.command.payload.buyIn;
      if (
        typeof buyIn !== "number" ||
        !Number.isInteger(buyIn) ||
        buyIn < BUY_IN_MIN ||
        buyIn > BUY_IN_MAX
      ) {
        return this.fail(
          RealtimeErrorCode.BUYIN_OUT_OF_RANGE,
          `buyIn は ${BUY_IN_MIN}〜${BUY_IN_MAX} の整数で指定してください。`,
          params.command.requestId,
          params.table.tableId,
        );
      }

      if (params.currentBalance < buyIn) {
        return this.fail(
          RealtimeErrorCode.INSUFFICIENT_CHIPS,
          "ウォレット残高が不足しています。",
          params.command.requestId,
          params.table.tableId,
        );
      }

      const emptySeat = params.table.seats.find(
        (entry) => entry.status === SeatStatus.EMPTY,
      );

      if (!emptySeat) {
        return this.fail(
          RealtimeErrorCode.TABLE_FULL,
          "空席がないため着席できません。",
          params.command.requestId,
          params.table.tableId,
        );
      }

      const nextStatus =
        params.table.status === TableStatus.WAITING
          ? SeatStatus.ACTIVE
          : SeatStatus.SEATED_WAIT_NEXT_HAND;
      emptySeat.status = nextStatus;
      emptySeat.userId = params.user.userId;
      emptySeat.displayName = params.user.displayName;
      emptySeat.stack = buyIn;
      emptySeat.disconnectStreak = 0;
      emptySeat.joinedAt = params.occurredAt.toISOString();

      return {
        ok: true,
        nextWalletBalance: params.currentBalance - buyIn,
        startHand: this.canStartHand(params.table),
        events: [
          {
            handId: null,
            eventName: TableEventName.SeatStateChangedEvent,
            payload: {
              seatNo: emptySeat.seatNo,
              previousStatus: SeatStatus.EMPTY,
              currentStatus: emptySeat.status,
              reason: SeatStateChangeReason.JOIN,
              user: {
                userId: params.user.userId,
                displayName: params.user.displayName,
              },
              stack: emptySeat.stack,
              appliesFrom:
                nextStatus === SeatStatus.ACTIVE
                  ? SeatStateChangeAppliesFrom.IMMEDIATE
                  : SeatStateChangeAppliesFrom.NEXT_HAND,
            },
          },
        ],
      };
    }

    if (!seat) {
      return this.fail(
        RealtimeErrorCode.INVALID_ACTION,
        "卓に着席していないため操作できません。",
        params.command.requestId,
        params.table.tableId,
      );
    }

    if (params.command.type === "table.sitOut") {
      if (
        seat.status !== SeatStatus.ACTIVE &&
        seat.status !== SeatStatus.SEATED_WAIT_NEXT_HAND
      ) {
        return this.fail(
          RealtimeErrorCode.INVALID_ACTION,
          "現在の席状態では sitOut できません。",
          params.command.requestId,
          params.table.tableId,
        );
      }

      const previousStatus = seat.status;
      seat.status = SeatStatus.SIT_OUT;

      return {
        ok: true,
        nextWalletBalance: params.currentBalance,
        startHand: false,
        events: [
          {
            handId: null,
            eventName: TableEventName.SeatStateChangedEvent,
            payload: {
              seatNo: seat.seatNo,
              previousStatus,
              currentStatus: seat.status,
              reason: SeatStateChangeReason.SIT_OUT,
              user: {
                userId: params.user.userId,
                displayName: params.user.displayName,
              },
              stack: seat.stack,
              appliesFrom: SeatStateChangeAppliesFrom.IMMEDIATE,
            },
          },
        ],
      };
    }

    if (params.command.type === "table.return") {
      if (seat.status !== SeatStatus.SIT_OUT) {
        return this.fail(
          RealtimeErrorCode.INVALID_ACTION,
          "SIT_OUT 状態以外では return できません。",
          params.command.requestId,
          params.table.tableId,
        );
      }

      const nextStatus =
        params.table.status === TableStatus.WAITING
          ? SeatStatus.ACTIVE
          : SeatStatus.SEATED_WAIT_NEXT_HAND;
      const previousStatus = seat.status;
      seat.status = nextStatus;

      return {
        ok: true,
        nextWalletBalance: params.currentBalance,
        startHand: this.canStartHand(params.table),
        events: [
          {
            handId: null,
            eventName: TableEventName.SeatStateChangedEvent,
            payload: {
              seatNo: seat.seatNo,
              previousStatus,
              currentStatus: seat.status,
              reason: SeatStateChangeReason.RETURN,
              user: {
                userId: params.user.userId,
                displayName: params.user.displayName,
              },
              stack: seat.stack,
              appliesFrom:
                nextStatus === SeatStatus.ACTIVE
                  ? SeatStateChangeAppliesFrom.IMMEDIATE
                  : SeatStateChangeAppliesFrom.NEXT_HAND,
            },
          },
        ],
      };
    }

    if (params.command.type === "table.leave") {
      const previousStatus = seat.status;
      const cashOut = seat.stack;
      seat.status = SeatStatus.EMPTY;
      seat.userId = null;
      seat.displayName = null;
      seat.stack = 0;
      seat.disconnectStreak = 0;
      seat.joinedAt = null;

      return {
        ok: true,
        nextWalletBalance: params.currentBalance + cashOut,
        startHand: false,
        events: [
          {
            handId: null,
            eventName: TableEventName.SeatStateChangedEvent,
            payload: {
              seatNo: seat.seatNo,
              previousStatus,
              currentStatus: SeatStatus.EMPTY,
              reason: SeatStateChangeReason.LEAVE,
              user: null,
              stack: 0,
              appliesFrom: SeatStateChangeAppliesFrom.IMMEDIATE,
            },
          },
        ],
      };
    }

    if (params.command.type === "table.act") {
      return this.applyActCommand(params);
    }

    return this.fail(
      RealtimeErrorCode.INVALID_ACTION,
      `${params.command.type} は未対応です。`,
      params.command.requestId,
      params.table.tableId,
    );
  }

  private applyActCommand(params: {
    table: TableState;
    user: SessionUser;
    command: BaseCommand;
    currentBalance: number;
  }):
    | {
        ok: true;
        events: PendingEvent[];
        nextWalletBalance: number;
        startHand: boolean;
      }
    | {
        ok: false;
        error: TableServiceError;
      } {
    const hand = params.table.currentHand;
    if (!hand || params.table.status !== TableStatus.BETTING) {
      return this.fail(
        RealtimeErrorCode.INVALID_ACTION,
        "現在アクション可能なハンドはありません。",
        params.command.requestId,
        params.table.tableId,
      );
    }

    const seat = params.table.seats.find(
      (entry) => entry.userId === params.user.userId,
    );
    if (!seat) {
      return this.fail(
        RealtimeErrorCode.INVALID_ACTION,
        "卓に着席していないためアクションできません。",
        params.command.requestId,
        params.table.tableId,
      );
    }

    const player = hand.players.find((entry) => entry.seatNo === seat.seatNo);
    if (!player || !player.inHand || player.allIn) {
      return this.fail(
        RealtimeErrorCode.INVALID_ACTION,
        "現在の状態ではアクションできません。",
        params.command.requestId,
        params.table.tableId,
      );
    }

    if (hand.toActSeatNo !== seat.seatNo) {
      return this.fail(
        RealtimeErrorCode.NOT_YOUR_TURN,
        "現在あなたの手番ではありません。",
        params.command.requestId,
        params.table.tableId,
      );
    }

    const action = params.command.payload.action;
    if (typeof action !== "string") {
      return this.fail(
        RealtimeErrorCode.INVALID_ACTION,
        "action は必須です。",
        params.command.requestId,
        params.table.tableId,
      );
    }

    const toCall = Math.max(0, hand.streetBetTo - player.streetContribution);
    let amount = 0;
    let eventName:
      | typeof TableEventName.CallEvent
      | typeof TableEventName.CheckEvent
      | typeof TableEventName.FoldEvent
      | typeof TableEventName.CompleteEvent
      | typeof TableEventName.RaiseEvent;

    if (action === "CHECK") {
      if (toCall > 0) {
        return this.fail(
          RealtimeErrorCode.INVALID_ACTION,
          "toCall がある状態では CHECK できません。",
          params.command.requestId,
          params.table.tableId,
        );
      }

      player.actedThisRound = true;
      eventName = TableEventName.CheckEvent;
    } else if (action === "FOLD") {
      player.inHand = false;
      player.actedThisRound = true;
      eventName = TableEventName.FoldEvent;
    } else if (action === "CALL") {
      amount = Math.min(toCall, seat.stack);
      seat.stack -= amount;
      player.totalContribution += amount;
      player.streetContribution += amount;
      if (seat.stack === 0) {
        player.allIn = true;
      }
      hand.potTotal += amount;
      player.actedThisRound = true;
      eventName = TableEventName.CallEvent;
    } else if (action === "COMPLETE") {
      if (
        hand.streetBetTo >= params.table.smallBet ||
        hand.street !== Street.THIRD
      ) {
        return this.fail(
          RealtimeErrorCode.INVALID_ACTION,
          "現在の局面では COMPLETE できません。",
          params.command.requestId,
          params.table.tableId,
        );
      }

      const targetBet = params.table.smallBet;
      amount = Math.min(
        Math.max(0, targetBet - player.streetContribution),
        seat.stack,
      );
      seat.stack -= amount;
      player.totalContribution += amount;
      player.streetContribution += amount;
      if (seat.stack === 0) {
        player.allIn = true;
      }
      hand.potTotal += amount;
      hand.streetBetTo = Math.max(hand.streetBetTo, player.streetContribution);
      hand.raiseCount = 0;
      for (const candidate of hand.players) {
        candidate.actedThisRound = candidate.seatNo === player.seatNo;
      }
      eventName = TableEventName.CompleteEvent;
    } else if (action === "RAISE") {
      if (hand.street !== Street.THIRD && hand.street !== Street.FOURTH) {
        // M3-05 時点では third/fourth 基本ベットのみサポートし、詳細街進行はM3-06以降で拡張する。
      }
      if (hand.streetBetTo < params.table.smallBet) {
        return this.fail(
          RealtimeErrorCode.INVALID_ACTION,
          "COMPLETE 前に RAISE はできません。",
          params.command.requestId,
          params.table.tableId,
        );
      }

      const activePlayers = hand.players.filter(
        (entry) => entry.inHand && !entry.allIn,
      );
      const isHeadsUp = activePlayers.length <= 2;
      if (!isHeadsUp && hand.raiseCount >= 4) {
        return this.fail(
          RealtimeErrorCode.INVALID_ACTION,
          "このストリートのRAISE上限に達しています。",
          params.command.requestId,
          params.table.tableId,
        );
      }

      const raiseSize = params.table.smallBet;
      const targetBet = hand.streetBetTo + raiseSize;
      amount = Math.min(
        Math.max(0, targetBet - player.streetContribution),
        seat.stack,
      );
      seat.stack -= amount;
      player.totalContribution += amount;
      player.streetContribution += amount;
      if (seat.stack === 0) {
        player.allIn = true;
      }
      hand.potTotal += amount;
      if (player.streetContribution > hand.streetBetTo) {
        hand.streetBetTo = player.streetContribution;
      }
      hand.raiseCount += 1;
      for (const candidate of hand.players) {
        candidate.actedThisRound = candidate.seatNo === player.seatNo;
      }
      eventName = TableEventName.RaiseEvent;
    } else {
      return this.fail(
        RealtimeErrorCode.INVALID_ACTION,
        `${action} は未対応のアクションです。`,
        params.command.requestId,
        params.table.tableId,
      );
    }

    const nextToActSeatNo = this.resolveNextToAct(hand, seat.seatNo);
    hand.toActSeatNo = nextToActSeatNo;

    const payloadBase = {
      street: hand.street,
      seatNo: seat.seatNo,
      potAfter: hand.potTotal,
      nextToActSeatNo,
    };

    if (eventName === TableEventName.CheckEvent) {
      return {
        ok: true,
        startHand: false,
        nextWalletBalance: params.currentBalance,
        events: [
          {
            handId: hand.handId,
            eventName,
            payload: {
              ...payloadBase,
              isAuto: false,
            },
          },
        ],
      };
    }

    if (eventName === TableEventName.FoldEvent) {
      return {
        ok: true,
        startHand: false,
        nextWalletBalance: params.currentBalance,
        events: [
          {
            handId: hand.handId,
            eventName,
            payload: {
              ...payloadBase,
              remainingPlayers: hand.players.filter((entry) => entry.inHand)
                .length,
              isAuto: false,
            },
          },
        ],
      };
    }

    return {
      ok: true,
      startHand: false,
      nextWalletBalance: params.currentBalance,
      events: [
        {
          handId: hand.handId,
          eventName,
          payload: {
            ...payloadBase,
            amount,
            stackAfter: seat.stack,
            streetBetTo: hand.streetBetTo,
            isAllIn: seat.stack === 0,
          },
        },
      ],
    };
  }

  private canStartHand(table: TableState): boolean {
    if (table.currentHand !== null || table.status !== TableStatus.WAITING) {
      return false;
    }

    const eligibleSeats = table.seats.filter(
      (seat) => seat.status === SeatStatus.ACTIVE && seat.stack >= table.ante,
    );
    return eligibleSeats.length >= 2;
  }

  private startThirdStreet(table: TableState): PendingEvent[] {
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
    };

    const dealInitEvent: PendingEvent = {
      handId,
      eventName: TableEventName.DealInitEvent,
      payload: {
        handNo,
        gameType: table.gameType,
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

    const deck = createStandardDeck();
    const thirdStreetCards: Array<{
      seatNo: number;
      cards: Array<{
        position:
          | typeof ThirdStreetCardPosition.HOLE_1
          | typeof ThirdStreetCardPosition.HOLE_2
          | typeof ThirdStreetCardPosition.UP_3;
        visibility:
          | typeof CardVisibility.DOWN_HIDDEN
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
            visibility: CardVisibility.DOWN_HIDDEN,
            card: null,
          },
          {
            position: ThirdStreetCardPosition.HOLE_2,
            visibility: CardVisibility.DOWN_HIDDEN,
            card: null,
          },
          {
            position: ThirdStreetCardPosition.UP_3,
            visibility: CardVisibility.UP,
            card: up3,
          },
        ],
      });
    }

    const bringInSeatNo = this.determineBringInSeat(
      table.gameType,
      hand.players,
    );
    hand.bringInSeatNo = bringInSeatNo;

    const dealCards3rdEvent: PendingEvent = {
      handId,
      eventName: TableEventName.DealCards3rdEvent,
      payload: {
        street: Street.THIRD,
        bringInSeatNo,
        cards: thirdStreetCards,
      },
    };

    const bringInPlayer = hand.players.find(
      (player) => player.seatNo === bringInSeatNo,
    );
    const bringInSeat = table.seats.find(
      (seat) => seat.seatNo === bringInSeatNo,
    );
    if (!bringInPlayer || !bringInSeat) {
      table.currentHand = hand;
      return [dealInitEvent, postAnteEvent, dealCards3rdEvent];
    }

    const bringInAmount = Math.min(table.bringIn, bringInSeat.stack);
    bringInSeat.stack -= bringInAmount;
    bringInPlayer.totalContribution += bringInAmount;
    bringInPlayer.streetContribution += bringInAmount;
    bringInPlayer.actedThisRound = true;
    if (bringInSeat.stack === 0) {
      bringInPlayer.allIn = true;
    }

    hand.potTotal += bringInAmount;
    hand.streetBetTo = bringInAmount;

    const nextToActSeatNo = this.resolveNextToAct(hand, bringInSeatNo);
    hand.toActSeatNo = nextToActSeatNo;
    table.currentHand = hand;
    table.status = TableStatus.BETTING;

    const bringInEvent: PendingEvent = {
      handId,
      eventName: TableEventName.BringInEvent,
      payload: {
        street: Street.THIRD,
        seatNo: bringInSeatNo,
        amount: bringInAmount,
        stackAfter: bringInSeat.stack,
        potAfter: hand.potTotal,
        nextToActSeatNo,
        isAllIn: bringInSeat.stack === 0,
      },
    };

    return [dealInitEvent, postAnteEvent, dealCards3rdEvent, bringInEvent];
  }

  private determineBringInSeat(
    gameType: GameTypeType,
    players: HandPlayerState[],
  ): number {
    const gameRule = resolveGameRule(gameType);
    return gameRule.determineBringIn(
      players.map((player) => ({
        seatNo: player.seatNo,
        upCards: player.cardsUp,
        hasPairOnBoard: false,
      })),
    );
  }

  private resolveNextToAct(hand: HandState, fromSeatNo: number): number | null {
    const sorted = [...hand.players].sort(
      (left, right) => left.seatNo - right.seatNo,
    );
    const currentIndex = sorted.findIndex(
      (player) => player.seatNo === fromSeatNo,
    );
    if (currentIndex < 0) {
      return sorted[0]?.seatNo ?? null;
    }

    for (let offset = 1; offset <= sorted.length; offset += 1) {
      const candidate = sorted[(currentIndex + offset) % sorted.length];
      if (!candidate) {
        continue;
      }

      if (
        candidate.inHand &&
        !candidate.allIn &&
        (!candidate.actedThisRound ||
          candidate.streetContribution < hand.streetBetTo)
      ) {
        return candidate.seatNo;
      }
    }

    return null;
  }

  private fail(
    code: (typeof RealtimeErrorCode)[keyof typeof RealtimeErrorCode],
    message: string,
    requestId: string,
    tableId: string | null,
  ): { ok: false; error: TableServiceError } {
    return {
      ok: false,
      error: {
        code,
        message,
        requestId,
        tableId,
      },
    };
  }
}

export const createRealtimeTableService = (
  options: RealtimeTableServiceOptions = {},
): RealtimeTableService => new RealtimeTableService(options);
