import { randomUUID } from "node:crypto";
import { ErrorCode } from "@mix-online/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  type SessionStore,
  type SessionUser,
  clearOauthStateCookie,
  clearSessionCookie,
  createInMemorySessionStore,
  createOauthStateCookie,
  createSessionCookie,
  getOauthStateFromCookie,
  getSessionIdFromCookie,
} from "./auth-session";
import { HttpAppError, toHttpErrorResponse } from "./error-response";
import { decodeHistoryCursor, encodeHistoryCursor } from "./history-cursor";
import { compareHistoryOrder } from "./history-hand";
import { toLobbyTablesResponse } from "./lobby-table";
import {
  type HistoryRepository,
  createMvpHistoryRepository,
} from "./repository/history-repository";
import {
  type LobbyTableRepository,
  createMvpLobbyTableRepository,
} from "./repository/lobby-table-repository";
import {
  type TableDetailRepository,
  createMvpTableDetailRepository,
} from "./repository/table-detail-repository";
import { toTableDetailResponse } from "./table-detail";
import { resolveRequestId, validateUuid } from "./validation";

export type AppVariables = {
  requestId: string;
};

export type GoogleOAuthConfig = {
  authEndpoint: string;
  clientId: string;
  redirectUri: string;
  scope: string;
};

type CreateAppOptions = {
  lobbyTableRepository?: LobbyTableRepository;
  tableDetailRepository?: TableDetailRepository;
  historyRepository?: HistoryRepository;
  historyCursorSecret?: string;
  sessionStore?: SessionStore;
  now?: () => Date;
  googleOAuthConfig?: GoogleOAuthConfig;
  webClientOrigin?: string;
};

const MVP_AUTH_USER: SessionUser = {
  userId: "f1b2c3d4-9999-4999-8999-999999999999",
  displayName: "MVP User",
  walletBalance: 4000,
};

const DEFAULT_GOOGLE_OAUTH_CONFIG: GoogleOAuthConfig = {
  authEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  clientId: "",
  redirectUri: "http://localhost:3000/api/auth/google/callback",
  scope: "openid email profile",
};
const GOOGLE_OAUTH_RESPONSE_TYPE = "code";
const POST_AUTH_REDIRECT_PATH = "/lobby";

const requireSession = (params: {
  cookieHeader: string | undefined;
  sessionStore: SessionStore;
  now: Date;
}) => {
  const sessionId = getSessionIdFromCookie(params.cookieHeader);

  if (!sessionId) {
    throw new HttpAppError(ErrorCode.AUTH_EXPIRED);
  }

  const session = params.sessionStore.findById(sessionId, params.now);
  if (!session) {
    throw new HttpAppError(ErrorCode.AUTH_EXPIRED);
  }

  return session;
};

export const createApp = (options: CreateAppOptions = {}) => {
  const app = new Hono<{ Variables: AppVariables }>();
  const lobbyTableRepository =
    options.lobbyTableRepository ?? createMvpLobbyTableRepository();
  const tableDetailRepository =
    options.tableDetailRepository ?? createMvpTableDetailRepository();
  const historyRepository =
    options.historyRepository ?? createMvpHistoryRepository();
  const historyCursorSecret =
    options.historyCursorSecret ?? "mvp-history-cursor-secret";
  const sessionStore = options.sessionStore ?? createInMemorySessionStore();
  const now = options.now ?? (() => new Date());
  const googleOAuthConfig =
    options.googleOAuthConfig ?? DEFAULT_GOOGLE_OAUTH_CONFIG;
  const webClientOrigin = options.webClientOrigin;

  app.use("/*", cors());

  // requestId を各リクエストに付与（クライアント指定が不正な場合は再採番）
  app.use("/*", async (c, next) => {
    const headerRequestId = c.req.header("x-request-id");
    const requestId = resolveRequestId(headerRequestId, () => randomUUID());
    c.set("requestId", requestId);
    await next();
  });

  app.onError((error, c) => {
    const requestId = c.get("requestId");

    if (error instanceof HttpAppError) {
      return c.json(
        toHttpErrorResponse(error.code, requestId, error.message),
        error.status,
      );
    }

    console.error(error);
    return c.json(
      toHttpErrorResponse(
        ErrorCode.INTERNAL_SERVER_ERROR,
        requestId,
        "サーバー内部でエラーが発生しました。",
      ),
      500,
    );
  });

  app.notFound((c) => {
    return c.json(
      toHttpErrorResponse(
        ErrorCode.NOT_FOUND,
        c.get("requestId"),
        "対象リソースが見つかりません。",
      ),
      404,
    );
  });

  // Health check
  app.get("/", (c) => {
    return c.json({
      message: "Hello Mix Stud Online!",
      requestId: c.get("requestId"),
    });
  });

  // API routes
  app.get("/api/health", (c) => {
    return c.json({ status: "ok", requestId: c.get("requestId") });
  });

  app.get("/api/auth/google/start", (c) => {
    if (!googleOAuthConfig.clientId) {
      throw new HttpAppError(
        ErrorCode.INTERNAL_SERVER_ERROR,
        "GOOGLE_OAUTH_CLIENT_ID が未設定です。サーバー環境変数を設定してください。",
      );
    }

    const state = randomUUID();
    const location = new URL(googleOAuthConfig.authEndpoint);
    location.searchParams.set("client_id", googleOAuthConfig.clientId);
    location.searchParams.set("response_type", GOOGLE_OAUTH_RESPONSE_TYPE);
    location.searchParams.set("scope", googleOAuthConfig.scope);
    location.searchParams.set("redirect_uri", googleOAuthConfig.redirectUri);
    location.searchParams.set("state", state);

    c.header("Set-Cookie", createOauthStateCookie(state));
    c.header("Location", location.toString());
    return c.body(null, 302);
  });

  app.get("/api/auth/google/callback", (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");

    if (!code || !state) {
      throw new HttpAppError(
        ErrorCode.BAD_REQUEST,
        "code と state は必須のクエリパラメータです。",
      );
    }

    const stateFromCookie = getOauthStateFromCookie(c.req.header("cookie"));
    if (!stateFromCookie || stateFromCookie !== state) {
      throw new HttpAppError(
        ErrorCode.AUTH_EXPIRED,
        "認証セッションが無効です。再度ログインをやり直してください。",
      );
    }

    const session = sessionStore.create(MVP_AUTH_USER, now());
    const redirectLocation = webClientOrigin
      ? new URL(POST_AUTH_REDIRECT_PATH, webClientOrigin).toString()
      : POST_AUTH_REDIRECT_PATH;
    c.header("Set-Cookie", createSessionCookie(session.sessionId));
    c.header("Set-Cookie", clearOauthStateCookie(), { append: true });
    c.header("Location", redirectLocation);
    return c.body(null, 302);
  });

  app.get("/api/auth/me", (c) => {
    const session = requireSession({
      cookieHeader: c.req.header("cookie"),
      sessionStore,
      now: now(),
    });

    return c.json({
      user: session.user,
    });
  });

  app.post("/api/auth/logout", (c) => {
    const session = requireSession({
      cookieHeader: c.req.header("cookie"),
      sessionStore,
      now: now(),
    });
    sessionStore.delete(session.sessionId);
    c.header("Set-Cookie", clearSessionCookie());

    return c.body(null, 204);
  });

  app.get("/api/lobby/tables", async (c) => {
    const tables = await lobbyTableRepository.listTables();

    return c.json(toLobbyTablesResponse(tables, now()));
  });

  app.get("/api/tables/:tableId", async (c) => {
    const tableId = validateUuid(c.req.param("tableId"), "tableId");
    const table = await tableDetailRepository.getById(tableId);

    if (table === null) {
      throw new HttpAppError(
        ErrorCode.NOT_FOUND,
        `tableId=${tableId} の卓は存在しません。`,
      );
    }

    return c.json(toTableDetailResponse(table));
  });

  app.get("/api/history/hands", async (c) => {
    const session = requireSession({
      cookieHeader: c.req.header("cookie"),
      sessionStore,
      now: now(),
    });

    const limitQuery = c.req.query("limit");
    const limit = limitQuery ? Number.parseInt(limitQuery, 10) : 20;

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new HttpAppError(
        ErrorCode.BAD_REQUEST,
        "limit は 1 以上 100 以下の整数で指定してください。",
      );
    }

    const allHands = await historyRepository.listHands(session.user.userId);
    const orderedHands = [...allHands].sort(compareHistoryOrder);

    const cursor = c.req.query("cursor");
    const cursorKey = cursor
      ? decodeHistoryCursor({
          cursor,
          now: now(),
          secret: historyCursorSecret,
        })
      : null;

    const filteredHands = cursorKey
      ? orderedHands.filter((hand) => compareHistoryOrder(hand, cursorKey) > 0)
      : orderedHands;

    const pageItems = filteredHands.slice(0, limit);
    const hasNextPage = filteredHands.length > limit;
    const lastItem = pageItems.at(-1);
    const nextCursor =
      hasNextPage && lastItem
        ? encodeHistoryCursor({
            cursorKey: {
              endedAt: lastItem.endedAt,
              handId: lastItem.handId,
            },
            now: now(),
            secret: historyCursorSecret,
          })
        : null;

    return c.json({
      items: pageItems,
      nextCursor,
    });
  });

  app.get("/api/history/hands/:handId", async (c) => {
    const session = requireSession({
      cookieHeader: c.req.header("cookie"),
      sessionStore,
      now: now(),
    });
    const handId = validateUuid(c.req.param("handId"), "handId");
    const hand = await historyRepository.getHandDetail(
      session.user.userId,
      handId,
    );

    if (hand === null) {
      throw new HttpAppError(
        ErrorCode.NOT_FOUND,
        `handId=${handId} の履歴は存在しません。`,
      );
    }

    return c.json(hand);
  });

  return app;
};
