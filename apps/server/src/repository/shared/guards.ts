import {
  ACTION_TYPES,
  type ActionType,
  GAME_TYPES,
  type GameType,
  HAND_STATUSES,
  HandStatus,
  type HandStatus as HandStatusType,
  POT_SIDES,
  type PotSide as PotSideType,
  SEAT_STATUSES,
  STREETS,
  SeatStatus,
  type SeatStatus as SeatStatusType,
  type Street as StreetType,
  TABLE_STATUSES,
  TableStatus,
  type TableStatus as TableStatusType,
} from "@mix-online/shared";

const isStringIn = <T extends string>(
  value: unknown,
  values: readonly T[],
): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isStreet = (value: unknown): value is StreetType =>
  isStringIn(value, STREETS);

export const isActionType = (value: unknown): value is ActionType =>
  isStringIn(value, ACTION_TYPES);

export const isGameType = (value: unknown): value is GameType =>
  isStringIn(value, GAME_TYPES);

export const isPotSide = (value: unknown): value is PotSideType =>
  isStringIn(value, POT_SIDES);

export const parseTableStatus = (value: unknown): TableStatusType =>
  isStringIn(value, TABLE_STATUSES) ? value : TableStatus.WAITING;

export const parseSeatStatus = (value: unknown): SeatStatusType =>
  isStringIn(value, SEAT_STATUSES) ? value : SeatStatus.EMPTY;

export const parseHandStatus = (value: unknown): HandStatusType =>
  isStringIn(value, HAND_STATUSES) ? value : HandStatus.IN_PROGRESS;
