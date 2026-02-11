import {
  BettingStructure,
  GameType,
  HandStatus,
  SeatStatus,
  Street,
  TableStatus,
} from "@mix-online/shared";
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
        bettingStructure: BettingStructure.FIXED_LIMIT,
        display: "$20/$40 Fixed Limit",
      },
      players: expect.any(Number),
      maxPlayers: 6,
      gameType: GameType.STUD_HI,
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
    expect(body.error.code).toBe("NOT_FOUND");
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
