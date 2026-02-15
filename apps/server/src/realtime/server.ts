import type { Server as HttpServer } from "node:http";
import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { type GoogleOAuthConfig, createApp } from "../app";
import { type SessionStore, createInMemorySessionStore } from "../auth-session";
import {
  type GoogleOAuthClient,
  createGoogleOAuthClient,
} from "../google-oauth-client";
import {
  type AuthUserRepository,
  createInMemoryAuthUserRepository,
  createSupabaseAuthUserRepository,
} from "../repository/auth";
import {
  type HistoryRepository,
  createRuntimeHistoryRepository,
  createSupabaseHistoryRepository,
} from "../repository/history";
import {
  type LobbyTableRepository,
  createSupabaseLobbyTableRepository,
} from "../repository/lobby";
import {
  type TableDetailRepository,
  createSupabaseTableDetailRepository,
} from "../repository/table-detail";
import {
  type RealtimeTableService,
  type RealtimeTableServiceRuntimeState,
  createRealtimeTableService,
} from "./table-service";
import { type WsGateway, createWsGateway } from "./ws-gateway";

export type RealtimeServer = {
  app: ReturnType<typeof createApp>;
  sessionStore: SessionStore;
  tableService: RealtimeTableService;
  wsGateway: WsGateway;
  port: number;
  close: () => Promise<void>;
};

type StartRealtimeServerOptions = {
  port?: number;
  sessionStore?: SessionStore;
  now?: () => Date;
  tableService?: RealtimeTableService;
  initialRealtimeState?: RealtimeTableServiceRuntimeState;
  actionTimeoutMs?: number;
  googleOAuthConfig?: Partial<GoogleOAuthConfig>;
  googleOAuthClient?: GoogleOAuthClient;
  authUserRepository?: AuthUserRepository;
  lobbyTableRepository?: LobbyTableRepository;
  tableDetailRepository?: TableDetailRepository;
  historyRepository?: HistoryRepository;
  webClientOrigin?: string;
};

type SupabaseConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
};

const DEFAULT_GOOGLE_OAUTH_AUTH_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
const DEFAULT_GOOGLE_OAUTH_REDIRECT_URI =
  "http://localhost:3000/api/auth/google/callback";
const DEFAULT_GOOGLE_OAUTH_TOKEN_ENDPOINT =
  "https://oauth2.googleapis.com/token";
const DEFAULT_GOOGLE_OAUTH_USER_INFO_ENDPOINT =
  "https://openidconnect.googleapis.com/v1/userinfo";
const DEFAULT_GOOGLE_OAUTH_SCOPE = "openid email profile";
const DEFAULT_WEB_CLIENT_ORIGIN = "http://localhost:5173";

const resolveGoogleOAuthConfig = (
  optionsConfig?: Partial<GoogleOAuthConfig>,
): GoogleOAuthConfig => {
  return {
    authEndpoint:
      optionsConfig?.authEndpoint ??
      process.env.GOOGLE_OAUTH_AUTH_ENDPOINT ??
      DEFAULT_GOOGLE_OAUTH_AUTH_ENDPOINT,
    clientId:
      optionsConfig?.clientId ?? process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    clientSecret:
      optionsConfig?.clientSecret ??
      process.env.GOOGLE_OAUTH_CLIENT_SECRET ??
      "",
    redirectUri:
      optionsConfig?.redirectUri ??
      process.env.GOOGLE_OAUTH_REDIRECT_URI ??
      DEFAULT_GOOGLE_OAUTH_REDIRECT_URI,
    tokenEndpoint:
      optionsConfig?.tokenEndpoint ??
      process.env.GOOGLE_OAUTH_TOKEN_ENDPOINT ??
      DEFAULT_GOOGLE_OAUTH_TOKEN_ENDPOINT,
    userInfoEndpoint:
      optionsConfig?.userInfoEndpoint ??
      process.env.GOOGLE_OAUTH_USERINFO_ENDPOINT ??
      DEFAULT_GOOGLE_OAUTH_USER_INFO_ENDPOINT,
    scope:
      optionsConfig?.scope ??
      process.env.GOOGLE_OAUTH_SCOPE ??
      DEFAULT_GOOGLE_OAUTH_SCOPE,
  };
};

const resolveSupabaseConfig = (): SupabaseConfig | null => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && supabaseServiceRoleKey) {
    return {
      supabaseUrl,
      serviceRoleKey: supabaseServiceRoleKey,
    };
  }

  return null;
};

const resolveAuthUserRepository = (params: {
  repositoryFromOptions?: AuthUserRepository;
  supabaseConfig: SupabaseConfig | null;
}): AuthUserRepository => {
  if (params.repositoryFromOptions) {
    return params.repositoryFromOptions;
  }

  if (params.supabaseConfig) {
    return createSupabaseAuthUserRepository({
      supabaseUrl: params.supabaseConfig.supabaseUrl,
      serviceRoleKey: params.supabaseConfig.serviceRoleKey,
    });
  }

  return createInMemoryAuthUserRepository();
};

const resolveLobbyTableRepository = (params: {
  repositoryFromOptions?: LobbyTableRepository;
  supabaseConfig: SupabaseConfig | null;
}) => {
  if (params.repositoryFromOptions) {
    return params.repositoryFromOptions;
  }

  if (params.supabaseConfig) {
    return createSupabaseLobbyTableRepository({
      supabaseUrl: params.supabaseConfig.supabaseUrl,
      serviceRoleKey: params.supabaseConfig.serviceRoleKey,
    });
  }

  return undefined;
};

const resolveTableDetailRepository = (params: {
  repositoryFromOptions?: TableDetailRepository;
  supabaseConfig: SupabaseConfig | null;
}) => {
  if (params.repositoryFromOptions) {
    return params.repositoryFromOptions;
  }

  if (params.supabaseConfig) {
    return createSupabaseTableDetailRepository({
      supabaseUrl: params.supabaseConfig.supabaseUrl,
      serviceRoleKey: params.supabaseConfig.serviceRoleKey,
    });
  }

  return undefined;
};

const resolveHistoryRepository = (params: {
  repositoryFromOptions?: HistoryRepository;
  supabaseConfig: SupabaseConfig | null;
}) => {
  if (params.repositoryFromOptions) {
    return params.repositoryFromOptions;
  }

  if (params.supabaseConfig) {
    return createSupabaseHistoryRepository({
      supabaseUrl: params.supabaseConfig.supabaseUrl,
      serviceRoleKey: params.supabaseConfig.serviceRoleKey,
    });
  }

  return undefined;
};

const mergeHistoryRepositories = (params: {
  primary: HistoryRepository | undefined;
  secondary: HistoryRepository;
}): HistoryRepository => {
  if (!params.primary) {
    return params.secondary;
  }

  return {
    async listHands(userId) {
      const [primaryItems, secondaryItems] = await Promise.all([
        params.primary?.listHands(userId) ?? [],
        params.secondary.listHands(userId),
      ]);

      const mergedByHandId = new Map<string, (typeof primaryItems)[number]>();
      for (const item of primaryItems) {
        mergedByHandId.set(item.handId, item);
      }
      for (const item of secondaryItems) {
        if (!mergedByHandId.has(item.handId)) {
          mergedByHandId.set(item.handId, item);
        }
      }

      return [...mergedByHandId.values()].sort((left, right) => {
        const endedAtCompare = right.endedAt.localeCompare(left.endedAt);
        if (endedAtCompare !== 0) {
          return endedAtCompare;
        }
        return right.handId.localeCompare(left.handId);
      });
    },
    async getHandDetail(userId, handId) {
      const primaryDetail = await params.primary?.getHandDetail(userId, handId);
      if (primaryDetail) {
        return primaryDetail;
      }
      return params.secondary.getHandDetail(userId, handId);
    },
  };
};

export const startRealtimeServer = (
  options: StartRealtimeServerOptions = {},
): RealtimeServer => {
  const sessionStore = options.sessionStore ?? createInMemorySessionStore();
  const tableService =
    options.tableService ??
    createRealtimeTableService({
      initialState: options.initialRealtimeState,
    });
  const googleOAuthConfig = resolveGoogleOAuthConfig(options.googleOAuthConfig);
  const googleOAuthClient =
    options.googleOAuthClient ?? createGoogleOAuthClient();
  const supabaseConfig = resolveSupabaseConfig();
  const authUserRepository = resolveAuthUserRepository({
    repositoryFromOptions: options.authUserRepository,
    supabaseConfig,
  });
  const lobbyTableRepository = resolveLobbyTableRepository({
    repositoryFromOptions: options.lobbyTableRepository,
    supabaseConfig,
  });
  const tableDetailRepository = resolveTableDetailRepository({
    repositoryFromOptions: options.tableDetailRepository,
    supabaseConfig,
  });
  const historyRepository = resolveHistoryRepository({
    repositoryFromOptions: options.historyRepository,
    supabaseConfig,
  });
  const runtimeHistoryRepository = createRuntimeHistoryRepository();
  const mergedHistoryRepository = mergeHistoryRepositories({
    primary: historyRepository,
    secondary: runtimeHistoryRepository,
  });
  const webClientOrigin =
    options.webClientOrigin ??
    process.env.WEB_CLIENT_ORIGIN ??
    DEFAULT_WEB_CLIENT_ORIGIN;
  const app = createApp({
    sessionStore,
    now: options.now,
    googleOAuthConfig,
    googleOAuthClient,
    authUserRepository,
    lobbyTableRepository,
    tableDetailRepository,
    historyRepository: mergedHistoryRepository,
    webClientOrigin,
  });
  const wsGateway = createWsGateway({
    sessionStore,
    now: options.now,
    tableService,
    onTableEvents: (events) => {
      runtimeHistoryRepository.recordEvents(events);
    },
    actionTimeoutMs: options.actionTimeoutMs,
  });
  // Pending状態のテーブルについて、アクション自動実行タイマーをスケジュールする (サーバ再起動対策)
  wsGateway.schedulePendingActions(tableService.listPendingActionTableIds());
  // HAND_ENDリビール待機中のテーブルについて、次ハンド開始タイマーを再設定する
  wsGateway.schedulePendingRevealWaits(
    tableService.listPendingRevealWaitTableIds(),
  );

  // Start HTTP server
  const server = serve({
    fetch: app.fetch,
    port: options.port ?? 3000,
  });

  // Start WebSocket server
  const wsServer = new WebSocketServer({
    server: server as HttpServer,
    path: "/ws",
  });

  // Handle WebSocket connections
  wsServer.on("connection", (socket, request) => {
    wsGateway.handleConnection({ socket, request });
  });

  const address = server.address();
  const port =
    typeof address === "object" && address !== null ? address.port : 3000;

  return {
    app,
    sessionStore,
    tableService,
    wsGateway,
    port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        wsServer.close((wsError) => {
          if (wsError) {
            reject(wsError);
            return;
          }

          server.close((httpError) => {
            if (httpError) {
              reject(httpError);
              return;
            }
            resolve();
          });
        });
      }),
  };
};
