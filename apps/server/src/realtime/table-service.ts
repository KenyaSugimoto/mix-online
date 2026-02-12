import { randomUUID } from "node:crypto";
import {
  type CardRank,
  type CardSuit,
  CardVisibility,
  GameType,
  type GameType as GameTypeType,
  HandStatus,
  RealtimeErrorCode,
  type RealtimeTableCommand,
  RealtimeTableCommandType,
  type RealtimeTableEventMessage,
  type RealtimeTableServiceFailure,
  type RealtimeTableServiceResult,
  type RealtimeTableServiceSuccess,
  type RealtimeTableState,
  SeatStateChangeAppliesFrom,
  SeatStateChangeReason,
  SeatStatus,
  Street,
  TableBuyIn,
  TableEventName,
  TableStatus,
  ThirdStreetCardPosition,
} from "@mix-online/shared";
import type { SessionUser } from "../auth-session";
import { createStandardDeck } from "../testing/fixed-deck-harness";
import {
  type TableActorRegistry,
  createTableActorRegistry,
} from "./table-actor";

type TableState = RealtimeTableState & {
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
};

type RealtimeTableServiceOptions = {
  actorRegistry?: TableActorRegistry;
};

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

type PendingEvent = DistributiveOmit<
  RealtimeTableEventMessage,
  "type" | "tableId" | "tableSeq" | "handSeq" | "occurredAt"
>;

type ApplyCommandSuccess = {
  ok: true;
  events: PendingEvent[];
  nextWalletBalance: number;
  startHand: boolean;
};

type ApplyCommandFailure = RealtimeTableServiceFailure;

type ApplyCommandResult = ApplyCommandSuccess | ApplyCommandFailure;

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
    command: RealtimeTableCommand;
    user: SessionUser;
    occurredAt: Date;
  }): Promise<RealtimeTableServiceResult> {
    const tableId = this.resolveTableId(params.command.payload);

    if (tableId === null) {
      const failure: RealtimeTableServiceFailure = {
        ok: false,
        error: {
          code: RealtimeErrorCode.INVALID_ACTION,
          message: "tableId は必須です。",
          tableId: null,
          requestId: params.command.requestId,
        },
      };
      return failure;
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
      const success: RealtimeTableServiceSuccess = {
        ok: true,
        tableId,
        events: outcome.events.map(
          (event) =>
            ({
              type: "table.event",
              tableId,
              tableSeq: allocateTableSeq(),
              handId: event.handId,
              handSeq: event.handId ? allocateHandSeq(event.handId) : null,
              occurredAt: params.occurredAt.toISOString(),
              eventName: event.eventName,
              payload: event.payload,
            }) as RealtimeTableEventMessage,
        ),
      };
      return success;
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
    command: RealtimeTableCommand;
    currentBalance: number;
    occurredAt: Date;
  }): ApplyCommandResult {
    const seat = params.table.seats.find(
      (entry) => entry.userId === params.user.userId,
    );

    if (params.command.type === RealtimeTableCommandType.JOIN) {
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
        buyIn < TableBuyIn.MIN ||
        buyIn > TableBuyIn.MAX
      ) {
        return this.fail(
          RealtimeErrorCode.BUYIN_OUT_OF_RANGE,
          `buyIn は ${TableBuyIn.MIN}〜${TableBuyIn.MAX} の整数で指定してください。`,
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

    if (params.command.type === RealtimeTableCommandType.SIT_OUT) {
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

    if (params.command.type === RealtimeTableCommandType.RETURN) {
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

    if (params.command.type === RealtimeTableCommandType.LEAVE) {
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

    return this.fail(
      RealtimeErrorCode.INVALID_ACTION,
      `${params.command.type} は未対応です。`,
      params.command.requestId,
      params.table.tableId,
    );
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
      player.streetContribution += ante;
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

    const bringInSeatNo = this.determineBringInSeat(hand.players);
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
    if (bringInSeat.stack === 0) {
      bringInPlayer.allIn = true;
    }

    hand.potTotal += bringInAmount;
    hand.streetBetTo = bringInAmount;

    const nextToActSeatNo = this.findNextSeatToAct(hand.players, bringInSeatNo);
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

  private determineBringInSeat(players: HandPlayerState[]): number {
    const rankValue = (rank: CardValue["rank"]): number => {
      if (rank === "A") return 14;
      if (rank === "K") return 13;
      if (rank === "Q") return 12;
      if (rank === "J") return 11;
      if (rank === "T") return 10;
      return Number.parseInt(rank, 10);
    };

    const suitWeakScore = (suit: CardValue["suit"]): number => {
      if (suit === "C") return 4;
      if (suit === "D") return 3;
      if (suit === "H") return 2;
      return 1;
    };

    const ordered = [...players].sort((left, right) => {
      const leftUp = left.cardsUp.at(0);
      const rightUp = right.cardsUp.at(0);
      if (!leftUp || !rightUp) {
        return left.seatNo - right.seatNo;
      }

      const byRank = rankValue(leftUp.rank) - rankValue(rightUp.rank);
      if (byRank !== 0) {
        return byRank;
      }

      return suitWeakScore(rightUp.suit) - suitWeakScore(leftUp.suit);
    });

    return ordered[0]?.seatNo ?? players[0]?.seatNo ?? 1;
  }

  private findNextSeatToAct(
    players: HandPlayerState[],
    fromSeatNo: number,
  ): number | null {
    const sorted = [...players].sort(
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

      if (candidate.inHand && !candidate.allIn) {
        return candidate.seatNo;
      }
    }

    return null;
  }

  private fail(
    code: RealtimeErrorCode,
    message: string,
    requestId: string,
    tableId: string | null,
  ): ApplyCommandFailure {
    const failure: ApplyCommandFailure = {
      ok: false,
      error: {
        code,
        message,
        requestId,
        tableId,
      },
    };
    return failure;
  }
}

export const createRealtimeTableService = (
  options: RealtimeTableServiceOptions = {},
): RealtimeTableService => new RealtimeTableService(options);
