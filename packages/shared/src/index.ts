export const GameType = {
  STUD_HI: "STUD_HI",
  RAZZ: "RAZZ",
  STUD_8: "STUD_8",
} as const;
export type GameType = (typeof GameType)[keyof typeof GameType];
export const GAME_TYPES = Object.values(GameType) as GameType[];

export const TableStatus = {
  WAITING: "WAITING",
  DEALING: "DEALING",
  BETTING: "BETTING",
  SHOWDOWN: "SHOWDOWN",
  HAND_END: "HAND_END",
} as const;
export type TableStatus = (typeof TableStatus)[keyof typeof TableStatus];
export const TABLE_STATUSES = Object.values(TableStatus) as TableStatus[];

export const SeatStatus = {
  EMPTY: "EMPTY",
  SEATED_WAIT_NEXT_HAND: "SEATED_WAIT_NEXT_HAND",
  ACTIVE: "ACTIVE",
  SIT_OUT: "SIT_OUT",
  DISCONNECTED: "DISCONNECTED",
  LEAVE_PENDING: "LEAVE_PENDING",
} as const;
export type SeatStatus = (typeof SeatStatus)[keyof typeof SeatStatus];
export const SEAT_STATUSES = Object.values(SeatStatus) as SeatStatus[];

export const HandStatus = {
  IN_PROGRESS: "IN_PROGRESS",
  SHOWDOWN: "SHOWDOWN",
  HAND_END: "HAND_END",
} as const;
export type HandStatus = (typeof HandStatus)[keyof typeof HandStatus];
export const HAND_STATUSES = Object.values(HandStatus) as HandStatus[];

export const HandPlayerState = {
  IN_HAND: "IN_HAND",
  FOLDED: "FOLDED",
  ALL_IN: "ALL_IN",
  AUTO_FOLDED: "AUTO_FOLDED",
} as const;
export type HandPlayerState =
  (typeof HandPlayerState)[keyof typeof HandPlayerState];
export const HAND_PLAYER_STATES = Object.values(
  HandPlayerState,
) as HandPlayerState[];

export const Street = {
  THIRD: "THIRD",
  FOURTH: "FOURTH",
  FIFTH: "FIFTH",
  SIXTH: "SIXTH",
  SEVENTH: "SEVENTH",
} as const;
export type Street = (typeof Street)[keyof typeof Street];
export const STREETS = Object.values(Street) as Street[];

export const ActionType = {
  ANTE: "ANTE",
  BRING_IN: "BRING_IN",
  COMPLETE: "COMPLETE",
  BET: "BET",
  RAISE: "RAISE",
  CALL: "CALL",
  CHECK: "CHECK",
  FOLD: "FOLD",
  AUTO_CHECK: "AUTO_CHECK",
  AUTO_FOLD: "AUTO_FOLD",
  SHOW: "SHOW",
  MUCK: "MUCK",
} as const;
export type ActionType = (typeof ActionType)[keyof typeof ActionType];
export const ACTION_TYPES = Object.values(ActionType) as ActionType[];

export const TableCommandAction = {
  FOLD: "FOLD",
  CHECK: "CHECK",
  CALL: "CALL",
  BET: "BET",
  RAISE: "RAISE",
  COMPLETE: "COMPLETE",
  BRING_IN: "BRING_IN",
} as const;
export type TableCommandAction =
  (typeof TableCommandAction)[keyof typeof TableCommandAction];
export const TABLE_COMMAND_ACTIONS = Object.values(
  TableCommandAction,
) as TableCommandAction[];

export const RealtimeTableCommandType = {
  JOIN: "table.join",
  SIT_OUT: "table.sitOut",
  RETURN: "table.return",
  LEAVE: "table.leave",
  ACT: "table.act",
  RESUME: "table.resume",
} as const;
export type RealtimeTableCommandType =
  (typeof RealtimeTableCommandType)[keyof typeof RealtimeTableCommandType];
export const REALTIME_TABLE_COMMAND_TYPES = Object.values(
  RealtimeTableCommandType,
) as RealtimeTableCommandType[];

export const TableEventName = {
  DealInitEvent: "DealInitEvent",
  DealCards3rdEvent: "DealCards3rdEvent",
  DealCardEvent: "DealCardEvent",
  PostAnteEvent: "PostAnteEvent",
  BringInEvent: "BringInEvent",
  CompleteEvent: "CompleteEvent",
  BetEvent: "BetEvent",
  RaiseEvent: "RaiseEvent",
  CallEvent: "CallEvent",
  CheckEvent: "CheckEvent",
  FoldEvent: "FoldEvent",
  StreetAdvanceEvent: "StreetAdvanceEvent",
  ShowdownEvent: "ShowdownEvent",
  DealEndEvent: "DealEndEvent",
  SeatStateChangedEvent: "SeatStateChangedEvent",
  PlayerDisconnectedEvent: "PlayerDisconnectedEvent",
  PlayerReconnectedEvent: "PlayerReconnectedEvent",
} as const;
export type TableEventName =
  (typeof TableEventName)[keyof typeof TableEventName];
export const TABLE_EVENT_NAMES = Object.values(
  TableEventName,
) as TableEventName[];

export const PotSide = {
  SINGLE: "SINGLE",
  HI: "HI",
  LO: "LO",
} as const;
export type PotSide = (typeof PotSide)[keyof typeof PotSide];
export const POT_SIDES = Object.values(PotSide) as PotSide[];

export const ShowdownAction = {
  SHOW: "SHOW",
  MUCK: "MUCK",
} as const;
export type ShowdownAction =
  (typeof ShowdownAction)[keyof typeof ShowdownAction];
export const SHOWDOWN_ACTIONS = Object.values(
  ShowdownAction,
) as ShowdownAction[];

export const ErrorCode = {
  INVALID_ACTION: "INVALID_ACTION",
  INVALID_CURSOR: "INVALID_CURSOR",
  NOT_YOUR_TURN: "NOT_YOUR_TURN",
  INSUFFICIENT_CHIPS: "INSUFFICIENT_CHIPS",
  TABLE_FULL: "TABLE_FULL",
  BUYIN_OUT_OF_RANGE: "BUYIN_OUT_OF_RANGE",
  ALREADY_SEATED: "ALREADY_SEATED",
  AUTH_EXPIRED: "AUTH_EXPIRED",
  BAD_REQUEST: "BAD_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
export const ERROR_CODES = Object.values(ErrorCode) as ErrorCode[];

export const RealtimeErrorCode = {
  INVALID_ACTION: "INVALID_ACTION",
  NOT_YOUR_TURN: "NOT_YOUR_TURN",
  INSUFFICIENT_CHIPS: "INSUFFICIENT_CHIPS",
  TABLE_FULL: "TABLE_FULL",
  BUYIN_OUT_OF_RANGE: "BUYIN_OUT_OF_RANGE",
  ALREADY_SEATED: "ALREADY_SEATED",
  AUTH_EXPIRED: "AUTH_EXPIRED",
} as const;
export type RealtimeErrorCode =
  (typeof RealtimeErrorCode)[keyof typeof RealtimeErrorCode];
export const REALTIME_ERROR_CODES = Object.values(
  RealtimeErrorCode,
) as RealtimeErrorCode[];

export const CardRank = {
  A: "A",
  K: "K",
  Q: "Q",
  J: "J",
  T: "T",
  N9: "9",
  N8: "8",
  N7: "7",
  N6: "6",
  N5: "5",
  N4: "4",
  N3: "3",
  N2: "2",
} as const;
export type CardRank = (typeof CardRank)[keyof typeof CardRank];
export const CARD_RANKS = Object.values(CardRank) as CardRank[];

export const CardSuit = {
  S: "S",
  H: "H",
  D: "D",
  C: "C",
} as const;
export type CardSuit = (typeof CardSuit)[keyof typeof CardSuit];
export const CARD_SUITS = Object.values(CardSuit) as CardSuit[];

export const CardVisibility = {
  UP: "UP",
  DOWN_SELF: "DOWN_SELF",
  DOWN_HIDDEN: "DOWN_HIDDEN",
} as const;
export type CardVisibility =
  (typeof CardVisibility)[keyof typeof CardVisibility];
export const CARD_VISIBILITIES = Object.values(
  CardVisibility,
) as CardVisibility[];

export const ThirdStreetCardPosition = {
  HOLE_1: "HOLE_1",
  HOLE_2: "HOLE_2",
  UP_3: "UP_3",
} as const;
export type ThirdStreetCardPosition =
  (typeof ThirdStreetCardPosition)[keyof typeof ThirdStreetCardPosition];
export const THIRD_STREET_CARD_POSITIONS = Object.values(
  ThirdStreetCardPosition,
) as ThirdStreetCardPosition[];

export const DealEndReason = {
  SHOWDOWN: "SHOWDOWN",
  UNCONTESTED: "UNCONTESTED",
  AUTO_END: "AUTO_END",
} as const;
export type DealEndReason = (typeof DealEndReason)[keyof typeof DealEndReason];
export const DEAL_END_REASONS = Object.values(DealEndReason) as DealEndReason[];

export const SeatStateChangeReason = {
  JOIN: "JOIN",
  SIT_OUT: "SIT_OUT",
  RETURN: "RETURN",
  LEAVE_PENDING: "LEAVE_PENDING",
  LEAVE: "LEAVE",
  AUTO_LEAVE_ZERO_STACK: "AUTO_LEAVE_ZERO_STACK",
  NEXT_HAND_ACTIVATE: "NEXT_HAND_ACTIVATE",
  SYSTEM: "SYSTEM",
} as const;
export type SeatStateChangeReason =
  (typeof SeatStateChangeReason)[keyof typeof SeatStateChangeReason];
export const SEAT_STATE_CHANGE_REASONS = Object.values(
  SeatStateChangeReason,
) as SeatStateChangeReason[];

export const SeatStateChangeAppliesFrom = {
  IMMEDIATE: "IMMEDIATE",
  NEXT_HAND: "NEXT_HAND",
} as const;
export type SeatStateChangeAppliesFrom =
  (typeof SeatStateChangeAppliesFrom)[keyof typeof SeatStateChangeAppliesFrom];
export const SEAT_STATE_CHANGE_APPLIES_FROM = Object.values(
  SeatStateChangeAppliesFrom,
) as SeatStateChangeAppliesFrom[];

export const TableBuyIn = {
  MIN: 400,
  MAX: 2000,
} as const;

export type RealtimeTableCommand = {
  type: RealtimeTableCommandType;
  requestId: string;
  sentAt: string;
  payload: Record<string, unknown>;
};

export type RealtimeTableSeat = {
  seatNo: number;
  status: SeatStatus;
  userId: string | null;
  displayName: string | null;
  stack: number;
  disconnectStreak: number;
  joinedAt: string | null;
};

export type RealtimeTableState = {
  tableId: string;
  status: TableStatus;
  seats: RealtimeTableSeat[];
};

export type SeatStateChangedEventPayload = {
  seatNo: number;
  previousStatus: SeatStatus;
  currentStatus: SeatStatus;
  reason: SeatStateChangeReason;
  user: { userId: string; displayName: string } | null;
  stack: number;
  appliesFrom: SeatStateChangeAppliesFrom;
};

export type RealtimeTableEventMessage = {
  type: "table.event";
  tableId: string;
  tableSeq: number;
  handId: null;
  handSeq: null;
  occurredAt: string;
  eventName: typeof TableEventName.SeatStateChangedEvent;
  payload: SeatStateChangedEventPayload;
};

export type RealtimeTableServiceError = {
  code: RealtimeErrorCode;
  message: string;
  tableId: string | null;
  requestId: string;
};

export type RealtimeTableServiceSuccess = {
  ok: true;
  tableId: string;
  event: RealtimeTableEventMessage;
};

export type RealtimeTableServiceFailure = {
  ok: false;
  error: RealtimeTableServiceError;
};

export type RealtimeTableServiceResult =
  | RealtimeTableServiceSuccess
  | RealtimeTableServiceFailure;

export const SnapshotReason = {
  OUT_OF_RANGE: "OUT_OF_RANGE",
  RESYNC_REQUIRED: "RESYNC_REQUIRED",
} as const;
export type SnapshotReason =
  (typeof SnapshotReason)[keyof typeof SnapshotReason];
export const SNAPSHOT_REASONS = Object.values(
  SnapshotReason,
) as SnapshotReason[];

export const BettingStructure = {
  FIXED_LIMIT: "FIXED_LIMIT",
} as const;
export type BettingStructure =
  (typeof BettingStructure)[keyof typeof BettingStructure];
export const BETTING_STRUCTURES = Object.values(
  BettingStructure,
) as BettingStructure[];

export const WalletTransactionType = {
  INIT_GRANT: "INIT_GRANT",
  BUY_IN: "BUY_IN",
  CASH_OUT: "CASH_OUT",
  HAND_RESULT: "HAND_RESULT",
} as const;
export type WalletTransactionType =
  (typeof WalletTransactionType)[keyof typeof WalletTransactionType];
export const WALLET_TRANSACTION_TYPES = Object.values(
  WalletTransactionType,
) as WalletTransactionType[];
