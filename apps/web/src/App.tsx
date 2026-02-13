import { ErrorCode } from "@mix-online/shared";
import { useEffect, useMemo, useState } from "react";
import {
  AuthApiError,
  type UserProfile,
  formatChipsToUsd,
  getAuthMe,
  postAuthLogout,
} from "./auth-api";
import { resolveRoute } from "./routes";

type AuthState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "authenticated"; user: UserProfile }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };

const isProtectedRoute = (pathname: string) =>
  pathname === "/lobby" || pathname.startsWith("/tables/");

export function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [authState, setAuthState] = useState<AuthState>({ status: "idle" });
  const [authCheckVersion, setAuthCheckVersion] = useState(0);
  const route = useMemo(() => resolveRoute(pathname), [pathname]);
  const isProtected = isProtectedRoute(pathname);

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
    void authCheckVersion;

    if (!isProtected) {
      return;
    }

    let isCancelled = false;
    setAuthState({ status: "loading" });

    getAuthMe()
      .then((user) => {
        if (isCancelled) {
          return;
        }
        setAuthState({ status: "authenticated", user });
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        if (
          error instanceof AuthApiError &&
          (error.code === ErrorCode.AUTH_EXPIRED || error.status === 401)
        ) {
          setAuthState({ status: "unauthenticated" });
          return;
        }

        setAuthState({
          status: "error",
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
    window.location.assign("/api/auth/google/start");
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
    setAuthState({ status: "unauthenticated" });
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <header className="app-header surface">
        <div>
          <p className="eyebrow">MIX STUD ONLINE</p>
          <h1>Web Client MVP</h1>
          <p className="header-copy">
            Google OAuth と Cookie セッションでロビー導線を初期化します。
          </p>
        </div>
        <div className="header-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() => navigate("/login")}
          >
            ログイン画面
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={() => navigate("/lobby")}
          >
            ロビー画面
          </button>
        </div>
      </header>

      {isProtected ? (
        <ProtectedContent
          authState={authState}
          onLoginStart={startLogin}
          onRetry={retryAuth}
          onGoLogin={() => navigate("/login")}
          onLogout={logout}
          route={route}
        />
      ) : (
        <LoginScreen
          authState={authState}
          onLoginStart={startLogin}
          onGoLobby={() => navigate("/lobby")}
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
  onLogout: () => void;
  route: ReturnType<typeof resolveRoute>;
}) => {
  const { authState, onLoginStart, onRetry, onGoLogin, onLogout, route } =
    props;

  if (authState.status === "loading" || authState.status === "idle") {
    return (
      <section className="surface state-panel" aria-live="polite">
        <h2>認証状態を確認しています</h2>
        <p>
          callback 後の初期化として <code>GET /api/auth/me</code> を実行中です。
        </p>
      </section>
    );
  }

  if (authState.status === "unauthenticated") {
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

  if (authState.status === "error") {
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

  if (route.kind === "table") {
    return (
      <section className="surface state-panel">
        <h2>卓詳細（準備中）</h2>
        <p>
          <strong>tableId:</strong> {route.tableId}
        </p>
        <p>
          M4-03
          でテーブル画面を実装予定です。現在は認証ガードと画面遷移導線のみ有効です。
        </p>
        <div className="row-actions">
          <button
            className="primary-button"
            type="button"
            onClick={() => window.history.back()}
          >
            戻る
          </button>
          <button className="ghost-button" type="button" onClick={onLogout}>
            ログアウト
          </button>
        </div>
      </section>
    );
  }

  if (route.kind === "lobby") {
    return (
      <section className="surface state-panel">
        <h2>ロビー（M4-02で一覧実装）</h2>
        <p>
          ようこそ、<strong>{authState.user.displayName}</strong> さん。
        </p>
        <p>
          保有チップ:{" "}
          <strong>{formatChipsToUsd(authState.user.walletBalance)}</strong>
        </p>
        <p>
          認証済みユーザー初期化が完了しました。次タスクで卓一覧表示と参加導線を追加します。
        </p>
        <button className="ghost-button" type="button" onClick={onLogout}>
          ログアウト
        </button>
      </section>
    );
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
  const isAuthenticated = authState.status === "authenticated";

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
