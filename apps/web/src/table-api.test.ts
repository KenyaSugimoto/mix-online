import {
  BettingStructure,
  ErrorCode,
  GameType,
  HandStatus,
  SeatStatus,
  Street,
  TableStatus,
} from "@mix-online/shared";
import { describe, expect, it, vi } from "vitest";
import { type TableApiError, createTableApi } from "./table-api";
import { HttpHeaderName, HttpStatusCode, MediaType } from "./web-constants";

describe("table-api", () => {
  it("getTable が卓詳細を返す", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          table: {
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
            seats: [
              {
                seatNo: 1,
                status: SeatStatus.ACTIVE,
                userId: "b1b2c3d4-1111-4111-8111-111111111111",
                displayName: "Alice",
                stack: 1600,
                isYou: true,
                joinedAt: "2026-02-11T11:30:00.000Z",
                disconnectStreak: 0,
              },
            ],
            currentHand: {
              handId: "c1b2c3d4-0002-4000-8000-000000000099",
              handNo: 99,
              status: HandStatus.IN_PROGRESS,
              street: Street.FIFTH,
              potTotal: 430,
              streetBetTo: 40,
              raiseCount: 1,
              toActSeatNo: 2,
              actionDeadlineAt: "2026-02-11T12:40:00.000Z",
            },
          },
        }),
        {
          status: HttpStatusCode.OK,
          headers: {
            [HttpHeaderName.CONTENT_TYPE]: MediaType.APPLICATION_JSON,
          },
        },
      );
    });

    const api = createTableApi(fetchMock);
    await expect(
      api.getTable("a1b2c3d4-0002-4000-8000-000000000002"),
    ).resolves.toMatchObject({
      table: {
        tableName: "Table 2",
        status: TableStatus.BETTING,
        gameType: GameType.RAZZ,
      },
    });
  });

  it("getTable がAPIエラー時に TableApiError を投げる", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.NOT_FOUND,
            message: "卓が見つかりません。",
          },
        }),
        {
          status: HttpStatusCode.NOT_FOUND,
          headers: {
            [HttpHeaderName.CONTENT_TYPE]: MediaType.APPLICATION_JSON,
          },
        },
      );
    });

    const api = createTableApi(fetchMock);
    await expect(
      api.getTable("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    ).rejects.toMatchObject({
      name: "TableApiError",
      status: HttpStatusCode.NOT_FOUND,
      code: ErrorCode.NOT_FOUND,
    } satisfies Partial<TableApiError>);
  });

  it("getTable が不正レスポンスを受けた場合にエラーを返す", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          table: {
            tableId: "a1b2c3d4-0002-4000-8000-000000000002",
            tableName: "Table 2",
            status: "UNKNOWN",
          },
        }),
        {
          status: HttpStatusCode.OK,
          headers: {
            [HttpHeaderName.CONTENT_TYPE]: MediaType.APPLICATION_JSON,
          },
        },
      );
    });

    const api = createTableApi(fetchMock);
    await expect(
      api.getTable("a1b2c3d4-0002-4000-8000-000000000002"),
    ).rejects.toMatchObject({
      name: "TableApiError",
      code: ErrorCode.INTERNAL_SERVER_ERROR,
    } satisfies Partial<TableApiError>);
  });
});
