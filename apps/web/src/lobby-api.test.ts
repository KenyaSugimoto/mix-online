import { BettingStructure, ErrorCode, GameType } from "@mix-online/shared";
import { describe, expect, it, vi } from "vitest";
import { type LobbyApiError, createLobbyApi } from "./lobby-api";

describe("lobby-api", () => {
  it("getTables がロビー卓一覧を返す", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          tables: [
            {
              tableId: "d1b2c3d4-1111-4111-8111-111111111111",
              tableName: "MVP Table 1",
              stakes: {
                smallBet: 20,
                bigBet: 40,
                ante: 5,
                bringIn: 10,
                bettingStructure: BettingStructure.FIXED_LIMIT,
                display: "$20/$40 Fixed Limit",
              },
              players: 3,
              maxPlayers: 6,
              gameType: GameType.STUD_HI,
              emptySeats: 3,
            },
          ],
          serverTime: "2026-02-13T12:00:00.000Z",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    });

    const api = createLobbyApi(fetchMock);
    await expect(api.getTables()).resolves.toMatchObject({
      tables: [
        {
          tableName: "MVP Table 1",
          players: 3,
          maxPlayers: 6,
          gameType: GameType.STUD_HI,
          emptySeats: 3,
        },
      ],
      serverTime: "2026-02-13T12:00:00.000Z",
    });
  });

  it("getTables がサーバーエラー時に LobbyApiError を投げる", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.INTERNAL_SERVER_ERROR,
            message: "サーバー内部エラー",
          },
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    });

    const api = createLobbyApi(fetchMock);
    await expect(api.getTables()).rejects.toMatchObject({
      name: "LobbyApiError",
      status: 500,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
    } satisfies Partial<LobbyApiError>);
  });

  it("getTables が不正レスポンスを受けた場合にエラーを返す", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          tables: [{ tableId: "invalid" }],
          serverTime: "2026-02-13T12:00:00.000Z",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    });

    const api = createLobbyApi(fetchMock);
    await expect(api.getTables()).rejects.toMatchObject({
      name: "LobbyApiError",
      code: ErrorCode.INTERNAL_SERVER_ERROR,
    } satisfies Partial<LobbyApiError>);
  });
});
