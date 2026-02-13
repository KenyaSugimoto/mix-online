import { ErrorCode, type ErrorCode as ErrorCodeType } from "@mix-online/shared";
import {
  ApiPath,
  HttpHeaderName,
  HttpStatusCode,
  MediaType,
} from "./web-constants";

export type TableStakes = {
  smallBet: number;
  bigBet: number;
  ante: number;
  bringIn: number;
  bettingStructure: string;
  display: string;
};

export type LobbyTableSummary = {
  tableId: string;
  tableName: string;
  stakes: TableStakes;
  players: number;
  maxPlayers: number;
  gameType: string;
  emptySeats: number;
};

export type LobbyTablesResponse = {
  tables: LobbyTableSummary[];
  serverTime: string;
};

type ErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class LobbyApiError extends Error {
  public readonly status: number;
  public readonly code: ErrorCodeType | null;

  public constructor(params: {
    status: number;
    code: ErrorCodeType | null;
    message: string;
  }) {
    super(params.message);
    this.name = "LobbyApiError";
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
      : `ロビーAPI呼び出しに失敗しました (status=${response.status})`;

  return new LobbyApiError({
    status: response.status,
    code,
    message,
  });
};

const hasValidStakes = (value: unknown): value is TableStakes => {
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

const hasValidTableSummary = (value: unknown): value is LobbyTableSummary => {
  const table = value as Partial<LobbyTableSummary> | null;
  return (
    !!table &&
    typeof table.tableId === "string" &&
    typeof table.tableName === "string" &&
    hasValidStakes(table.stakes) &&
    typeof table.players === "number" &&
    typeof table.maxPlayers === "number" &&
    typeof table.gameType === "string" &&
    typeof table.emptySeats === "number"
  );
};

const validateLobbyResponse = (value: LobbyTablesResponse | null) => {
  if (
    !value ||
    !Array.isArray(value.tables) ||
    !value.tables.every(hasValidTableSummary) ||
    typeof value.serverTime !== "string"
  ) {
    throw new LobbyApiError({
      status: HttpStatusCode.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: "ロビー一覧レスポンス形式が不正です。",
    });
  }

  return value;
};

export const createLobbyApi = (fetchImpl: FetchLike) => ({
  async getTables(): Promise<LobbyTablesResponse> {
    const response = await fetchImpl(ApiPath.LOBBY_TABLES, {
      credentials: "include",
      headers: {
        [HttpHeaderName.ACCEPT]: MediaType.APPLICATION_JSON,
      },
    });

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const body = await parseJsonSafely<LobbyTablesResponse>(response);
    return validateLobbyResponse(body);
  },
});

const lobbyApi = createLobbyApi(fetch as FetchLike);
export const getLobbyTables = () => lobbyApi.getTables();
