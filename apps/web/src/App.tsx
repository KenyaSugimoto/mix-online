import { ErrorCode } from "@mix-online/shared";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  AuthApiError,
  type UserProfile,
  formatChipsToUsd,
  getAuthMe,
  patchAuthDisplayName,
  postAuthLogout,
} from "./auth-api";
import { HistoryScreen } from "./history-screen";
import {
  LobbyApiError,
  type LobbyTableSummary,
  getLobbyTables,
} from "./lobby-api";
import { AppRouteKind, resolveRoute } from "./routes";
import { TableScreen } from "./table-screen";
import {
  ApiPath,
  AuthStateStatus,
  HttpStatusCode,
  LobbyStateStatus,
  LocaleCode,
  RoutePath,
  toTablePath,
} from "./web-constants";

type AuthState =
  | { status: typeof AuthStateStatus.IDLE }
  | { status: typeof AuthStateStatus.LOADING }
  | { status: typeof AuthStateStatus.AUTHENTICATED; user: UserProfile }
  | { status: typeof AuthStateStatus.UNAUTHENTICATED }
  | { status: typeof AuthStateStatus.ERROR; message: string };

const ThemeOption = {
  DARK_EMERALD: "dark-emerald",
  DARK_NEON_POKER: "dark-neon-poker",
  POKERSTARS: "pokerstars",
  WSOP: "wsop",
} as const;

type ThemeOptionValue = (typeof ThemeOption)[keyof typeof ThemeOption];

const THEME_STORAGE_KEY = "mix-online-theme";

const THEME_LABELS: Record<ThemeOptionValue, string> = {
  [ThemeOption.DARK_EMERALD]: "Dark Emerald",
  [ThemeOption.DARK_NEON_POKER]: "Neon Poker Game",
  [ThemeOption.POKERSTARS]: "PokerStars",
  [ThemeOption.WSOP]: "WSOP",
};

const THEME_OPTIONS = [
  ThemeOption.DARK_EMERALD,
  ThemeOption.DARK_NEON_POKER,
  ThemeOption.POKERSTARS,
  ThemeOption.WSOP,
] as const;

const DEFAULT_THEME: ThemeOptionValue = ThemeOption.DARK_EMERALD;

const toThemeOption = (value: string | null): ThemeOptionValue => {
  if (
    value === ThemeOption.DARK_EMERALD ||
    value === ThemeOption.DARK_NEON_POKER ||
    value === ThemeOption.POKERSTARS ||
    value === ThemeOption.WSOP
  ) {
    return value;
  }
  return DEFAULT_THEME;
};

const isProtectedRoute = (pathname: string) =>
  pathname === RoutePath.LOBBY ||
  pathname === RoutePath.HISTORY ||
  pathname.startsWith(`${RoutePath.HISTORY}/`) ||
  pathname.startsWith(RoutePath.TABLES_PREFIX);

export function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [theme, setTheme] = useState<ThemeOptionValue>(() =>
    toThemeOption(window.localStorage.getItem(THEME_STORAGE_KEY)),
  );
  const [authState, setAuthState] = useState<AuthState>({
    status: AuthStateStatus.IDLE,
  });
  const [authCheckVersion, setAuthCheckVersion] = useState(0);
  const route = useMemo(() => resolveRoute(pathname), [pathname]);
  const isProtected = isProtectedRoute(pathname);
  const isTableRoute = route.kind === AppRouteKind.TABLE;

  useEffect(() => {
    const handlePopstate = () => {
      setPathname(window.location.pathname);
    };

    window.addEventListener("popstate", handlePopstate);
    return () => {
      window.removeEventListener("popstate", handlePopstate);
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    void authCheckVersion;

    if (!isProtected) {
      return;
    }

    let isCancelled = false;
    setAuthState({ status: AuthStateStatus.LOADING });

    getAuthMe()
      .then((user) => {
        if (isCancelled) {
          return;
        }
        setAuthState({ status: AuthStateStatus.AUTHENTICATED, user });
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        if (
          error instanceof AuthApiError &&
          (error.code === ErrorCode.AUTH_EXPIRED ||
            error.status === HttpStatusCode.UNAUTHORIZED)
        ) {
          setAuthState({ status: AuthStateStatus.UNAUTHENTICATED });
          return;
        }

        setAuthState({
          status: AuthStateStatus.ERROR,
          message:
            error instanceof Error
              ? error.message
              : "認証状態の取得に失敗しました。",
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [authCheckVersion, isProtected]);

  const navigate = (nextPath: string) => {
    if (window.location.pathname === nextPath) {
      return;
    }

    window.history.pushState({}, "", nextPath);
    setPathname(nextPath);
  };

  const startLogin = () => {
    window.location.assign(ApiPath.AUTH_GOOGLE_START);
  };

  const retryAuth = () => {
    setAuthCheckVersion((version) => version + 1);
  };

  const logout = async () => {
    try {
      await postAuthLogout();
    } catch {
      // ローカルセッション状態の破棄を優先する。
    }
    setAuthState({ status: AuthStateStatus.UNAUTHENTICATED });
    navigate(RoutePath.LOGIN);
  };

  const updateDisplayName = async (displayName: string) => {
    try {
      const updatedUser = await patchAuthDisplayName(displayName);
      setAuthState({
        status: AuthStateStatus.AUTHENTICATED,
        user: updatedUser,
      });
      return updatedUser;
    } catch (error: unknown) {
      if (
        error instanceof AuthApiError &&
        (error.code === ErrorCode.AUTH_EXPIRED ||
          error.status === HttpStatusCode.UNAUTHORIZED)
      ) {
        setAuthState({ status: AuthStateStatus.UNAUTHENTICATED });
      }
      throw error;
    }
  };

  return (
    <div className={`app-shell ${isTableRoute ? "is-table-route" : ""}`}>
      {isTableRoute ? null : (
        <header className="app-header surface">
          <div>
            <p className="eyebrow">MIX STUD ONLINE</p>
            <h1>Web Client MVP</h1>
            <p className="header-copy">
              Google OAuth と Cookie セッションでロビー導線を初期化します。
            </p>
          </div>
          <div className="header-actions">
            <label className="theme-picker" htmlFor="theme-select">
              Theme
              <select
                id="theme-select"
                className="theme-select"
                value={theme}
                onChange={(event) =>
                  setTheme(toThemeOption(event.target.value))
                }
              >
                {THEME_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {THEME_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="ghost-button"
              type="button"
              onClick={() => navigate(RoutePath.LOGIN)}
            >
              ログイン画面
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => navigate(RoutePath.LOBBY)}
            >
              ロビー画面
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => navigate(RoutePath.HISTORY)}
            >
              履歴画面
            </button>
          </div>
        </header>
      )}

      {isProtected ? (
        <ProtectedContent
          authState={authState}
          onLoginStart={startLogin}
          onRetry={retryAuth}
          onGoLogin={() => navigate(RoutePath.LOGIN)}
          onGoLobby={() => navigate(RoutePath.LOBBY)}
          onOpenTable={(tableId) => navigate(toTablePath(tableId))}
          onLogout={logout}
          onDisplayNameUpdate={updateDisplayName}
          route={route}
        />
      ) : (
        <LoginScreen
          authState={authState}
          onLoginStart={startLogin}
          onGoLobby={() => navigate(RoutePath.LOBBY)}
        />
      )}
    </div>
  );
}

const ProtectedContent = (props: {
  authState: AuthState;
  onLoginStart: () => void;
  onRetry: () => void;
  onGoLogin: () => void;
  onGoLobby: () => void;
  onOpenTable: (tableId: string) => void;
  onLogout: () => void;
  onDisplayNameUpdate: (displayName: string) => Promise<UserProfile>;
  route: ReturnType<typeof resolveRoute>;
}) => {
  const {
    authState,
    onLoginStart,
    onRetry,
    onGoLogin,
    onGoLobby,
    onOpenTable,
    onLogout,
    onDisplayNameUpdate,
    route,
  } = props;

  if (
    authState.status === AuthStateStatus.LOADING ||
    authState.status === AuthStateStatus.IDLE
  ) {
    return (
      <section className="surface state-panel" aria-live="polite">
        <h2>認証状態を確認しています</h2>
        <p>
          callback 後の初期化として <code>GET /api/auth/me</code> を実行中です。
        </p>
      </section>
    );
  }

  if (authState.status === AuthStateStatus.UNAUTHENTICATED) {
    return (
      <section className="surface state-panel">
        <h2>未認証です</h2>
        <p>
          ロビー/卓画面へ進むにはログインが必要です。Google OAuth
          を開始してください。
        </p>
        <div className="row-actions">
          <button
            className="primary-button"
            type="button"
            onClick={onLoginStart}
          >
            Googleでログイン
          </button>
          <button className="ghost-button" type="button" onClick={onGoLogin}>
            ログイン画面へ戻る
          </button>
        </div>
      </section>
    );
  }

  if (authState.status === AuthStateStatus.ERROR) {
    return (
      <section className="surface state-panel">
        <h2>認証状態の取得に失敗しました</h2>
        <p>{authState.message}</p>
        <button className="primary-button" type="button" onClick={onRetry}>
          再試行
        </button>
      </section>
    );
  }

  if (route.kind === AppRouteKind.TABLE) {
    return (
      <TableScreen
        tableId={route.tableId}
        currentUserId={authState.user.userId}
        onGoLobby={onGoLobby}
      />
    );
  }

  if (route.kind === AppRouteKind.LOBBY) {
    return (
      <LobbyScreen
        user={authState.user}
        onLogout={onLogout}
        onOpenTable={onOpenTable}
        onDisplayNameUpdate={onDisplayNameUpdate}
      />
    );
  }

  if (route.kind === AppRouteKind.HISTORY) {
    return <HistoryScreen onGoLobby={onGoLobby} onLogout={onLogout} />;
  }

  return (
    <section className="surface state-panel">
      <h2>画面が見つかりません</h2>
      <button className="primary-button" type="button" onClick={onGoLogin}>
        ログイン画面へ
      </button>
    </section>
  );
};

const LoginScreen = (props: {
  authState: AuthState;
  onLoginStart: () => void;
  onGoLobby: () => void;
}) => {
  const { authState, onLoginStart, onGoLobby } = props;
  const isAuthenticated = authState.status === AuthStateStatus.AUTHENTICATED;

  return (
    <section className="surface state-panel">
      <h2>Google OAuth ログイン</h2>
      <p>
        <code>GET /api/auth/google/start</code> に遷移して認証を開始します。
      </p>

      {isAuthenticated ? (
        <p className="status-chip">
          認証済み: {authState.user.displayName} /{" "}
          {formatChipsToUsd(authState.user.walletBalance)}
        </p>
      ) : null}

      <div className="row-actions">
        <button className="primary-button" type="button" onClick={onLoginStart}>
          Googleでログイン
        </button>
        <button className="ghost-button" type="button" onClick={onGoLobby}>
          ロビーへ移動
        </button>
      </div>
    </section>
  );
};

type LobbyState =
  | { status: typeof LobbyStateStatus.LOADING; requestVersion: number }
  | {
      status: typeof LobbyStateStatus.LOADED;
      tables: LobbyTableSummary[];
      serverTime: string;
    }
  | { status: typeof LobbyStateStatus.ERROR; message: string };

type DisplayNameUpdateState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const toDisplayNameUpdateErrorMessage = (error: unknown) => {
  if (error instanceof AuthApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return "表示名の更新に失敗しました。";
};

const LobbyScreen = (props: {
  user: UserProfile;
  onLogout: () => void;
  onOpenTable: (tableId: string) => void;
  onDisplayNameUpdate: (displayName: string) => Promise<UserProfile>;
}) => {
  const { user, onLogout, onOpenTable, onDisplayNameUpdate } = props;
  const [requestVersion, setRequestVersion] = useState(0);
  const [lobbyState, setLobbyState] = useState<LobbyState>({
    status: LobbyStateStatus.LOADING,
    requestVersion: 0,
  });
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState(user.displayName);
  const [displayNameUpdateState, setDisplayNameUpdateState] =
    useState<DisplayNameUpdateState>({
      status: "idle",
    });
  const isSavingDisplayName = displayNameUpdateState.status === "saving";

  useEffect(() => {
    let isCancelled = false;
    setLobbyState({ status: LobbyStateStatus.LOADING, requestVersion });

    getLobbyTables()
      .then((response) => {
        if (isCancelled) {
          return;
        }

        setLobbyState({
          status: LobbyStateStatus.LOADED,
          tables: response.tables,
          serverTime: response.serverTime,
        });
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        const message =
          error instanceof LobbyApiError
            ? error.message
            : "ロビー一覧の取得に失敗しました。";
        setLobbyState({ status: LobbyStateStatus.ERROR, message });
      });

    return () => {
      isCancelled = true;
    };
  }, [requestVersion]);

  useEffect(() => {
    setDisplayNameDraft(user.displayName);
  }, [user.displayName]);

  const startDisplayNameEdit = () => {
    setDisplayNameDraft(user.displayName);
    setDisplayNameUpdateState({ status: "idle" });
    setIsEditingDisplayName(true);
  };

  const cancelDisplayNameEdit = () => {
    setDisplayNameDraft(user.displayName);
    setDisplayNameUpdateState({ status: "idle" });
    setIsEditingDisplayName(false);
  };

  const submitDisplayNameUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDisplayNameUpdateState({ status: "saving" });

    try {
      await onDisplayNameUpdate(displayNameDraft);
      setDisplayNameUpdateState({
        status: "success",
        message: "表示名を更新しました。",
      });
      setIsEditingDisplayName(false);
    } catch (error: unknown) {
      setDisplayNameUpdateState({
        status: "error",
        message: toDisplayNameUpdateErrorMessage(error),
      });
    }
  };

  return (
    <section className="surface state-panel">
      <header className="lobby-header">
        <div>
          <h2>ロビー</h2>
          <p>
            ようこそ、<strong>{user.displayName}</strong> さん
          </p>
          <p>
            保有チップ: <strong>{formatChipsToUsd(user.walletBalance)}</strong>
          </p>
          <div className="profile-edit-panel">
            <p className="profile-edit-label">表示名</p>
            {isEditingDisplayName ? (
              <form
                className="profile-edit-form"
                onSubmit={submitDisplayNameUpdate}
              >
                <input
                  type="text"
                  value={displayNameDraft}
                  maxLength={64}
                  onChange={(event) => setDisplayNameDraft(event.target.value)}
                  disabled={isSavingDisplayName}
                  aria-label="表示名"
                />
                <div className="row-actions profile-edit-actions">
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={isSavingDisplayName}
                  >
                    {isSavingDisplayName ? "保存中..." : "保存"}
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={cancelDisplayNameEdit}
                    disabled={isSavingDisplayName}
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            ) : (
              <div className="profile-edit-row">
                <strong>{user.displayName}</strong>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={startDisplayNameEdit}
                >
                  表示名を編集
                </button>
              </div>
            )}
            {displayNameUpdateState.status === "success" ? (
              <p className="profile-edit-message is-success">
                {displayNameUpdateState.message}
              </p>
            ) : null}
            {displayNameUpdateState.status === "error" ? (
              <p className="profile-edit-message is-error">
                {displayNameUpdateState.message}
              </p>
            ) : null}
          </div>
        </div>
        <div className="row-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() => setRequestVersion((version) => version + 1)}
          >
            更新
          </button>
          <button className="ghost-button" type="button" onClick={onLogout}>
            ログアウト
          </button>
        </div>
      </header>

      {lobbyState.status === LobbyStateStatus.LOADING ? (
        <p className="status-chip">
          卓一覧を読み込み中です（リクエスト {lobbyState.requestVersion + 1}）
        </p>
      ) : null}

      {lobbyState.status === LobbyStateStatus.ERROR ? (
        <div className="surface inline-panel">
          <h3>ロビー一覧の取得に失敗しました</h3>
          <p>{lobbyState.message}</p>
          <button
            className="primary-button"
            type="button"
            onClick={() => setRequestVersion((version) => version + 1)}
          >
            再取得
          </button>
        </div>
      ) : null}

      {lobbyState.status === LobbyStateStatus.LOADED ? (
        <>
          <p className="timestamp">
            serverTime:{" "}
            {new Date(lobbyState.serverTime).toLocaleString(LocaleCode.JA_JP)}
          </p>
          <ul className="table-grid" aria-label="卓一覧">
            {lobbyState.tables.map((table) => (
              <li key={table.tableId} className="table-card">
                <header className="table-card-header">
                  <h3>{table.tableName}</h3>
                  <span className="status-chip">{table.gameType}</span>
                </header>
                <p>
                  ステークス: <strong>{table.stakes.display}</strong>
                </p>
                <p>
                  参加人数:{" "}
                  <strong>
                    {table.players} / {table.maxPlayers}
                  </strong>
                </p>
                <p>
                  空席: <strong>{table.emptySeats}</strong>
                </p>
                <p>
                  卓ID: <code>{table.tableId}</code>
                </p>
                <button
                  className="primary-button table-action"
                  type="button"
                  disabled={table.emptySeats <= 0}
                  onClick={() => onOpenTable(table.tableId)}
                >
                  {table.emptySeats <= 0 ? "満席" : "参加する"}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
};
