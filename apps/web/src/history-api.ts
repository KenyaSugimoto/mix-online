import { ErrorCode, type ErrorCode as ErrorCodeType } from "@mix-online/shared";
import {
  ApiPath,
  HttpHeaderName,
  HttpStatusCode,
  MediaType,
  toHistoryHandDetailApiPath,
} from "./web-constants";

export type HandParticipant = {
  userId: string;
  displayName: string;
  seatNo: number;
  resultDelta: number | null;
  shownCardsUp: string[] | null;
  shownCardsDown: string[] | null;
};

export type HandHistoryListItem = {
  handId: string;
  tableId: string;
  tableName?: string;
  handNo?: number;
  gameType: string;
  participants: HandParticipant[];
  startedAt: string;
  endedAt: string;
  profitLoss: number;
};

export type HandHistoryListResponse = {
  items: HandHistoryListItem[];
  nextCursor: string | null;
};

export type HandAction = {
  seq: number;
  actionType: string;
  seatNo: number;
  isAuto: boolean;
  userId: string | null;
  displayName: string | null;
  amount: number | null;
  potAfter: number | null;
  occurredAt: string;
};

export type StreetActionGroup = {
  street: string;
  actions: HandAction[];
};

export type PotWinner = {
  userId: string;
  displayName: string;
  amount: number;
};

export type PotResult = {
  potNo: number;
  side: string;
  winners: PotWinner[];
  amount: number;
};

export type ShowdownSummary = {
  hasShowdown: boolean;
  potResults: PotResult[];
};

export type HandHistoryDetailResponse = {
  handId: string;
  tableId: string;
  tableName?: string;
  handNo?: number;
  gameType: string;
  participants: HandParticipant[];
  streetActions: StreetActionGroup[];
  showdown: ShowdownSummary;
  profitLoss: number;
  startedAt: string;
  endedAt: string;
};

type ErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type HistoryListQuery = {
  cursor?: string;
  limit?: number;
};

export class HistoryApiError extends Error {
  public readonly status: number;
  public readonly code: ErrorCodeType | null;

  public constructor(params: {
    status: number;
    code: ErrorCodeType | null;
    message: string;
  }) {
    super(params.message);
    this.name = "HistoryApiError";
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
      : `履歴API呼び出しに失敗しました (status=${response.status})`;

  return new HistoryApiError({
    status: response.status,
    code,
    message,
  });
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const hasValidHandParticipant = (value: unknown): value is HandParticipant => {
  const participant = value as Partial<HandParticipant> | null;
  return (
    !!participant &&
    typeof participant.userId === "string" &&
    typeof participant.displayName === "string" &&
    typeof participant.seatNo === "number" &&
    (participant.resultDelta === null ||
      typeof participant.resultDelta === "number") &&
    (participant.shownCardsUp === null ||
      isStringArray(participant.shownCardsUp)) &&
    (participant.shownCardsDown === null ||
      isStringArray(participant.shownCardsDown))
  );
};

const hasValidHistoryListItem = (
  value: unknown,
): value is HandHistoryListItem => {
  const item = value as Partial<HandHistoryListItem> | null;
  return (
    !!item &&
    typeof item.handId === "string" &&
    typeof item.tableId === "string" &&
    (item.tableName === undefined || typeof item.tableName === "string") &&
    (item.handNo === undefined || typeof item.handNo === "number") &&
    typeof item.gameType === "string" &&
    Array.isArray(item.participants) &&
    item.participants.every(hasValidHandParticipant) &&
    typeof item.startedAt === "string" &&
    typeof item.endedAt === "string" &&
    typeof item.profitLoss === "number"
  );
};

const hasValidHandAction = (value: unknown): value is HandAction => {
  const action = value as Partial<HandAction> | null;
  return (
    !!action &&
    typeof action.seq === "number" &&
    typeof action.actionType === "string" &&
    typeof action.seatNo === "number" &&
    typeof action.isAuto === "boolean" &&
    (action.userId === null || typeof action.userId === "string") &&
    (action.displayName === null || typeof action.displayName === "string") &&
    (action.amount === null || typeof action.amount === "number") &&
    (action.potAfter === null || typeof action.potAfter === "number") &&
    typeof action.occurredAt === "string"
  );
};

const hasValidStreetActionGroup = (
  value: unknown,
): value is StreetActionGroup => {
  const group = value as Partial<StreetActionGroup> | null;
  return (
    !!group &&
    typeof group.street === "string" &&
    Array.isArray(group.actions) &&
    group.actions.every(hasValidHandAction)
  );
};

const hasValidPotWinner = (value: unknown): value is PotWinner => {
  const winner = value as Partial<PotWinner> | null;
  return (
    !!winner &&
    typeof winner.userId === "string" &&
    typeof winner.displayName === "string" &&
    typeof winner.amount === "number"
  );
};

const hasValidPotResult = (value: unknown): value is PotResult => {
  const result = value as Partial<PotResult> | null;
  return (
    !!result &&
    typeof result.potNo === "number" &&
    typeof result.side === "string" &&
    Array.isArray(result.winners) &&
    result.winners.every(hasValidPotWinner) &&
    typeof result.amount === "number"
  );
};

const hasValidShowdownSummary = (value: unknown): value is ShowdownSummary => {
  const showdown = value as Partial<ShowdownSummary> | null;
  return (
    !!showdown &&
    typeof showdown.hasShowdown === "boolean" &&
    Array.isArray(showdown.potResults) &&
    showdown.potResults.every(hasValidPotResult)
  );
};

const validateListResponse = (
  value: HandHistoryListResponse | null,
): HandHistoryListResponse => {
  if (
    !value ||
    !Array.isArray(value.items) ||
    !value.items.every(hasValidHistoryListItem) ||
    (value.nextCursor !== null && typeof value.nextCursor !== "string")
  ) {
    throw new HistoryApiError({
      status: HttpStatusCode.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: "履歴一覧レスポンス形式が不正です。",
    });
  }

  return value;
};

const validateDetailResponse = (
  value: HandHistoryDetailResponse | null,
): HandHistoryDetailResponse => {
  if (
    !value ||
    typeof value.handId !== "string" ||
    typeof value.tableId !== "string" ||
    (value.tableName !== undefined && typeof value.tableName !== "string") ||
    (value.handNo !== undefined && typeof value.handNo !== "number") ||
    typeof value.gameType !== "string" ||
    !Array.isArray(value.participants) ||
    !value.participants.every(hasValidHandParticipant) ||
    !Array.isArray(value.streetActions) ||
    !value.streetActions.every(hasValidStreetActionGroup) ||
    !hasValidShowdownSummary(value.showdown) ||
    typeof value.profitLoss !== "number" ||
    typeof value.startedAt !== "string" ||
    typeof value.endedAt !== "string"
  ) {
    throw new HistoryApiError({
      status: HttpStatusCode.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: "履歴詳細レスポンス形式が不正です。",
    });
  }

  return value;
};

const toListPath = (query: HistoryListQuery | undefined) => {
  const params = new URLSearchParams();

  if (query?.cursor) {
    params.set("cursor", query.cursor);
  }

  if (typeof query?.limit === "number") {
    params.set("limit", String(query.limit));
  }

  const serialized = params.toString();
  return serialized
    ? `${ApiPath.HISTORY_HANDS}?${serialized}`
    : ApiPath.HISTORY_HANDS;
};

export const createHistoryApi = (fetchImpl: FetchLike) => ({
  async getHands(query?: HistoryListQuery): Promise<HandHistoryListResponse> {
    const response = await fetchImpl(toListPath(query), {
      credentials: "include",
      headers: {
        [HttpHeaderName.ACCEPT]: MediaType.APPLICATION_JSON,
      },
    });

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const body = await parseJsonSafely<HandHistoryListResponse>(response);
    return validateListResponse(body);
  },

  async getHandDetail(handId: string): Promise<HandHistoryDetailResponse> {
    const response = await fetchImpl(toHistoryHandDetailApiPath(handId), {
      credentials: "include",
      headers: {
        [HttpHeaderName.ACCEPT]: MediaType.APPLICATION_JSON,
      },
    });

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const body = await parseJsonSafely<HandHistoryDetailResponse>(response);
    return validateDetailResponse(body);
  },
});

const historyApi = createHistoryApi(fetch as FetchLike);

export const getHandHistories = (query?: HistoryListQuery) =>
  historyApi.getHands(query);
export const getHandHistoryDetail = (handId: string) =>
  historyApi.getHandDetail(handId);
