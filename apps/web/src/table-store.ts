import {
  BettingStructure,
  CARD_RANKS,
  CARD_SLOTS,
  CARD_SUITS,
  CARD_VISIBILITIES,
  CardSlot,
  type CardVisibility,
  DEAL_END_REASONS,
  GAME_TYPES,
  HAND_STATUSES,
  HandStatus,
  MVP_TABLE_ACT_ACTIONS,
  REALTIME_ERROR_CODES,
  type RealtimeErrorCode,
  RealtimeTableCommandType,
  SEAT_STATE_CHANGE_APPLIES_FROM,
  SEAT_STATE_CHANGE_REASONS,
  SEAT_STATUSES,
  SNAPSHOT_REASONS,
  STREETS,
  STREET_ADVANCE_REASONS,
  SeatStatus,
  Street,
  TABLE_STATUSES,
  THIRD_STREET_CARD_POSITIONS,
  TableCommandAction,
  TableEventName,
  TableStatus,
  type ThirdStreetCardPosition,
} from "@mix-online/shared";
import type { CurrentHandSummary, TableDetail, TableSeat } from "./table-api";
import type { SeatCommandType } from "./table-control";

const DEFAULT_RECONNECT_DELAY_MS = 1_000;
const DEFAULT_RESUME_ACK_TIMEOUT_MS = 1_500;
const DEFAULT_ACTION_TIMEOUT_MS = 30_000;
const OPEN_READY_STATE = 1;

export const TableStoreConnectionStatus = {
  IDLE: "idle",
  CONNECTING: "connecting",
  OPEN: "open",
  RECONNECTING: "reconnecting",
  CLOSED: "closed",
} as const;
export type TableStoreConnectionStatus =
  (typeof TableStoreConnectionStatus)[keyof typeof TableStoreConnectionStatus];

export const TableStoreSyncStatus = {
  IDLE: "idle",
  RESYNCING: "resyncing",
  IN_SYNC: "in_sync",
} as const;
export type TableStoreSyncStatus =
  (typeof TableStoreSyncStatus)[keyof typeof TableStoreSyncStatus];

type TableStoreCard = {
  slot: CardSlot;
  visibility: CardVisibility;
  card: {
    rank: (typeof CARD_RANKS)[number];
    suit: (typeof CARD_SUITS)[number];
  } | null;
};

export type TableStoreCardsBySeatNo = Record<number, TableStoreCard[]>;

export type TableStoreEventLogEntry =
  | {
      kind: "seat_state_changed";
      occurredAt: string;
      seatNo: number;
      previousStatus: (typeof SEAT_STATUSES)[number];
      currentStatus: (typeof SEAT_STATUSES)[number];
      reason: (typeof SEAT_STATE_CHANGE_REASONS)[number];
      appliesFrom: (typeof SEAT_STATE_CHANGE_APPLIES_FROM)[number];
    }
  | {
      kind: "street_advance";
      occurredAt: string;
      fromStreet: (typeof STREETS)[number];
      toStreet: (typeof STREETS)[number] | null;
      reason: (typeof STREET_ADVANCE_REASONS)[number];
    };

export type TableStoreLastAction = {
  occurredAt: string;
  seatNo: number;
  action: TableCommandAction;
};

export type TableStoreLastActionBySeatNo = Partial<
  Record<number, TableStoreLastAction>
>;

export type TableStoreLatestDealEndSummary = {
  occurredAt: string;
  endReason: (typeof DEAL_END_REASONS)[number] | null;
  finalPot: number;
  results: Array<{
    seatNo: number;
    delta: number;
    stackAfter: number;
  }>;
  winnerSeatNos: number[];
};

export type TableStoreState = {
  table: TableDetail;
  tableSeq: number;
  cardsBySeatNo: TableStoreCardsBySeatNo;
  eventLogs: TableStoreEventLogEntry[];
  lastActionBySeatNo: TableStoreLastActionBySeatNo;
  latestDealEndSummary: TableStoreLatestDealEndSummary | null;
  connectionStatus: TableStoreConnectionStatus;
  syncStatus: TableStoreSyncStatus;
  lastErrorCode: RealtimeErrorCode | null;
  lastErrorMessage: string | null;
};

export type TableStoreSnapshot = TableStoreState;
type TableStoreListener = (state: TableStoreSnapshot) => void;

type WebSocketLike = {
  readyState: number;
  onopen: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  send: (body: string) => void;
  close: () => void;
};

type CreateWebSocket = (url: string) => WebSocketLike;

type TimerId = ReturnType<typeof setTimeout>;
type SetTimeoutLike = (callback: () => void, timeoutMs: number) => TimerId;
type ClearTimeoutLike = (timerId: TimerId) => void;

export type TableStoreOptions = {
  tableId: string;
  initialTable: TableDetail;
  currentUserId?: string;
  wsUrl?: string;
  reconnectDelayMs?: number;
  resumeAckTimeoutMs?: number;
  createWebSocket?: CreateWebSocket;
  randomUUID?: () => string;
  now?: () => Date;
  setTimeoutFn?: SetTimeoutLike;
  clearTimeoutFn?: ClearTimeoutLike;
};

type TableEventMessage = {
  type: "table.event";
  tableId: string;
  tableSeq: number;
  handId: string | null;
  handSeq: number | null;
  occurredAt: string;
  eventName: string;
  payload: Record<string, unknown>;
};

type TableSnapshotSeat = {
  seatNo: number;
  status: (typeof SEAT_STATUSES)[number];
  stack: number;
  disconnectStreak: number;
  user: {
    userId: string;
    displayName: string;
  } | null;
};

type TableSnapshotHand = {
  handId: string;
  handNo: number;
  status: (typeof HAND_STATUSES)[number];
  street: (typeof Street)[keyof typeof Street];
  potTotal: number;
  streetBetTo: number;
  raiseCount: number;
  toActSeatNo: number | null;
  actionDeadlineAt: string | null;
  cards: Array<{
    seatNo: number;
    cards: Array<{
      slot: (typeof CARD_SLOTS)[number];
      visibility: (typeof CARD_VISIBILITIES)[number];
      card: {
        rank: (typeof CARD_RANKS)[number];
        suit: (typeof CARD_SUITS)[number];
      } | null;
    }>;
  }>;
};

type TableSnapshotMessage = {
  type: "table.snapshot";
  tableId: string;
  tableSeq: number;
  occurredAt: string;
  payload: {
    reason: (typeof SNAPSHOT_REASONS)[number];
    table: {
      status: (typeof TABLE_STATUSES)[number];
      gameType: (typeof GAME_TYPES)[number];
      stakes: {
        smallBet: number;
        bigBet: number;
        ante: number;
        bringIn: number;
      };
      seats: TableSnapshotSeat[];
      currentHand: TableSnapshotHand | null;
      dealerSeatNo: number;
      mixIndex: number;
      handsSinceRotation: number;
    };
  };
};

type TableErrorMessage = {
  type: "table.error";
  requestId: string | null;
  tableId: string | null;
  code: RealtimeErrorCode;
  message: string;
  occurredAt: string;
};

type PongMessage = {
  type: "pong";
  requestId: string;
  occurredAt: string;
};

type WsMessage =
  | TableEventMessage
  | TableSnapshotMessage
  | TableErrorMessage
  | PongMessage;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value);

const isNonNegativeInteger = (value: unknown): value is number =>
  isInteger(value) && value >= 0;

const isString = (value: unknown): value is string => typeof value === "string";

const isNullableString = (value: unknown): value is string | null =>
  value === null || isString(value);

const isNullableInteger = (value: unknown): value is number | null =>
  value === null || isInteger(value);

const isEnumValue = <T extends readonly string[]>(
  value: unknown,
  values: T,
): value is T[number] => isString(value) && values.includes(value as T[number]);

const resolvePayloadActionDeadlineAt = (payload: Record<string, unknown>) => {
  const actionDeadlineAt = payload.actionDeadlineAt;
  return isString(actionDeadlineAt) ? actionDeadlineAt : null;
};

const resolveActionDeadlineAt = (params: {
  toActSeatNo: number | null;
  payloadActionDeadlineAt: string | null;
  occurredAt: string;
}) => {
  if (params.toActSeatNo === null) {
    return null;
  }

  if (params.payloadActionDeadlineAt !== null) {
    return params.payloadActionDeadlineAt;
  }

  const occurredAtMs = new Date(params.occurredAt).getTime();
  if (Number.isNaN(occurredAtMs)) {
    return null;
  }

  return new Date(occurredAtMs + DEFAULT_ACTION_TIMEOUT_MS).toISOString();
};

const isCardValue = (
  value: unknown,
): value is {
  rank: (typeof CARD_RANKS)[number];
  suit: (typeof CARD_SUITS)[number];
} =>
  isRecord(value) &&
  isEnumValue(value.rank, CARD_RANKS) &&
  isEnumValue(value.suit, CARD_SUITS);

const parseJsonMessage = (raw: string): WsMessage | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || !isString(parsed.type)) {
    return null;
  }

  if (parsed.type === "table.event") {
    if (
      isString(parsed.tableId) &&
      isNonNegativeInteger(parsed.tableSeq) &&
      isNullableString(parsed.handId) &&
      isNullableInteger(parsed.handSeq) &&
      isString(parsed.occurredAt) &&
      isString(parsed.eventName) &&
      isRecord(parsed.payload)
    ) {
      return parsed as TableEventMessage;
    }
    return null;
  }

  if (parsed.type === "table.snapshot") {
    const payload = parsed.payload;
    if (
      !isString(parsed.tableId) ||
      !isNonNegativeInteger(parsed.tableSeq) ||
      !isString(parsed.occurredAt) ||
      !isRecord(payload) ||
      !isEnumValue(payload.reason, SNAPSHOT_REASONS) ||
      !isRecord(payload.table)
    ) {
      return null;
    }

    const snapshotTable = payload.table;
    if (
      !isEnumValue(snapshotTable.status, TABLE_STATUSES) ||
      !isEnumValue(snapshotTable.gameType, GAME_TYPES) ||
      !isRecord(snapshotTable.stakes) ||
      !Array.isArray(snapshotTable.seats) ||
      !isInteger(snapshotTable.dealerSeatNo) ||
      !isInteger(snapshotTable.mixIndex) ||
      !isInteger(snapshotTable.handsSinceRotation)
    ) {
      return null;
    }

    if (
      !isInteger(snapshotTable.stakes.smallBet) ||
      !isInteger(snapshotTable.stakes.bigBet) ||
      !isInteger(snapshotTable.stakes.ante) ||
      !isInteger(snapshotTable.stakes.bringIn)
    ) {
      return null;
    }

    const hasValidSeats = snapshotTable.seats.every((seat) => {
      if (!isRecord(seat)) {
        return false;
      }
      if (
        !isInteger(seat.seatNo) ||
        !isEnumValue(seat.status, SEAT_STATUSES) ||
        !isInteger(seat.stack) ||
        !isNonNegativeInteger(seat.disconnectStreak)
      ) {
        return false;
      }
      if (seat.user === null) {
        return true;
      }
      return (
        isRecord(seat.user) &&
        isString(seat.user.userId) &&
        isString(seat.user.displayName)
      );
    });
    if (!hasValidSeats) {
      return null;
    }

    if (snapshotTable.currentHand === null) {
      return parsed as TableSnapshotMessage;
    }

    if (
      !isRecord(snapshotTable.currentHand) ||
      !isString(snapshotTable.currentHand.handId) ||
      !isInteger(snapshotTable.currentHand.handNo) ||
      !isEnumValue(snapshotTable.currentHand.status, HAND_STATUSES) ||
      !isEnumValue(snapshotTable.currentHand.street, STREETS) ||
      !isInteger(snapshotTable.currentHand.potTotal) ||
      !isInteger(snapshotTable.currentHand.streetBetTo) ||
      !isInteger(snapshotTable.currentHand.raiseCount) ||
      !isNullableInteger(snapshotTable.currentHand.toActSeatNo) ||
      !isNullableString(snapshotTable.currentHand.actionDeadlineAt) ||
      !Array.isArray(snapshotTable.currentHand.cards)
    ) {
      return null;
    }

    const hasValidCurrentHandCards = snapshotTable.currentHand.cards.every(
      (seatCards) => {
        if (!isRecord(seatCards) || !isInteger(seatCards.seatNo)) {
          return false;
        }
        if (!Array.isArray(seatCards.cards)) {
          return false;
        }
        return seatCards.cards.every((cardView) => {
          if (!isRecord(cardView)) {
            return false;
          }
          if (
            !isEnumValue(cardView.slot, CARD_SLOTS) ||
            !isEnumValue(cardView.visibility, CARD_VISIBILITIES)
          ) {
            return false;
          }
          return cardView.card === null || isCardValue(cardView.card);
        });
      },
    );
    if (!hasValidCurrentHandCards) {
      return null;
    }

    return parsed as TableSnapshotMessage;
  }

  if (parsed.type === "table.error") {
    if (
      isNullableString(parsed.requestId) &&
      isNullableString(parsed.tableId) &&
      isEnumValue(parsed.code, REALTIME_ERROR_CODES) &&
      isString(parsed.message) &&
      isString(parsed.occurredAt)
    ) {
      return parsed as TableErrorMessage;
    }
    return null;
  }

  if (parsed.type === "pong") {
    if (isString(parsed.requestId) && isString(parsed.occurredAt)) {
      return parsed as PongMessage;
    }
    return null;
  }

  return null;
};

const resolveWsUrl = () => {
  const explicitWsUrl = import.meta.env.VITE_WS_URL;
  if (typeof explicitWsUrl === "string" && explicitWsUrl.length > 0) {
    return explicitWsUrl;
  }

  if (typeof window === "undefined") {
    return "ws://localhost:3000/ws";
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
};

const resolveMessageText = (data: unknown): string | null => {
  if (typeof data === "string") {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }
  return null;
};

const resolveCurrentUserId = (table: TableDetail) =>
  table.seats.find((seat) => seat.isYou && seat.userId !== null)?.userId ??
  null;

const normalizeTableForCurrentUser = (
  table: TableDetail,
  currentUserId: string | null,
): TableDetail => ({
  ...table,
  seats: table.seats.map((seat) => ({
    ...seat,
    isYou:
      currentUserId !== null &&
      seat.userId !== null &&
      seat.userId === currentUserId,
  })),
});

const normalizeTableCurrentHandDeadline = (
  table: TableDetail,
  occurredAt: string,
): TableDetail => {
  if (table.currentHand === null) {
    return table;
  }

  return {
    ...table,
    currentHand: {
      ...table.currentHand,
      actionDeadlineAt: resolveActionDeadlineAt({
        toActSeatNo: table.currentHand.toActSeatNo,
        payloadActionDeadlineAt: table.currentHand.actionDeadlineAt,
        occurredAt,
      }),
    },
  };
};

const updateSeat = (
  table: TableDetail,
  seatNo: number,
  updater: (seat: TableSeat) => TableSeat,
): TableDetail => {
  const index = table.seats.findIndex((seat) => seat.seatNo === seatNo);
  if (index < 0) {
    return table;
  }
  const currentSeat = table.seats[index];
  if (!currentSeat) {
    return table;
  }

  const nextSeat = updater(currentSeat);
  if (nextSeat === currentSeat) {
    return table;
  }

  const nextSeats = [...table.seats];
  nextSeats[index] = nextSeat;
  return {
    ...table,
    seats: nextSeats,
  };
};

const formatStakesDisplay = (smallBet: number, bigBet: number) =>
  `$${smallBet}/$${bigBet} Fixed Limit`;

const MAX_EVENT_LOG_COUNT = 40;

const mapSnapshotCardsBySeatNo = (
  hand: TableSnapshotHand | null,
): TableStoreCardsBySeatNo => {
  if (hand === null) {
    return {};
  }

  return hand.cards.reduce<TableStoreCardsBySeatNo>((acc, seatCards) => {
    acc[seatCards.seatNo] = seatCards.cards.map((cardView) => ({
      slot: cardView.slot,
      visibility: cardView.visibility,
      card: cardView.card
        ? {
            rank: cardView.card.rank,
            suit: cardView.card.suit,
          }
        : null,
    }));
    return acc;
  }, {});
};

const pushEventLog = (
  current: TableStoreEventLogEntry[],
  entry: TableStoreEventLogEntry | null,
) => {
  if (entry === null) {
    return current;
  }
  const next = [...current, entry];
  if (next.length <= MAX_EVENT_LOG_COUNT) {
    return next;
  }
  return next.slice(next.length - MAX_EVENT_LOG_COUNT);
};

const buildEventLog = (
  event: TableEventMessage,
): TableStoreEventLogEntry | null => {
  if (event.eventName === TableEventName.SeatStateChangedEvent) {
    const payload = event.payload;
    if (
      isInteger(payload.seatNo) &&
      isEnumValue(payload.previousStatus, SEAT_STATUSES) &&
      isEnumValue(payload.currentStatus, SEAT_STATUSES) &&
      isEnumValue(payload.reason, SEAT_STATE_CHANGE_REASONS) &&
      isEnumValue(payload.appliesFrom, SEAT_STATE_CHANGE_APPLIES_FROM)
    ) {
      return {
        kind: "seat_state_changed",
        occurredAt: event.occurredAt,
        seatNo: payload.seatNo,
        previousStatus: payload.previousStatus,
        currentStatus: payload.currentStatus,
        reason: payload.reason,
        appliesFrom: payload.appliesFrom,
      };
    }
  }

  if (event.eventName === TableEventName.StreetAdvanceEvent) {
    const payload = event.payload;
    if (
      isEnumValue(payload.fromStreet, STREETS) &&
      (payload.toStreet === null || isEnumValue(payload.toStreet, STREETS)) &&
      isEnumValue(payload.reason, STREET_ADVANCE_REASONS)
    ) {
      return {
        kind: "street_advance",
        occurredAt: event.occurredAt,
        fromStreet: payload.fromStreet,
        toStreet: payload.toStreet,
        reason: payload.reason,
      };
    }
  }

  return null;
};

const resolveLastAction = (
  event: TableEventMessage,
): TableStoreLastAction | null => {
  const payload = event.payload;

  if (
    event.eventName === TableEventName.BringInEvent &&
    isBringInPayload(payload)
  ) {
    return {
      occurredAt: event.occurredAt,
      seatNo: payload.seatNo,
      action: TableCommandAction.BRING_IN,
    };
  }

  if (
    event.eventName === TableEventName.CompleteEvent &&
    isChipActionPayload(payload)
  ) {
    return {
      occurredAt: event.occurredAt,
      seatNo: payload.seatNo,
      action: TableCommandAction.COMPLETE,
    };
  }

  if (
    event.eventName === TableEventName.BetEvent &&
    isChipActionPayload(payload)
  ) {
    return {
      occurredAt: event.occurredAt,
      seatNo: payload.seatNo,
      action: TableCommandAction.BET,
    };
  }

  if (
    event.eventName === TableEventName.RaiseEvent &&
    isChipActionPayload(payload)
  ) {
    return {
      occurredAt: event.occurredAt,
      seatNo: payload.seatNo,
      action: TableCommandAction.RAISE,
    };
  }

  if (
    event.eventName === TableEventName.CallEvent &&
    isChipActionPayload(payload)
  ) {
    return {
      occurredAt: event.occurredAt,
      seatNo: payload.seatNo,
      action: TableCommandAction.CALL,
    };
  }

  if (
    event.eventName === TableEventName.CheckEvent &&
    isActionPayload(payload)
  ) {
    return {
      occurredAt: event.occurredAt,
      seatNo: payload.seatNo,
      action: TableCommandAction.CHECK,
    };
  }

  if (
    event.eventName === TableEventName.FoldEvent &&
    isActionPayload(payload)
  ) {
    return {
      occurredAt: event.occurredAt,
      seatNo: payload.seatNo,
      action: TableCommandAction.FOLD,
    };
  }

  return null;
};

const mapStreetToSlot = (street: (typeof STREETS)[number]): CardSlot | null => {
  if (street === Street.FOURTH) {
    return CardSlot.UP_4;
  }
  if (street === Street.FIFTH) {
    return CardSlot.UP_5;
  }
  if (street === Street.SIXTH) {
    return CardSlot.UP_6;
  }
  if (street === Street.SEVENTH) {
    return CardSlot.DOWN_7;
  }
  return null;
};

const mapSnapshotTable = (
  current: TableDetail,
  snapshot: TableSnapshotMessage,
  currentUserId: string | null,
) => {
  const nextSeats = snapshot.payload.table.seats.map((seat) => {
    const existing = current.seats.find(
      (candidate) => candidate.seatNo === seat.seatNo,
    );
    const userId = seat.user?.userId ?? null;
    const displayName = seat.user?.displayName ?? null;

    return {
      seatNo: seat.seatNo,
      status: seat.status,
      userId,
      displayName,
      stack: seat.stack,
      isYou:
        userId !== null && currentUserId !== null && userId === currentUserId,
      joinedAt:
        existing && existing.userId === userId && userId !== null
          ? existing.joinedAt
          : null,
      disconnectStreak: seat.disconnectStreak,
    };
  });

  return {
    ...current,
    status: snapshot.payload.table.status,
    gameType: snapshot.payload.table.gameType,
    mixIndex: snapshot.payload.table.mixIndex,
    handsSinceRotation: snapshot.payload.table.handsSinceRotation,
    dealerSeatNo: snapshot.payload.table.dealerSeatNo,
    stakes: {
      smallBet: snapshot.payload.table.stakes.smallBet,
      bigBet: snapshot.payload.table.stakes.bigBet,
      ante: snapshot.payload.table.stakes.ante,
      bringIn: snapshot.payload.table.stakes.bringIn,
      bettingStructure:
        current.stakes.bettingStructure ?? BettingStructure.FIXED_LIMIT,
      display: formatStakesDisplay(
        snapshot.payload.table.stakes.smallBet,
        snapshot.payload.table.stakes.bigBet,
      ),
    },
    seats: nextSeats,
    currentHand: snapshot.payload.table.currentHand
      ? {
          toActSeatNo: snapshot.payload.table.currentHand.toActSeatNo,
          actionDeadlineAt: resolveActionDeadlineAt({
            toActSeatNo: snapshot.payload.table.currentHand.toActSeatNo,
            payloadActionDeadlineAt:
              snapshot.payload.table.currentHand.actionDeadlineAt,
            occurredAt: snapshot.occurredAt,
          }),
          handId: snapshot.payload.table.currentHand.handId,
          handNo: snapshot.payload.table.currentHand.handNo,
          status: snapshot.payload.table.currentHand.status,
          street: snapshot.payload.table.currentHand.street,
          potTotal: snapshot.payload.table.currentHand.potTotal,
          streetBetTo: snapshot.payload.table.currentHand.streetBetTo,
          raiseCount: snapshot.payload.table.currentHand.raiseCount,
        }
      : null,
  } satisfies TableDetail;
};

const mergeCurrentHand = (
  table: TableDetail,
  patch: Partial<CurrentHandSummary>,
  fallbackHandId: string | null,
) => {
  if (table.currentHand === null) {
    if (!fallbackHandId) {
      return table;
    }
    return {
      ...table,
      currentHand: {
        handId: fallbackHandId,
        handNo: 0,
        status: HandStatus.IN_PROGRESS,
        street: Street.THIRD,
        potTotal: 0,
        streetBetTo: 0,
        raiseCount: 0,
        toActSeatNo: null,
        actionDeadlineAt: null,
        ...patch,
      },
    };
  }

  return {
    ...table,
    currentHand: {
      ...table.currentHand,
      ...patch,
    },
  };
};

type SeatStateChangedPayload = {
  seatNo: number;
  currentStatus: (typeof SEAT_STATUSES)[number];
  stack: number;
  user: { userId: string; displayName: string } | null;
};

type PlayerDisconnectedPayload = {
  seatNo: number;
  seatStatus: (typeof SEAT_STATUSES)[number];
  disconnectStreak: number;
};

type PlayerReconnectedPayload = {
  seatNo: number;
  restoredSeatStatus: (typeof SEAT_STATUSES)[number];
  disconnectStreakResetTo: number;
};

type DealInitPayload = {
  handNo: number;
  gameType: (typeof GAME_TYPES)[number];
  dealerSeatNo: number;
  mixIndex: number;
  handsSinceRotation: number;
  stakes: {
    smallBet: number;
    bigBet: number;
    ante: number;
    bringIn: number;
  };
  participants?: Array<{ seatNo: number; startStack: number }>;
};

type PostAntePayload = {
  street: (typeof STREETS)[number];
  potAfter: number;
  contributions?: Array<{ seatNo: number; stackAfter: number }>;
};

type DealCards3rdPayload = {
  bringInSeatNo: number;
  cards: Array<{
    seatNo: number;
    cards: Array<{
      position: (typeof ThirdStreetCardPosition)[keyof typeof ThirdStreetCardPosition];
      visibility: (typeof CARD_VISIBILITIES)[number];
      card: {
        rank: (typeof CARD_RANKS)[number];
        suit: (typeof CARD_SUITS)[number];
      } | null;
    }>;
  }>;
};

type ActionPayload = {
  street: (typeof STREETS)[number];
  seatNo: number;
  potAfter: number;
  nextToActSeatNo: number | null;
};

type BringInPayload = ActionPayload & {
  amount: number;
  stackAfter: number;
};

type ChipActionPayload = ActionPayload & {
  stackAfter: number;
  streetBetTo: number;
  raiseCount: number;
};

type DealCardPayload = {
  street: (typeof STREETS)[number];
  cards: Array<{
    seatNo: number;
    visibility: (typeof CARD_VISIBILITIES)[number];
    card: {
      rank: (typeof CARD_RANKS)[number];
      suit: (typeof CARD_SUITS)[number];
    } | null;
  }>;
  toActSeatNo: number | null;
  potAfter: number;
};

type StreetAdvancePayload = {
  fromStreet: (typeof STREETS)[number];
  toStreet: (typeof STREETS)[number] | null;
  potTotal: number;
  nextToActSeatNo: number | null;
  tableStatus:
    | typeof TableStatus.BETTING
    | typeof TableStatus.SHOWDOWN
    | typeof TableStatus.HAND_END;
  reason: (typeof STREET_ADVANCE_REASONS)[number];
};

type ShowdownPayload = {
  hasShowdown: boolean;
};

type DealEndPayload = {
  endReason?: (typeof DEAL_END_REASONS)[number];
  finalPot: number;
  nextDealerSeatNo: number;
  nextGameType: (typeof GAME_TYPES)[number];
  mixIndex: number;
  handsSinceRotation: number;
  results: Array<{
    seatNo: number;
    delta?: number;
    stackAfter: number;
  }>;
};

const isSeatStateChangedPayload = (
  payload: Record<string, unknown>,
): payload is SeatStateChangedPayload =>
  isInteger(payload.seatNo) &&
  isEnumValue(payload.currentStatus, SEAT_STATUSES) &&
  isInteger(payload.stack) &&
  (payload.user === null ||
    (isRecord(payload.user) &&
      isString(payload.user.userId) &&
      isString(payload.user.displayName)));

const isPlayerDisconnectedPayload = (
  payload: Record<string, unknown>,
): payload is PlayerDisconnectedPayload =>
  isInteger(payload.seatNo) &&
  isEnumValue(payload.seatStatus, SEAT_STATUSES) &&
  isNonNegativeInteger(payload.disconnectStreak);

const isPlayerReconnectedPayload = (
  payload: Record<string, unknown>,
): payload is PlayerReconnectedPayload =>
  isInteger(payload.seatNo) &&
  isEnumValue(payload.restoredSeatStatus, SEAT_STATUSES) &&
  isNonNegativeInteger(payload.disconnectStreakResetTo);

const isDealInitPayload = (
  payload: Record<string, unknown>,
): payload is DealInitPayload => {
  const stakes = payload.stakes;
  return (
    isInteger(payload.handNo) &&
    isEnumValue(payload.gameType, GAME_TYPES) &&
    isInteger(payload.dealerSeatNo) &&
    isInteger(payload.mixIndex) &&
    isInteger(payload.handsSinceRotation) &&
    isRecord(stakes) &&
    isInteger(stakes.smallBet) &&
    isInteger(stakes.bigBet) &&
    isInteger(stakes.ante) &&
    isInteger(stakes.bringIn)
  );
};

const isPostAntePayload = (
  payload: Record<string, unknown>,
): payload is PostAntePayload =>
  isEnumValue(payload.street, STREETS) && isInteger(payload.potAfter);

const isDealCards3rdPayload = (
  payload: Record<string, unknown>,
): payload is DealCards3rdPayload => {
  if (!isInteger(payload.bringInSeatNo) || !Array.isArray(payload.cards)) {
    return false;
  }
  return payload.cards.every((seatCards) => {
    if (!isRecord(seatCards) || !isInteger(seatCards.seatNo)) {
      return false;
    }
    if (!Array.isArray(seatCards.cards)) {
      return false;
    }
    return seatCards.cards.every((cardView) => {
      if (!isRecord(cardView)) {
        return false;
      }
      if (
        !isEnumValue(cardView.position, THIRD_STREET_CARD_POSITIONS) ||
        !isEnumValue(cardView.visibility, CARD_VISIBILITIES)
      ) {
        return false;
      }
      return cardView.card === null || isCardValue(cardView.card);
    });
  });
};

const isBringInPayload = (
  payload: Record<string, unknown>,
): payload is BringInPayload =>
  isEnumValue(payload.street, STREETS) &&
  isInteger(payload.seatNo) &&
  isInteger(payload.amount) &&
  isInteger(payload.potAfter) &&
  isNullableInteger(payload.nextToActSeatNo) &&
  isInteger(payload.stackAfter);

const isActionPayload = (
  payload: Record<string, unknown>,
): payload is ActionPayload =>
  isEnumValue(payload.street, STREETS) &&
  isInteger(payload.seatNo) &&
  isInteger(payload.potAfter) &&
  isNullableInteger(payload.nextToActSeatNo);

const isChipActionPayload = (
  payload: Record<string, unknown>,
): payload is ChipActionPayload => {
  const stackAfter = payload.stackAfter;
  const streetBetTo = payload.streetBetTo;
  const raiseCount = payload.raiseCount;
  return (
    isActionPayload(payload) &&
    isInteger(stackAfter) &&
    isInteger(streetBetTo) &&
    isInteger(raiseCount)
  );
};

const isDealCardPayload = (
  payload: Record<string, unknown>,
): payload is DealCardPayload => {
  if (
    !isEnumValue(payload.street, STREETS) ||
    !Array.isArray(payload.cards) ||
    !isNullableInteger(payload.toActSeatNo) ||
    !isInteger(payload.potAfter)
  ) {
    return false;
  }
  return payload.cards.every((cardView) => {
    if (!isRecord(cardView)) {
      return false;
    }
    if (
      !isInteger(cardView.seatNo) ||
      !isEnumValue(cardView.visibility, CARD_VISIBILITIES)
    ) {
      return false;
    }
    return cardView.card === null || isCardValue(cardView.card);
  });
};

const isStreetAdvancePayload = (
  payload: Record<string, unknown>,
): payload is StreetAdvancePayload =>
  isEnumValue(payload.fromStreet, STREETS) &&
  (payload.toStreet === null || isEnumValue(payload.toStreet, STREETS)) &&
  isInteger(payload.potTotal) &&
  isNullableInteger(payload.nextToActSeatNo) &&
  (payload.tableStatus === TableStatus.BETTING ||
    payload.tableStatus === TableStatus.SHOWDOWN ||
    payload.tableStatus === TableStatus.HAND_END) &&
  isEnumValue(payload.reason, STREET_ADVANCE_REASONS);

const isShowdownPayload = (
  payload: Record<string, unknown>,
): payload is ShowdownPayload => payload.hasShowdown === true;

const isDealEndPayload = (
  payload: Record<string, unknown>,
): payload is DealEndPayload => {
  if (
    !isInteger(payload.finalPot) ||
    !isInteger(payload.nextDealerSeatNo) ||
    !isEnumValue(payload.nextGameType, GAME_TYPES) ||
    !isInteger(payload.mixIndex) ||
    !isInteger(payload.handsSinceRotation) ||
    !Array.isArray(payload.results)
  ) {
    return false;
  }

  if (
    payload.endReason !== undefined &&
    !isEnumValue(payload.endReason, DEAL_END_REASONS)
  ) {
    return false;
  }

  return payload.results.every((result) => {
    if (
      !isRecord(result) ||
      !isInteger(result.seatNo) ||
      !isInteger(result.stackAfter)
    ) {
      return false;
    }
    return result.delta === undefined || isInteger(result.delta);
  });
};

const cloneCardsBySeatNo = (
  cardsBySeatNo: TableStoreCardsBySeatNo,
): TableStoreCardsBySeatNo =>
  Object.fromEntries(
    Object.entries(cardsBySeatNo).map(([seatNo, cards]) => [
      Number(seatNo),
      cards.map((card) => ({
        slot: card.slot,
        visibility: card.visibility,
        card: card.card
          ? {
              rank: card.card.rank,
              suit: card.card.suit,
            }
          : null,
      })),
    ]),
  );

const cloneLastActionBySeatNo = (
  lastActionBySeatNo: TableStoreLastActionBySeatNo,
): TableStoreLastActionBySeatNo =>
  Object.fromEntries(
    Object.entries(lastActionBySeatNo).map(([seatNo, action]) => [
      Number(seatNo),
      action ? { ...action } : action,
    ]),
  );

const cloneLatestDealEndSummary = (
  summary: TableStoreLatestDealEndSummary | null,
): TableStoreLatestDealEndSummary | null => {
  if (summary === null) {
    return null;
  }
  return {
    ...summary,
    results: summary.results.map((result) => ({ ...result })),
    winnerSeatNos: [...summary.winnerSeatNos],
  };
};

const resolveLatestDealEndSummary = (
  event: TableEventMessage,
): TableStoreLatestDealEndSummary | null => {
  if (event.eventName !== TableEventName.DealEndEvent) {
    return null;
  }
  if (!isDealEndPayload(event.payload)) {
    return null;
  }

  const results = event.payload.results.map((result) => ({
    seatNo: result.seatNo,
    delta: result.delta ?? 0,
    stackAfter: result.stackAfter,
  }));
  const winnerSeatNos = results
    .filter((result) => result.delta > 0)
    .sort((left, right) =>
      left.delta === right.delta
        ? left.seatNo - right.seatNo
        : right.delta - left.delta,
    )
    .map((result) => result.seatNo);

  return {
    occurredAt: event.occurredAt,
    endReason: event.payload.endReason ?? null,
    finalPot: event.payload.finalPot,
    results,
    winnerSeatNos,
  };
};

const applyEventToCardsBySeatNo = (
  cardsBySeatNo: TableStoreCardsBySeatNo,
  event: TableEventMessage,
): TableStoreCardsBySeatNo => {
  const payload = event.payload;

  if (event.eventName === TableEventName.DealInitEvent) {
    return {};
  }

  if (
    event.eventName === TableEventName.DealCards3rdEvent &&
    isDealCards3rdPayload(payload)
  ) {
    return payload.cards.reduce<TableStoreCardsBySeatNo>((acc, seatCards) => {
      acc[seatCards.seatNo] = seatCards.cards.map((cardView) => ({
        slot: cardView.position,
        visibility: cardView.visibility,
        card: cardView.card
          ? {
              rank: cardView.card.rank,
              suit: cardView.card.suit,
            }
          : null,
      }));
      return acc;
    }, {});
  }

  if (
    event.eventName === TableEventName.DealCardEvent &&
    isDealCardPayload(payload)
  ) {
    const slot = mapStreetToSlot(payload.street);
    if (slot === null) {
      return cardsBySeatNo;
    }
    const next = cloneCardsBySeatNo(cardsBySeatNo);
    for (const cardView of payload.cards) {
      const existing = next[cardView.seatNo] ?? [];
      next[cardView.seatNo] = [
        ...existing,
        {
          slot,
          visibility: cardView.visibility,
          card: cardView.card
            ? {
                rank: cardView.card.rank,
                suit: cardView.card.suit,
              }
            : null,
        },
      ];
    }
    return next;
  }

  return cardsBySeatNo;
};

const applyEventToTable = (
  table: TableDetail,
  event: TableEventMessage,
  currentUserId: string | null,
) => {
  const payload = event.payload;
  const payloadActionDeadlineAt = resolvePayloadActionDeadlineAt(payload);

  if (
    event.eventName === TableEventName.SeatStateChangedEvent &&
    isSeatStateChangedPayload(payload)
  ) {
    const user = payload.user;
    return updateSeat(table, payload.seatNo, (seat) => {
      const userId = user?.userId ?? null;
      const displayName = user?.displayName ?? null;
      return {
        ...seat,
        status: payload.currentStatus,
        userId,
        displayName,
        stack: payload.stack,
        isYou:
          userId !== null && currentUserId !== null && userId === currentUserId,
        joinedAt:
          payload.currentStatus === SeatStatus.EMPTY
            ? null
            : userId !== null && seat.userId === userId
              ? seat.joinedAt
              : event.occurredAt,
      };
    });
  }

  if (
    event.eventName === TableEventName.PlayerDisconnectedEvent &&
    isPlayerDisconnectedPayload(payload)
  ) {
    return updateSeat(table, payload.seatNo, (seat) => ({
      ...seat,
      status: payload.seatStatus,
      disconnectStreak: payload.disconnectStreak,
    }));
  }

  if (
    event.eventName === TableEventName.PlayerReconnectedEvent &&
    isPlayerReconnectedPayload(payload)
  ) {
    return updateSeat(table, payload.seatNo, (seat) => ({
      ...seat,
      status: payload.restoredSeatStatus,
      disconnectStreak: payload.disconnectStreakResetTo,
    }));
  }

  if (
    event.eventName === TableEventName.DealInitEvent &&
    isDealInitPayload(payload)
  ) {
    if (!event.handId) {
      return table;
    }

    let next: TableDetail = {
      ...table,
      status: TableStatus.DEALING,
      gameType: payload.gameType,
      dealerSeatNo: payload.dealerSeatNo,
      mixIndex: payload.mixIndex,
      handsSinceRotation: payload.handsSinceRotation,
      stakes: {
        ...table.stakes,
        smallBet: payload.stakes.smallBet,
        bigBet: payload.stakes.bigBet,
        ante: payload.stakes.ante,
        bringIn: payload.stakes.bringIn,
        display: formatStakesDisplay(
          payload.stakes.smallBet,
          payload.stakes.bigBet,
        ),
      },
      currentHand: {
        handId: event.handId,
        handNo: payload.handNo,
        status: HandStatus.IN_PROGRESS,
        street: Street.THIRD,
        potTotal: 0,
        streetBetTo: 0,
        raiseCount: 0,
        toActSeatNo: null,
        actionDeadlineAt: null,
      },
    };

    if (Array.isArray(payload.participants)) {
      for (const participant of payload.participants) {
        if (
          isRecord(participant) &&
          isInteger(participant.seatNo) &&
          isInteger(participant.startStack)
        ) {
          next = updateSeat(next, participant.seatNo, (seat) => ({
            ...seat,
            status: SeatStatus.ACTIVE,
            stack: participant.startStack,
          }));
        }
      }
    }

    return next;
  }

  if (
    event.eventName === TableEventName.PostAnteEvent &&
    isPostAntePayload(payload)
  ) {
    let next = mergeCurrentHand(
      {
        ...table,
        status: TableStatus.BETTING,
      },
      {
        street: payload.street,
        potTotal: payload.potAfter,
      },
      event.handId,
    );

    if (Array.isArray(payload.contributions)) {
      for (const contribution of payload.contributions) {
        if (
          isRecord(contribution) &&
          isInteger(contribution.seatNo) &&
          isInteger(contribution.stackAfter)
        ) {
          next = updateSeat(next, contribution.seatNo, (seat) => ({
            ...seat,
            stack: contribution.stackAfter,
          }));
        }
      }
    }

    return next;
  }

  if (
    event.eventName === TableEventName.DealCards3rdEvent &&
    isDealCards3rdPayload(payload)
  ) {
    return mergeCurrentHand(
      {
        ...table,
        status: TableStatus.BETTING,
      },
      {
        street: Street.THIRD,
        toActSeatNo: payload.bringInSeatNo,
        actionDeadlineAt: resolveActionDeadlineAt({
          toActSeatNo: payload.bringInSeatNo,
          payloadActionDeadlineAt,
          occurredAt: event.occurredAt,
        }),
      },
      event.handId,
    );
  }

  if (
    event.eventName === TableEventName.BringInEvent &&
    isBringInPayload(payload)
  ) {
    return updateSeat(
      mergeCurrentHand(
        {
          ...table,
          status: TableStatus.BETTING,
        },
        {
          street: payload.street,
          potTotal: payload.potAfter,
          streetBetTo: payload.amount,
          raiseCount: 0,
          toActSeatNo: payload.nextToActSeatNo,
          actionDeadlineAt: resolveActionDeadlineAt({
            toActSeatNo: payload.nextToActSeatNo,
            payloadActionDeadlineAt,
            occurredAt: event.occurredAt,
          }),
        },
        event.handId,
      ),
      payload.seatNo,
      (seat) => ({
        ...seat,
        stack: payload.stackAfter,
      }),
    );
  }

  if (
    event.eventName === TableEventName.CallEvent &&
    isChipActionPayload(payload)
  ) {
    return updateSeat(
      mergeCurrentHand(
        {
          ...table,
          status: TableStatus.BETTING,
        },
        {
          street: payload.street,
          potTotal: payload.potAfter,
          streetBetTo: payload.streetBetTo,
          raiseCount: payload.raiseCount,
          toActSeatNo: payload.nextToActSeatNo,
          actionDeadlineAt: resolveActionDeadlineAt({
            toActSeatNo: payload.nextToActSeatNo,
            payloadActionDeadlineAt,
            occurredAt: event.occurredAt,
          }),
        },
        event.handId,
      ),
      payload.seatNo,
      (seat) => ({
        ...seat,
        stack: payload.stackAfter,
      }),
    );
  }

  if (
    event.eventName === TableEventName.BetEvent &&
    isChipActionPayload(payload)
  ) {
    return updateSeat(
      mergeCurrentHand(
        {
          ...table,
          status: TableStatus.BETTING,
        },
        {
          street: payload.street,
          potTotal: payload.potAfter,
          streetBetTo: payload.streetBetTo,
          raiseCount: payload.raiseCount,
          toActSeatNo: payload.nextToActSeatNo,
          actionDeadlineAt: resolveActionDeadlineAt({
            toActSeatNo: payload.nextToActSeatNo,
            payloadActionDeadlineAt,
            occurredAt: event.occurredAt,
          }),
        },
        event.handId,
      ),
      payload.seatNo,
      (seat) => ({
        ...seat,
        stack: payload.stackAfter,
      }),
    );
  }

  if (
    event.eventName === TableEventName.CompleteEvent &&
    isChipActionPayload(payload)
  ) {
    return updateSeat(
      mergeCurrentHand(
        {
          ...table,
          status: TableStatus.BETTING,
        },
        {
          street: payload.street,
          potTotal: payload.potAfter,
          streetBetTo: payload.streetBetTo,
          raiseCount: payload.raiseCount,
          toActSeatNo: payload.nextToActSeatNo,
          actionDeadlineAt: resolveActionDeadlineAt({
            toActSeatNo: payload.nextToActSeatNo,
            payloadActionDeadlineAt,
            occurredAt: event.occurredAt,
          }),
        },
        event.handId,
      ),
      payload.seatNo,
      (seat) => ({
        ...seat,
        stack: payload.stackAfter,
      }),
    );
  }

  if (
    event.eventName === TableEventName.RaiseEvent &&
    isChipActionPayload(payload)
  ) {
    return updateSeat(
      mergeCurrentHand(
        {
          ...table,
          status: TableStatus.BETTING,
        },
        {
          street: payload.street,
          potTotal: payload.potAfter,
          streetBetTo: payload.streetBetTo,
          raiseCount: payload.raiseCount,
          toActSeatNo: payload.nextToActSeatNo,
          actionDeadlineAt: resolveActionDeadlineAt({
            toActSeatNo: payload.nextToActSeatNo,
            payloadActionDeadlineAt,
            occurredAt: event.occurredAt,
          }),
        },
        event.handId,
      ),
      payload.seatNo,
      (seat) => ({
        ...seat,
        stack: payload.stackAfter,
      }),
    );
  }

  if (
    event.eventName === TableEventName.CheckEvent &&
    isActionPayload(payload)
  ) {
    return mergeCurrentHand(
      {
        ...table,
        status: TableStatus.BETTING,
      },
      {
        street: payload.street,
        potTotal: payload.potAfter,
        toActSeatNo: payload.nextToActSeatNo,
        actionDeadlineAt: resolveActionDeadlineAt({
          toActSeatNo: payload.nextToActSeatNo,
          payloadActionDeadlineAt,
          occurredAt: event.occurredAt,
        }),
      },
      event.handId,
    );
  }

  if (
    event.eventName === TableEventName.FoldEvent &&
    isActionPayload(payload)
  ) {
    return mergeCurrentHand(
      {
        ...table,
        status: TableStatus.BETTING,
      },
      {
        street: payload.street,
        potTotal: payload.potAfter,
        toActSeatNo: payload.nextToActSeatNo,
        actionDeadlineAt: resolveActionDeadlineAt({
          toActSeatNo: payload.nextToActSeatNo,
          payloadActionDeadlineAt,
          occurredAt: event.occurredAt,
        }),
      },
      event.handId,
    );
  }

  if (
    event.eventName === TableEventName.DealCardEvent &&
    isDealCardPayload(payload)
  ) {
    return mergeCurrentHand(
      {
        ...table,
        status: TableStatus.BETTING,
      },
      {
        street: payload.street,
        potTotal: payload.potAfter,
        toActSeatNo: payload.toActSeatNo,
        actionDeadlineAt: resolveActionDeadlineAt({
          toActSeatNo: payload.toActSeatNo,
          payloadActionDeadlineAt,
          occurredAt: event.occurredAt,
        }),
      },
      event.handId,
    );
  }

  if (
    event.eventName === TableEventName.StreetAdvanceEvent &&
    isStreetAdvancePayload(payload)
  ) {
    return mergeCurrentHand(
      {
        ...table,
        status: payload.tableStatus,
      },
      {
        street: payload.toStreet ?? payload.fromStreet,
        potTotal: payload.potTotal,
        streetBetTo:
          payload.toStreet === null ? (table.currentHand?.streetBetTo ?? 0) : 0,
        raiseCount:
          payload.toStreet === null ? (table.currentHand?.raiseCount ?? 0) : 0,
        toActSeatNo: payload.nextToActSeatNo,
        actionDeadlineAt: resolveActionDeadlineAt({
          toActSeatNo: payload.nextToActSeatNo,
          payloadActionDeadlineAt,
          occurredAt: event.occurredAt,
        }),
      },
      event.handId,
    );
  }

  if (
    event.eventName === TableEventName.ShowdownEvent &&
    isShowdownPayload(payload)
  ) {
    return mergeCurrentHand(
      {
        ...table,
        status: TableStatus.SHOWDOWN,
      },
      {
        status: HandStatus.SHOWDOWN,
        toActSeatNo: null,
        actionDeadlineAt: null,
      },
      event.handId,
    );
  }

  if (
    event.eventName === TableEventName.DealEndEvent &&
    isDealEndPayload(payload)
  ) {
    let next: TableDetail = {
      ...table,
      status: TableStatus.HAND_END,
      gameType: payload.nextGameType,
      mixIndex: payload.mixIndex,
      handsSinceRotation: payload.handsSinceRotation,
      dealerSeatNo: payload.nextDealerSeatNo,
      currentHand: table.currentHand
        ? {
            ...table.currentHand,
            status: HandStatus.HAND_END,
            potTotal: payload.finalPot,
            toActSeatNo: null,
            actionDeadlineAt: null,
          }
        : null,
    };

    for (const result of payload.results) {
      next = updateSeat(next, result.seatNo, (seat) => ({
        ...seat,
        stack: result.stackAfter,
      }));
    }

    return next;
  }

  return table;
};

const cloneSnapshot = (state: TableStoreState): TableStoreSnapshot => ({
  ...state,
  table: {
    ...state.table,
    stakes: { ...state.table.stakes },
    seats: state.table.seats.map((seat) => ({ ...seat })),
    currentHand: state.table.currentHand
      ? { ...state.table.currentHand }
      : null,
  },
  cardsBySeatNo: cloneCardsBySeatNo(state.cardsBySeatNo),
  eventLogs: state.eventLogs.map((entry) => ({ ...entry })),
  lastActionBySeatNo: cloneLastActionBySeatNo(state.lastActionBySeatNo),
  latestDealEndSummary: cloneLatestDealEndSummary(state.latestDealEndSummary),
});

export type TableStore = {
  start: () => void;
  stop: () => void;
  getSnapshot: () => TableStoreSnapshot;
  subscribe: (listener: TableStoreListener) => () => void;
  replaceTable: (table: TableDetail) => void;
  sendSeatCommand: (
    commandType: SeatCommandType,
    params?: { buyIn?: number },
  ) => boolean;
  sendActionCommand: (action: TableCommandAction) => boolean;
  requestResume: () => boolean;
};

const shouldLogDealEvents = import.meta.env.MODE === "development";

export const createTableStore = (options: TableStoreOptions): TableStore => {
  const reconnectDelayMs =
    options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
  const resumeAckTimeoutMs =
    options.resumeAckTimeoutMs ?? DEFAULT_RESUME_ACK_TIMEOUT_MS;
  const wsUrl = options.wsUrl ?? resolveWsUrl();
  const createWebSocket =
    options.createWebSocket ??
    ((url) => new WebSocket(url) as unknown as WebSocketLike);
  const randomUUID = options.randomUUID ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
  const explicitCurrentUserId = options.currentUserId ?? null;
  let inferredCurrentUserId =
    explicitCurrentUserId ?? resolveCurrentUserId(options.initialTable);

  let state: TableStoreState = {
    table: normalizeTableForCurrentUser(
      normalizeTableCurrentHandDeadline(
        options.initialTable,
        now().toISOString(),
      ),
      inferredCurrentUserId,
    ),
    tableSeq: 0,
    cardsBySeatNo: {},
    eventLogs: [],
    lastActionBySeatNo: {},
    latestDealEndSummary: null,
    connectionStatus: TableStoreConnectionStatus.IDLE,
    syncStatus: TableStoreSyncStatus.IDLE,
    lastErrorCode: null,
    lastErrorMessage: null,
  };

  const listeners = new Set<TableStoreListener>();
  let socket: WebSocketLike | null = null;
  let reconnectTimerId: TimerId | null = null;
  let resumeTimerId: TimerId | null = null;
  let stopped = true;
  let resumeInFlight = false;

  const notify = () => {
    const snapshot = cloneSnapshot(state);
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  const patchState = (patch: Partial<TableStoreState>) => {
    state = {
      ...state,
      ...patch,
    };
    notify();
  };

  const clearReconnectTimer = () => {
    if (reconnectTimerId === null) {
      return;
    }
    clearTimeoutFn(reconnectTimerId);
    reconnectTimerId = null;
  };

  const clearResumeTimer = () => {
    if (resumeTimerId === null) {
      return;
    }
    clearTimeoutFn(resumeTimerId);
    resumeTimerId = null;
  };

  const markResumeInFlight = () => {
    resumeInFlight = true;
    clearResumeTimer();
    resumeTimerId = setTimeoutFn(() => {
      if (!resumeInFlight) {
        return;
      }
      resumeInFlight = false;
      patchState({
        syncStatus: TableStoreSyncStatus.IN_SYNC,
      });
    }, resumeAckTimeoutMs);
  };

  const clearResumeInFlight = () => {
    resumeInFlight = false;
    clearResumeTimer();
  };

  const sendCommand = (
    type: string,
    payload: Record<string, unknown>,
    options?: { markResync?: boolean },
  ) => {
    if (!socket || socket.readyState !== OPEN_READY_STATE) {
      patchState({
        lastErrorCode: null,
        lastErrorMessage: "WebSocket未接続のためコマンドを送信できません。",
      });
      return false;
    }

    socket.send(
      JSON.stringify({
        type,
        requestId: randomUUID(),
        sentAt: now().toISOString(),
        payload,
      }),
    );

    if (options?.markResync === true) {
      markResumeInFlight();
      patchState({
        syncStatus: TableStoreSyncStatus.RESYNCING,
      });
    }

    return true;
  };

  const requestResume = () =>
    sendCommand(
      RealtimeTableCommandType.RESUME,
      {
        tableId: options.tableId,
        lastTableSeq: state.tableSeq,
      },
      { markResync: true },
    );

  const scheduleReconnect = () => {
    if (stopped || reconnectTimerId !== null) {
      return;
    }
    reconnectTimerId = setTimeoutFn(() => {
      reconnectTimerId = null;
      connect();
    }, reconnectDelayMs);
  };

  const handleTableEvent = (message: TableEventMessage) => {
    if (message.tableId !== options.tableId) {
      return;
    }

    if (message.tableSeq <= state.tableSeq) {
      return;
    }

    const expectedSeq = state.tableSeq + 1;
    if (message.tableSeq !== expectedSeq) {
      patchState({
        syncStatus: TableStoreSyncStatus.RESYNCING,
      });
      if (!resumeInFlight) {
        void requestResume();
      }
      return;
    }

    clearResumeInFlight();

    if (
      shouldLogDealEvents &&
      (message.eventName === TableEventName.DealCards3rdEvent ||
        message.eventName === TableEventName.DealCardEvent)
    ) {
      console.info("[table-store] deal-event", {
        tableId: message.tableId,
        tableSeq: message.tableSeq,
        handId: message.handId,
        handSeq: message.handSeq,
        eventName: message.eventName,
        payload: message.payload,
      });
    }

    const nextTable = applyEventToTable(
      state.table,
      message,
      inferredCurrentUserId,
    );
    const nextCardsBySeatNo = applyEventToCardsBySeatNo(
      state.cardsBySeatNo,
      message,
    );
    const action = resolveLastAction(message);
    const nextLastActionBySeatNo =
      message.eventName === TableEventName.DealInitEvent
        ? {}
        : action === null
          ? state.lastActionBySeatNo
          : {
              ...state.lastActionBySeatNo,
              [action.seatNo]: action,
            };
    const dealEndSummary = resolveLatestDealEndSummary(message);
    const nextLatestDealEndSummary =
      message.eventName === TableEventName.DealInitEvent
        ? null
        : (dealEndSummary ?? state.latestDealEndSummary);

    patchState({
      table: nextTable,
      tableSeq: message.tableSeq,
      cardsBySeatNo: nextCardsBySeatNo,
      eventLogs: pushEventLog(state.eventLogs, buildEventLog(message)),
      lastActionBySeatNo: nextLastActionBySeatNo,
      latestDealEndSummary: nextLatestDealEndSummary,
      syncStatus: TableStoreSyncStatus.IN_SYNC,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
  };

  const handleSnapshot = (message: TableSnapshotMessage) => {
    if (message.tableId !== options.tableId) {
      return;
    }

    clearResumeInFlight();
    patchState({
      table: mapSnapshotTable(state.table, message, inferredCurrentUserId),
      cardsBySeatNo: mapSnapshotCardsBySeatNo(
        message.payload.table.currentHand,
      ),
      lastActionBySeatNo: {},
      latestDealEndSummary: null,
      tableSeq: message.tableSeq,
      syncStatus: TableStoreSyncStatus.IN_SYNC,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
  };

  const handleError = (message: TableErrorMessage) => {
    patchState({
      lastErrorCode: message.code,
      lastErrorMessage: message.message,
    });
  };

  const handleMessage = (raw: string) => {
    const parsed = parseJsonMessage(raw);
    if (!parsed) {
      patchState({
        lastErrorCode: null,
        lastErrorMessage: "WebSocketメッセージの形式が不正です。",
      });
      return;
    }

    if (parsed.type === "table.event") {
      handleTableEvent(parsed);
      return;
    }
    if (parsed.type === "table.snapshot") {
      handleSnapshot(parsed);
      return;
    }
    if (parsed.type === "table.error") {
      handleError(parsed);
    }
  };

  const attachSocket = (nextSocket: WebSocketLike) => {
    socket = nextSocket;

    nextSocket.onopen = () => {
      if (socket !== nextSocket || stopped) {
        return;
      }
      patchState({
        connectionStatus: TableStoreConnectionStatus.OPEN,
      });
      void requestResume();
    };

    nextSocket.onmessage = (event) => {
      if (socket !== nextSocket || stopped) {
        return;
      }
      const text = resolveMessageText(event.data);
      if (text === null) {
        patchState({
          lastErrorCode: null,
          lastErrorMessage: "WebSocketメッセージを文字列として解釈できません。",
        });
        return;
      }
      handleMessage(text);
    };

    nextSocket.onerror = () => {
      if (socket !== nextSocket || stopped) {
        return;
      }
      patchState({
        lastErrorCode: null,
        lastErrorMessage: "WebSocket通信エラーが発生しました。",
      });
    };

    nextSocket.onclose = () => {
      if (socket !== nextSocket) {
        return;
      }
      socket = null;
      clearResumeInFlight();

      if (stopped) {
        patchState({
          connectionStatus: TableStoreConnectionStatus.CLOSED,
          syncStatus: TableStoreSyncStatus.IDLE,
        });
        return;
      }

      patchState({
        connectionStatus: TableStoreConnectionStatus.RECONNECTING,
      });
      scheduleReconnect();
    };
  };

  const connect = () => {
    clearReconnectTimer();
    if (stopped) {
      return;
    }
    patchState({
      connectionStatus:
        state.connectionStatus === TableStoreConnectionStatus.IDLE
          ? TableStoreConnectionStatus.CONNECTING
          : TableStoreConnectionStatus.RECONNECTING,
    });

    attachSocket(createWebSocket(wsUrl));
  };

  const start = () => {
    if (socket || !stopped) {
      return;
    }
    stopped = false;
    connect();
  };

  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    clearReconnectTimer();
    clearResumeInFlight();

    const current = socket;
    socket = null;
    if (current) {
      current.onopen = null;
      current.onclose = null;
      current.onerror = null;
      current.onmessage = null;
      current.close();
    }

    patchState({
      connectionStatus: TableStoreConnectionStatus.CLOSED,
      syncStatus: TableStoreSyncStatus.IDLE,
    });
  };

  const replaceTable = (table: TableDetail) => {
    if (explicitCurrentUserId === null) {
      inferredCurrentUserId = resolveCurrentUserId(table);
    }
    patchState({
      table: normalizeTableForCurrentUser(
        normalizeTableCurrentHandDeadline(table, now().toISOString()),
        inferredCurrentUserId,
      ),
    });
  };

  const sendSeatCommand = (
    commandType: SeatCommandType,
    params?: { buyIn?: number },
  ) => {
    if (commandType === RealtimeTableCommandType.JOIN) {
      const buyIn = params?.buyIn;
      if (!isNonNegativeInteger(buyIn) || buyIn <= 0) {
        patchState({
          lastErrorCode: null,
          lastErrorMessage: "JOIN は buyIn を正の整数で指定してください。",
        });
        return false;
      }
      return sendCommand(commandType, {
        tableId: options.tableId,
        buyIn,
      });
    }

    return sendCommand(commandType, {
      tableId: options.tableId,
    });
  };

  const sendActionCommand = (action: TableCommandAction) => {
    if (!isEnumValue(action, MVP_TABLE_ACT_ACTIONS)) {
      patchState({
        lastErrorCode: null,
        lastErrorMessage:
          "MVP未対応のアクションです。FOLD/CHECK/CALL/BET/COMPLETE/RAISE/BRING_IN を選択してください。",
      });
      return false;
    }

    return sendCommand(RealtimeTableCommandType.ACT, {
      tableId: options.tableId,
      action,
    });
  };

  const getSnapshot = () => cloneSnapshot(state);

  const subscribe = (listener: TableStoreListener) => {
    listeners.add(listener);
    listener(getSnapshot());
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    start,
    stop,
    getSnapshot,
    subscribe,
    replaceTable,
    sendSeatCommand,
    sendActionCommand,
    requestResume,
  };
};
