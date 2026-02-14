import {
  ActionType,
  BettingStructure,
  ErrorCode,
  GameType,
  HandStatus,
  PotSide,
  SeatStatus,
  Street,
  TableStatus,
} from "@mix-online/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app";
import { createInMemorySessionStore } from "../../auth-session";
import {
  createInMemoryAuthUserRepository,
  toDefaultDisplayName,
} from "../../repository/auth";

describe("HTTP統合テスト", () => {
  const TEST_GOOGLE_OAUTH_CONFIG = {
    authEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    clientId: "test-google-client-id",
    clientSecret: "test-google-client-secret",
    redirectUri: "http://localhost:3000/api/auth/google/callback",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    userInfoEndpoint: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
  } as const;

  const createAuthenticatedApp = () => {
    const sessionStore = createInMemorySessionStore();
    const session = sessionStore.create(
      {
        userId: "f1b2c3d4-9999-4999-8999-999999999999",
        displayName: "MVP User",
        walletBalance: 4000,
      },
      new Date("2026-02-11T12:00:00.000Z"),
    );
    const app = createApp({
      sessionStore,
      now: () => new Date("2026-02-11T12:30:00.000Z"),
      historyCursorSecret: "test-history-cursor-secret",
    });

    return {
      app,
      cookie: `session=${session.sessionId}`,
    };
  };

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ロビー一覧レスポンスが OpenAPI スキーマに準拠する", async () => {
    const app = createApp();
    const response = await app.request("/api/lobby/tables");
    const body = (await response.json()) as {
      tables: Array<{
        tableId: string;
        tableName: string;
        stakes: {
          smallBet: number;
          bigBet: number;
          ante: number;
          bringIn: number;
          bettingStructure: string;
          display: string;
        };
        players: number;
        maxPlayers: number;
        gameType: string;
        emptySeats: number;
      }>;
      serverTime: string;
    };

    expect(response.status).toBe(200);
    expect(body.tables).toHaveLength(2);
    expect(body.serverTime).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/,
    );

    const [table] = body.tables;
    expect(table).toMatchObject({
      tableId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
      tableName: expect.any(String),
      stakes: {
        smallBet: 20,
        bigBet: 40,
        ante: 5,
        bringIn: 10,
        bettingStructure: BettingStructure.FIXED_LIMIT,
        display: "$20/$40 Fixed Limit",
      },
      players: expect.any(Number),
      maxPlayers: 6,
      gameType: GameType.STUD_HI,
      emptySeats: expect.any(Number),
    });
  });

  it("Google OAuth開始APIが state Cookie付きでリダイレクトする", async () => {
    const app = createApp({
      googleOAuthConfig: TEST_GOOGLE_OAUTH_CONFIG,
    });
    const response = await app.request("/api/auth/google/start");
    const location = response.headers.get("location");
    const setCookie = response.headers.get("set-cookie");

    expect(response.status).toBe(302);
    expect(location).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(location).toContain("client_id=test-google-client-id");
    expect(location).toContain("state=");
    expect(setCookie).toContain("oauth_state=");
    expect(setCookie).toContain("HttpOnly");
  });

  it("Google OAuth client_id 未設定時は INTERNAL_SERVER_ERROR を返す", async () => {
    const app = createApp();
    const response = await app.request("/api/auth/google/start");
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(500);
    expect(body.error.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    expect(body.error.message).toContain("GOOGLE_OAUTH_CLIENT_ID");
  });

  it("Google callbackで code/state が欠落している場合に BAD_REQUEST を返す", async () => {
    const app = createApp();
    const response = await app.request("/api/auth/google/callback?state=test");
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe(ErrorCode.BAD_REQUEST);
  });

  it("Google callbackで state が一致した場合に session Cookieを発行する", async () => {
    const authUserRepository = createInMemoryAuthUserRepository();
    const googleOAuthClient = {
      exchangeCodeForUser: vi.fn().mockResolvedValue({
        googleSub: "google-sub-100",
        displayName: "OAuth User 100",
      }),
    };
    const app = createApp({
      googleOAuthConfig: TEST_GOOGLE_OAUTH_CONFIG,
      authUserRepository,
      googleOAuthClient,
    });
    const state = "11111111-1111-4111-8111-111111111111";
    const response = await app.request(
      `/api/auth/google/callback?code=fake-code&state=${state}`,
      {
        headers: {
          cookie: `oauth_state=${state}`,
        },
      },
    );
    const location = response.headers.get("location");
    const setCookie = response.headers.get("set-cookie");
    const sessionId = setCookie?.match(/session=([^;]+)/)?.[1];

    expect(response.status).toBe(302);
    expect(location).toBe("/lobby");
    expect(setCookie).toContain("session=");
    expect(setCookie).toContain("oauth_state=");
    expect(googleOAuthClient.exchangeCodeForUser).toHaveBeenCalledWith({
      code: "fake-code",
      config: TEST_GOOGLE_OAUTH_CONFIG,
    });
    expect(sessionId).toBeDefined();

    const meResponse = await app.request("/api/auth/me", {
      headers: {
        cookie: `session=${sessionId}`,
      },
    });
    const meBody = (await meResponse.json()) as {
      user: {
        userId: string;
        displayName: string;
        walletBalance: number;
      };
    };

    expect(meResponse.status).toBe(200);
    expect(meBody.user.displayName).toBe(
      toDefaultDisplayName("google-sub-100"),
    );
    expect(meBody.user.userId).not.toBe("f1b2c3d4-9999-4999-8999-999999999999");
    expect(meBody.user.walletBalance).toBe(4000);
  });

  it("Google callbackで同一sub再ログインしても表示名を上書きしない", async () => {
    const authUserRepository = createInMemoryAuthUserRepository();
    const googleOAuthClient = {
      exchangeCodeForUser: vi
        .fn()
        .mockResolvedValueOnce({
          googleSub: "google-sub-300",
          displayName: "Real Name 300",
        })
        .mockResolvedValueOnce({
          googleSub: "google-sub-300",
          displayName: "Changed Real Name 300",
        }),
    };
    const app = createApp({
      googleOAuthConfig: TEST_GOOGLE_OAUTH_CONFIG,
      authUserRepository,
      googleOAuthClient,
    });

    const firstState = "11111111-1111-4111-8111-111111111111";
    const firstCallbackResponse = await app.request(
      `/api/auth/google/callback?code=first-code&state=${firstState}`,
      {
        headers: {
          cookie: `oauth_state=${firstState}`,
        },
      },
    );
    const firstSessionId =
      firstCallbackResponse.headers
        .get("set-cookie")
        ?.match(/session=([^;]+)/)?.[1] ?? null;
    expect(firstSessionId).toBeTruthy();

    const firstMeResponse = await app.request("/api/auth/me", {
      headers: {
        cookie: `session=${firstSessionId}`,
      },
    });
    const firstMeBody = (await firstMeResponse.json()) as {
      user: {
        displayName: string;
      };
    };
    expect(firstMeBody.user.displayName).toBe(
      toDefaultDisplayName("google-sub-300"),
    );

    const secondState = "22222222-2222-4222-8222-222222222222";
    const secondCallbackResponse = await app.request(
      `/api/auth/google/callback?code=second-code&state=${secondState}`,
      {
        headers: {
          cookie: `oauth_state=${secondState}`,
        },
      },
    );
    const secondSessionId =
      secondCallbackResponse.headers
        .get("set-cookie")
        ?.match(/session=([^;]+)/)?.[1] ?? null;
    expect(secondSessionId).toBeTruthy();

    const secondMeResponse = await app.request("/api/auth/me", {
      headers: {
        cookie: `session=${secondSessionId}`,
      },
    });
    const secondMeBody = (await secondMeResponse.json()) as {
      user: {
        displayName: string;
      };
    };
    expect(secondMeBody.user.displayName).toBe(
      toDefaultDisplayName("google-sub-300"),
    );
  });

  it("Google callbackで webClientOrigin 指定時はフロントURLへリダイレクトする", async () => {
    const authUserRepository = createInMemoryAuthUserRepository();
    const googleOAuthClient = {
      exchangeCodeForUser: vi.fn().mockResolvedValue({
        googleSub: "google-sub-200",
        displayName: "OAuth User 200",
      }),
    };
    const app = createApp({
      googleOAuthConfig: TEST_GOOGLE_OAUTH_CONFIG,
      authUserRepository,
      googleOAuthClient,
      webClientOrigin: "http://localhost:5173",
    });
    const state = "11111111-1111-4111-8111-111111111111";
    const response = await app.request(
      `/api/auth/google/callback?code=fake-code&state=${state}`,
      {
        headers: {
          cookie: `oauth_state=${state}`,
        },
      },
    );
    const location = response.headers.get("location");

    expect(response.status).toBe(302);
    expect(location).toBe("http://localhost:5173/lobby");
  });

  it("Google callbackで client secret 未設定時は INTERNAL_SERVER_ERROR を返す", async () => {
    const app = createApp({
      googleOAuthConfig: {
        ...TEST_GOOGLE_OAUTH_CONFIG,
        clientSecret: "",
      },
    });
    const state = "11111111-1111-4111-8111-111111111111";
    const response = await app.request(
      `/api/auth/google/callback?code=fake-code&state=${state}`,
      {
        headers: {
          cookie: `oauth_state=${state}`,
        },
      },
    );
    const body = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(500);
    expect(body.error.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    expect(body.error.message).toContain("GOOGLE_OAUTH_CLIENT_SECRET");
  });

  it("認証なしで /api/auth/me を呼ぶと AUTH_EXPIRED を返す", async () => {
    const app = createApp();
    const response = await app.request("/api/auth/me");
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(body.error.code).toBe(ErrorCode.AUTH_EXPIRED);
  });

  it("/api/auth/me が現在ユーザー情報を返す", async () => {
    const sessionStore = createInMemorySessionStore();
    const createdSession = sessionStore.create(
      {
        userId: "f1b2c3d4-9999-4999-8999-999999999999",
        displayName: "MVP User",
        walletBalance: 4000,
      },
      new Date("2026-02-11T12:00:00.000Z"),
    );
    const app = createApp({
      sessionStore,
      now: () => new Date("2026-02-11T12:00:00.000Z"),
    });
    const response = await app.request("/api/auth/me", {
      headers: {
        cookie: `session=${createdSession.sessionId}`,
      },
    });
    const body = (await response.json()) as {
      user: {
        userId: string;
        displayName: string;
        walletBalance: number;
      };
    };

    expect(response.status).toBe(200);
    expect(body.user).toEqual({
      userId: "f1b2c3d4-9999-4999-8999-999999999999",
      displayName: "MVP User",
      walletBalance: 4000,
    });
  });

  it("/api/auth/logout がセッションを無効化する", async () => {
    const sessionStore = createInMemorySessionStore();
    const createdSession = sessionStore.create(
      {
        userId: "f1b2c3d4-9999-4999-8999-999999999999",
        displayName: "MVP User",
        walletBalance: 4000,
      },
      new Date("2026-02-11T12:00:00.000Z"),
    );
    const app = createApp({
      sessionStore,
      now: () => new Date("2026-02-11T12:00:00.000Z"),
    });

    const logoutResponse = await app.request("/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: `session=${createdSession.sessionId}`,
      },
    });
    const logoutSetCookie = logoutResponse.headers.get("set-cookie");

    expect(logoutResponse.status).toBe(204);
    expect(logoutSetCookie).toContain("session=");
    expect(logoutSetCookie).toContain("Max-Age=0");

    const meResponse = await app.request("/api/auth/me", {
      headers: {
        cookie: `session=${createdSession.sessionId}`,
      },
    });
    const meBody = (await meResponse.json()) as {
      error: { code: string };
    };

    expect(meResponse.status).toBe(401);
    expect(meBody.error.code).toBe(ErrorCode.AUTH_EXPIRED);
  });

  it("認証なしで /api/history/hands を呼ぶと AUTH_EXPIRED を返す", async () => {
    const app = createApp();
    const response = await app.request("/api/history/hands");
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(body.error.code).toBe(ErrorCode.AUTH_EXPIRED);
  });

  it("/api/history/hands が `endedAt DESC, handId DESC` で履歴一覧を返す", async () => {
    const { app, cookie } = createAuthenticatedApp();
    const response = await app.request("/api/history/hands", {
      headers: {
        cookie,
      },
    });
    const body = (await response.json()) as {
      items: Array<{
        handId: string;
        endedAt: string;
      }>;
      nextCursor: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(3);
    expect(body.items.map((item) => item.handId)).toEqual([
      "d1b2c3d4-0003-4000-8000-000000000003",
      "d1b2c3d4-0002-4000-8000-000000000002",
      "d1b2c3d4-0001-4000-8000-000000000001",
    ]);
    expect(body.nextCursor).toBeNull();
  });

  it("/api/history/hands が cursor と limit でページングできる", async () => {
    const { app, cookie } = createAuthenticatedApp();
    const firstResponse = await app.request("/api/history/hands?limit=2", {
      headers: {
        cookie,
      },
    });
    const firstBody = (await firstResponse.json()) as {
      items: Array<{
        handId: string;
      }>;
      nextCursor: string | null;
    };

    expect(firstResponse.status).toBe(200);
    expect(firstBody.items).toHaveLength(2);
    expect(firstBody.nextCursor).toBeTypeOf("string");

    const secondResponse = await app.request(
      `/api/history/hands?limit=2&cursor=${encodeURIComponent(firstBody.nextCursor ?? "")}`,
      {
        headers: {
          cookie,
        },
      },
    );
    const secondBody = (await secondResponse.json()) as {
      items: Array<{
        handId: string;
      }>;
      nextCursor: string | null;
    };

    expect(secondResponse.status).toBe(200);
    expect(secondBody.items).toHaveLength(1);
    expect(secondBody.items[0]?.handId).toBe(
      "d1b2c3d4-0001-4000-8000-000000000001",
    );
    expect(secondBody.nextCursor).toBeNull();
  });

  it("/api/history/hands で改ざんcursorは INVALID_CURSOR を返す", async () => {
    const { app, cookie } = createAuthenticatedApp();
    const response = await app.request("/api/history/hands?cursor=tampered", {
      headers: {
        cookie,
      },
    });
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe(ErrorCode.INVALID_CURSOR);
  });

  it("/api/history/hands/:handId が履歴詳細を返す", async () => {
    const { app, cookie } = createAuthenticatedApp();
    const response = await app.request(
      "/api/history/hands/d1b2c3d4-0003-4000-8000-000000000003",
      {
        headers: {
          cookie,
        },
      },
    );
    const body = (await response.json()) as {
      handId: string;
      tableId: string;
      gameType: string;
      participants: Array<{ userId: string; seatNo: number }>;
      streetActions: Array<{
        street: string;
        actions: Array<{ seq: number; actionType: string; isAuto: boolean }>;
      }>;
      showdown: {
        hasShowdown: boolean;
        potResults: Array<{ potNo: number; side: string; amount: number }>;
      };
      profitLoss: number;
      startedAt: string;
      endedAt: string;
    };

    expect(response.status).toBe(200);
    expect(body.handId).toBe("d1b2c3d4-0003-4000-8000-000000000003");
    expect(body.gameType).toBe(GameType.STUD_HI);
    expect(body.participants).toHaveLength(2);
    expect(body.streetActions[0]?.street).toBe(Street.THIRD);
    expect(body.streetActions[0]?.actions[0]?.actionType).toBe(ActionType.ANTE);
    expect(body.showdown.hasShowdown).toBe(true);
    expect(body.showdown.potResults[0]?.side).toBe(PotSide.SCOOP);
  });

  it("一覧と詳細で handId/tableId/profitLoss が整合する", async () => {
    const { app, cookie } = createAuthenticatedApp();
    const listResponse = await app.request("/api/history/hands", {
      headers: {
        cookie,
      },
    });
    const listBody = (await listResponse.json()) as {
      items: Array<{
        handId: string;
        tableId: string;
        profitLoss: number;
      }>;
    };
    const firstListItem = listBody.items[0];
    expect(firstListItem).toBeDefined();

    const detailResponse = await app.request(
      `/api/history/hands/${firstListItem?.handId}`,
      {
        headers: {
          cookie,
        },
      },
    );
    const detailBody = (await detailResponse.json()) as {
      handId: string;
      tableId: string;
      profitLoss: number;
    };

    expect(detailResponse.status).toBe(200);
    expect(detailBody.handId).toBe(firstListItem?.handId);
    expect(detailBody.tableId).toBe(firstListItem?.tableId);
    expect(detailBody.profitLoss).toBe(firstListItem?.profitLoss);
  });

  it("/api/history/hands/:handId で未存在handは NOT_FOUND を返す", async () => {
    const { app, cookie } = createAuthenticatedApp();
    const response = await app.request(
      "/api/history/hands/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      {
        headers: {
          cookie,
        },
      },
    );
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it("認証なしで /api/history/hands/:handId を呼ぶと AUTH_EXPIRED を返す", async () => {
    const app = createApp();
    const response = await app.request(
      "/api/history/hands/d1b2c3d4-0003-4000-8000-000000000003",
    );
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(body.error.code).toBe(ErrorCode.AUTH_EXPIRED);
  });

  it("x-request-id を受け取った場合はレスポンスに同値を返す", async () => {
    const app = createApp();
    const requestId = "33333333-3333-4333-8333-333333333333";
    const response = await app.request("/api/health", {
      headers: {
        "x-request-id": requestId,
      },
    });
    const body = (await response.json()) as {
      requestId: string;
    };

    expect(response.status).toBe(200);
    expect(body.requestId).toBe(requestId);
  });

  it("不正な tableId で BAD_REQUEST を返す", async () => {
    const app = createApp();
    const response = await app.request("/api/tables/not-uuid");
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe(ErrorCode.BAD_REQUEST);
  });

  it("卓詳細レスポンスが OpenAPI スキーマに準拠する", async () => {
    const app = createApp();
    const response = await app.request(
      "/api/tables/a1b2c3d4-0002-4000-8000-000000000002",
    );
    const body = (await response.json()) as {
      table: {
        tableId: string;
        tableName: string;
        status: string;
        gameType: string;
        mixIndex: number;
        handsSinceRotation: number;
        dealerSeatNo: number;
        stakes: {
          smallBet: number;
          bigBet: number;
          ante: number;
          bringIn: number;
          bettingStructure: string;
          display: string;
        };
        minPlayers: number;
        maxPlayers: number;
        seats: Array<{
          seatNo: number;
          status: string;
          userId: string | null;
          displayName: string | null;
          stack: number;
          isYou: boolean;
          joinedAt: string | null;
          disconnectStreak: number | null;
        }>;
        currentHand: {
          handId: string;
          handNo: number;
          status: string;
          street: string;
          potTotal: number;
          streetBetTo: number;
          raiseCount: number;
          toActSeatNo: number | null;
          actionDeadlineAt: string | null;
        } | null;
      };
    };

    expect(response.status).toBe(200);
    expect(body.table).toMatchObject({
      tableId: "a1b2c3d4-0002-4000-8000-000000000002",
      tableName: "Table 2",
      status: TableStatus.BETTING,
      gameType: GameType.RAZZ,
      mixIndex: 1,
      handsSinceRotation: 3,
      dealerSeatNo: 4,
      stakes: {
        smallBet: 20,
        bigBet: 40,
        ante: 5,
        bringIn: 10,
        bettingStructure: BettingStructure.FIXED_LIMIT,
        display: "$20/$40 Fixed Limit",
      },
      minPlayers: 2,
      maxPlayers: 6,
    });
    expect(body.table.seats).toHaveLength(6);
    expect(body.table.seats[0]).toMatchObject({
      seatNo: 1,
      status: SeatStatus.ACTIVE,
      stack: 1600,
      isYou: true,
    });
    expect(body.table.currentHand).toMatchObject({
      handId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
      handNo: 99,
      status: HandStatus.IN_PROGRESS,
      street: Street.FIFTH,
      potTotal: 430,
      streetBetTo: 40,
      raiseCount: 1,
      toActSeatNo: 2,
      actionDeadlineAt: "2026-02-11T12:40:00.000Z",
    });
  });

  it("存在しない tableId で NOT_FOUND を返す", async () => {
    const app = createApp();
    const response = await app.request(
      "/api/tables/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    const body = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it("未知のエンドポイントで NOT_FOUND を返す", async () => {
    const app = createApp();
    const response = await app.request("/api/unknown");
    const body = (await response.json()) as {
      error: { code: string; requestId: string };
    };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe(ErrorCode.NOT_FOUND);
    expect(body.error.requestId).toBeTypeOf("string");
  });

  it("不正な x-request-id は再採番される", async () => {
    const app = createApp();
    const response = await app.request("/api/health", {
      headers: {
        "x-request-id": "not-uuid",
      },
    });
    const body = (await response.json()) as {
      requestId: string;
    };

    expect(response.status).toBe(200);
    expect(body.requestId).not.toBe("not-uuid");
    expect(body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("未捕捉例外を INTERNAL_SERVER_ERROR へ正規化する", async () => {
    const app = createApp();
    app.get("/api/_test/internal-error", () => {
      throw new Error("unexpected");
    });

    const response = await app.request("/api/_test/internal-error");
    const body = (await response.json()) as {
      error: { code: string; requestId: string };
    };

    expect(response.status).toBe(500);
    expect(body.error.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    expect(body.error.requestId).toBeTypeOf("string");
  });
});
