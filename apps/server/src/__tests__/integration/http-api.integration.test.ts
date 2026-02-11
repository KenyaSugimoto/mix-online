import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app";

describe("HTTP統合テスト", () => {
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
        bettingStructure: "FIXED_LIMIT",
        display: "$20/$40 Fixed Limit",
      },
      players: expect.any(Number),
      maxPlayers: 6,
      gameType: "STUD_HI",
      emptySeats: expect.any(Number),
    });
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
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("未知のエンドポイントで NOT_FOUND を返す", async () => {
    const app = createApp();
    const response = await app.request("/api/unknown");
    const body = (await response.json()) as {
      error: { code: string; requestId: string };
    };

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
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
    expect(body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.error.requestId).toBeTypeOf("string");
  });
});
