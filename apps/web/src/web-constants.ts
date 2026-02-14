export const ApiPath = {
  AUTH_GOOGLE_START: "/api/auth/google/start",
  AUTH_ME: "/api/auth/me",
  AUTH_LOGOUT: "/api/auth/logout",
  LOBBY_TABLES: "/api/lobby/tables",
  TABLES_PREFIX: "/api/tables/",
  HISTORY_HANDS: "/api/history/hands",
  HISTORY_HANDS_PREFIX: "/api/history/hands/",
} as const;

export const RoutePath = {
  ROOT: "/",
  LOGIN: "/login",
  LOBBY: "/lobby",
  HISTORY: "/history",
  TABLES_ROOT: "/tables",
  TABLES_PREFIX: "/tables/",
} as const;

export const HttpMethod = {
  GET: "GET",
  POST: "POST",
} as const;

export const HttpStatusCode = {
  BAD_REQUEST: 400,
  OK: 200,
  NO_CONTENT: 204,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const HttpHeaderName = {
  ACCEPT: "Accept",
  CONTENT_TYPE: "Content-Type",
} as const;

export const MediaType = {
  APPLICATION_JSON: "application/json",
} as const;

export const LocaleCode = {
  EN_US: "en-US",
  JA_JP: "ja-JP",
} as const;

export const NumberFormatStyle = {
  CURRENCY: "currency",
} as const;

export const CurrencyCode = {
  USD: "USD",
} as const;

export const AuthStateStatus = {
  IDLE: "idle",
  LOADING: "loading",
  AUTHENTICATED: "authenticated",
  UNAUTHENTICATED: "unauthenticated",
  ERROR: "error",
} as const;

export const LobbyStateStatus = {
  LOADING: "loading",
  LOADED: "loaded",
  ERROR: "error",
} as const;

export const HistoryDetailStateStatus = {
  IDLE: "idle",
  LOADING: "loading",
  LOADED: "loaded",
  ERROR: "error",
} as const;

export const toTablePath = (tableId: string) =>
  `${RoutePath.TABLES_ROOT}/${tableId}`;

export const toTableDetailApiPath = (tableId: string) =>
  `${ApiPath.TABLES_PREFIX}${encodeURIComponent(tableId)}`;

export const toHistoryHandDetailApiPath = (handId: string) =>
  `${ApiPath.HISTORY_HANDS_PREFIX}${encodeURIComponent(handId)}`;
