import {
  ErrorCode,
  type ErrorCode as ErrorCodeType,
  GAME_TYPES,
  type GameType,
  HAND_STATUSES,
  type HandStatus,
  SEAT_STATUSES,
  STREETS,
  type SeatStatus,
  type Street,
  TABLE_STATUSES,
  type TableStatus,
} from "@mix-online/shared";
import {
  HttpHeaderName,
  HttpStatusCode,
  MediaType,
  toTableDetailApiPath,
} from "./web-constants";

type ErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type TableStakes = {
  smallBet: number;
  bigBet: number;
  ante: number;
  bringIn: number;
  bettingStructure: string;
  display: string;
};

export type TableSeat = {
  seatNo: number;
  status: SeatStatus;
  userId: string | null;
  displayName: string | null;
  stack: number;
  isYou: boolean;
  joinedAt: string | null;
  disconnectStreak: number | null;
};

export type CurrentHandSummary = {
  handId: string;
  handNo: number;
  status: HandStatus;
  street: Street;
  potTotal: number;
  streetBetTo: number;
  raiseCount: number;
  toActSeatNo: number | null;
  actionDeadlineAt: string | null;
};

export type TableDetail = {
  tableId: string;
  tableName: string;
  status: TableStatus;
  gameType: GameType;
  mixIndex: number;
  handsSinceRotation: number;
  dealerSeatNo: number;
  stakes: TableStakes;
  minPlayers: number;
  maxPlayers: number;
  seats: TableSeat[];
  currentHand: CurrentHandSummary | null;
};

export type TableDetailResponse = {
  table: TableDetail;
};

export class TableApiError extends Error {
  public readonly status: number;
  public readonly code: ErrorCodeType | null;

  public constructor(params: {
    status: number;
    code: ErrorCodeType | null;
    message: string;
  }) {
    super(params.message);
    this.name = "TableApiError";
    this.status = params.status;
    this.code = params.code;
  }
}

const parseJsonSafely = async <T>(response: Response) => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const parseApiError = async (response: Response) => {
  const body = await parseJsonSafely<ErrorResponse>(response);
  const code =
    typeof body?.error?.code === "string"
      ? (body.error.code as ErrorCodeType)
      : null;
  const message =
    typeof body?.error?.message === "string"
      ? body.error.message
      : `卓詳細API呼び出しに失敗しました (status=${response.status})`;

  return new TableApiError({
    status: response.status,
    code,
    message,
  });
};

const isGameType = (value: unknown): value is GameType =>
  typeof value === "string" && GAME_TYPES.includes(value as GameType);

const isTableStatus = (value: unknown): value is TableStatus =>
  typeof value === "string" && TABLE_STATUSES.includes(value as TableStatus);

const isSeatStatus = (value: unknown): value is SeatStatus =>
  typeof value === "string" && SEAT_STATUSES.includes(value as SeatStatus);

const isHandStatus = (value: unknown): value is HandStatus =>
  typeof value === "string" && HAND_STATUSES.includes(value as HandStatus);

const isStreet = (value: unknown): value is Street =>
  typeof value === "string" && STREETS.includes(value as Street);

const hasValidTableStakes = (value: unknown): value is TableStakes => {
  const stakes = value as Partial<TableStakes> | null;
  return (
    !!stakes &&
    typeof stakes.smallBet === "number" &&
    typeof stakes.bigBet === "number" &&
    typeof stakes.ante === "number" &&
    typeof stakes.bringIn === "number" &&
    typeof stakes.bettingStructure === "string" &&
    typeof stakes.display === "string"
  );
};

const hasValidSeat = (value: unknown): value is TableSeat => {
  const seat = value as Partial<TableSeat> | null;
  return (
    !!seat &&
    typeof seat.seatNo === "number" &&
    isSeatStatus(seat.status) &&
    (typeof seat.userId === "string" || seat.userId === null) &&
    (typeof seat.displayName === "string" || seat.displayName === null) &&
    typeof seat.stack === "number" &&
    typeof seat.isYou === "boolean" &&
    (typeof seat.joinedAt === "string" || seat.joinedAt === null) &&
    (typeof seat.disconnectStreak === "number" ||
      seat.disconnectStreak === null)
  );
};

const hasValidCurrentHand = (value: unknown): value is CurrentHandSummary => {
  const hand = value as Partial<CurrentHandSummary> | null;
  return (
    !!hand &&
    typeof hand.handId === "string" &&
    typeof hand.handNo === "number" &&
    isHandStatus(hand.status) &&
    isStreet(hand.street) &&
    typeof hand.potTotal === "number" &&
    typeof hand.streetBetTo === "number" &&
    typeof hand.raiseCount === "number" &&
    (typeof hand.toActSeatNo === "number" || hand.toActSeatNo === null) &&
    (typeof hand.actionDeadlineAt === "string" ||
      hand.actionDeadlineAt === null)
  );
};

const hasValidTableDetail = (value: unknown): value is TableDetail => {
  const table = value as Partial<TableDetail> | null;
  return (
    !!table &&
    typeof table.tableId === "string" &&
    typeof table.tableName === "string" &&
    isTableStatus(table.status) &&
    isGameType(table.gameType) &&
    typeof table.mixIndex === "number" &&
    typeof table.handsSinceRotation === "number" &&
    typeof table.dealerSeatNo === "number" &&
    hasValidTableStakes(table.stakes) &&
    typeof table.minPlayers === "number" &&
    typeof table.maxPlayers === "number" &&
    Array.isArray(table.seats) &&
    table.seats.every(hasValidSeat) &&
    (table.currentHand === null || hasValidCurrentHand(table.currentHand))
  );
};

const validateTableDetailResponse = (value: TableDetailResponse | null) => {
  if (!value || !hasValidTableDetail(value.table)) {
    throw new TableApiError({
      status: HttpStatusCode.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: "卓詳細レスポンス形式が不正です。",
    });
  }

  return value;
};

export const createTableApi = (fetchImpl: FetchLike) => ({
  async getTable(tableId: string): Promise<TableDetailResponse> {
    const response = await fetchImpl(toTableDetailApiPath(tableId), {
      credentials: "include",
      headers: {
        [HttpHeaderName.ACCEPT]: MediaType.APPLICATION_JSON,
      },
    });

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const body = await parseJsonSafely<TableDetailResponse>(response);
    return validateTableDetailResponse(body);
  },
});

const tableApi = createTableApi(fetch as FetchLike);
export const getTableDetail = (tableId: string) => tableApi.getTable(tableId);
