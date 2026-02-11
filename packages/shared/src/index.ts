export const GAME_TYPES = ["STUD_HI", "RAZZ", "STUD_8"] as const;
export type GameType = (typeof GAME_TYPES)[number];

export const TABLE_STATUSES = [
  "WAITING",
  "DEALING",
  "BETTING",
  "SHOWDOWN",
  "HAND_END",
] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

export const SEAT_STATUSES = [
  "EMPTY",
  "SEATED_WAIT_NEXT_HAND",
  "ACTIVE",
  "SIT_OUT",
  "DISCONNECTED",
  "LEAVE_PENDING",
] as const;
export type SeatStatus = (typeof SEAT_STATUSES)[number];

export const HAND_STATUSES = ["IN_PROGRESS", "SHOWDOWN", "HAND_END"] as const;
export type HandStatus = (typeof HAND_STATUSES)[number];

export const HAND_PLAYER_STATES = [
  "IN_HAND",
  "FOLDED",
  "ALL_IN",
  "AUTO_FOLDED",
] as const;
export type HandPlayerState = (typeof HAND_PLAYER_STATES)[number];

export const STREETS = [
  "THIRD",
  "FOURTH",
  "FIFTH",
  "SIXTH",
  "SEVENTH",
] as const;
export type Street = (typeof STREETS)[number];

export const ACTION_TYPES = [
  "ANTE",
  "BRING_IN",
  "COMPLETE",
  "BET",
  "RAISE",
  "CALL",
  "CHECK",
  "FOLD",
  "AUTO_CHECK",
  "AUTO_FOLD",
  "SHOW",
  "MUCK",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const TABLE_COMMAND_ACTIONS = [
  "FOLD",
  "CHECK",
  "CALL",
  "BET",
  "RAISE",
  "COMPLETE",
  "BRING_IN",
] as const;
export type TableCommandAction = (typeof TABLE_COMMAND_ACTIONS)[number];

export const TABLE_EVENT_NAMES = [
  "DealInitEvent",
  "DealCards3rdEvent",
  "DealCardEvent",
  "PostAnteEvent",
  "BringInEvent",
  "CompleteEvent",
  "BetEvent",
  "RaiseEvent",
  "CallEvent",
  "CheckEvent",
  "FoldEvent",
  "StreetAdvanceEvent",
  "ShowdownEvent",
  "DealEndEvent",
  "SeatStateChangedEvent",
  "PlayerDisconnectedEvent",
  "PlayerReconnectedEvent",
] as const;
export type TableEventName = (typeof TABLE_EVENT_NAMES)[number];

export const POT_SIDES = ["SINGLE", "HI", "LO"] as const;
export type PotSide = (typeof POT_SIDES)[number];

export const SHOWDOWN_ACTIONS = ["SHOW", "MUCK"] as const;
export type ShowdownAction = (typeof SHOWDOWN_ACTIONS)[number];

export const ERROR_CODES = [
  "INVALID_ACTION",
  "INVALID_CURSOR",
  "NOT_YOUR_TURN",
  "INSUFFICIENT_CHIPS",
  "TABLE_FULL",
  "BUYIN_OUT_OF_RANGE",
  "ALREADY_SEATED",
  "AUTH_EXPIRED",
  "BAD_REQUEST",
  "NOT_FOUND",
  "INTERNAL_SERVER_ERROR",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const REALTIME_ERROR_CODES = [
  "INVALID_ACTION",
  "NOT_YOUR_TURN",
  "INSUFFICIENT_CHIPS",
  "TABLE_FULL",
  "BUYIN_OUT_OF_RANGE",
  "ALREADY_SEATED",
  "AUTH_EXPIRED",
] as const;
export type RealtimeErrorCode = (typeof REALTIME_ERROR_CODES)[number];

export const CARD_RANKS = [
  "A",
  "K",
  "Q",
  "J",
  "T",
  "9",
  "8",
  "7",
  "6",
  "5",
  "4",
  "3",
  "2",
] as const;
export type CardRank = (typeof CARD_RANKS)[number];

export const CARD_SUITS = ["S", "H", "D", "C"] as const;
export type CardSuit = (typeof CARD_SUITS)[number];

export const CARD_VISIBILITIES = ["UP", "DOWN_SELF", "DOWN_HIDDEN"] as const;
export type CardVisibility = (typeof CARD_VISIBILITIES)[number];

export const THIRD_STREET_CARD_POSITIONS = [
  "HOLE_1",
  "HOLE_2",
  "UP_3",
] as const;
export type ThirdStreetCardPosition =
  (typeof THIRD_STREET_CARD_POSITIONS)[number];

export const DEAL_END_REASONS = [
  "SHOWDOWN",
  "UNCONTESTED",
  "AUTO_END",
] as const;
export type DealEndReason = (typeof DEAL_END_REASONS)[number];

export const SEAT_STATE_CHANGE_REASONS = [
  "JOIN",
  "SIT_OUT",
  "RETURN",
  "LEAVE_PENDING",
  "LEAVE",
  "AUTO_LEAVE_ZERO_STACK",
  "NEXT_HAND_ACTIVATE",
  "SYSTEM",
] as const;
export type SeatStateChangeReason = (typeof SEAT_STATE_CHANGE_REASONS)[number];

export const SEAT_STATE_CHANGE_APPLIES_FROM = [
  "IMMEDIATE",
  "NEXT_HAND",
] as const;
export type SeatStateChangeAppliesFrom =
  (typeof SEAT_STATE_CHANGE_APPLIES_FROM)[number];

export const SNAPSHOT_REASONS = ["OUT_OF_RANGE", "RESYNC_REQUIRED"] as const;
export type SnapshotReason = (typeof SNAPSHOT_REASONS)[number];

export const BETTING_STRUCTURES = ["FIXED_LIMIT"] as const;
export type BettingStructure = (typeof BETTING_STRUCTURES)[number];

export const WALLET_TRANSACTION_TYPES = [
  "INIT_GRANT",
  "BUY_IN",
  "CASH_OUT",
  "HAND_RESULT",
] as const;
export type WalletTransactionType = (typeof WALLET_TRANSACTION_TYPES)[number];
