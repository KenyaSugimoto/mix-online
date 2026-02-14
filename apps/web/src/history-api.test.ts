import {
  ActionType,
  ErrorCode,
  GameType,
  PotSide,
  Street,
} from "@mix-online/shared";
import { describe, expect, it, vi } from "vitest";
import { type HistoryApiError, createHistoryApi } from "./history-api";
import { HttpHeaderName, HttpStatusCode, MediaType } from "./web-constants";

describe("history-api", () => {
  it("getHands が履歴一覧を返す", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          items: [
            {
              handId: "d1b2c3d4-0003-4000-8000-000000000003",
              tableId: "a1b2c3d4-0001-4000-8000-000000000001",
              tableName: "Table 1",
              handNo: 3,
              gameType: GameType.STUD_HI,
              participants: [
                {
                  userId: "f1b2c3d4-9999-4999-8999-999999999999",
                  displayName: "MVP User",
                  seatNo: 1,
                  resultDelta: 120,
                  shownCardsUp: ["6H", "QH"],
                  shownCardsDown: ["KH", "JH"],
                },
              ],
              startedAt: "2026-02-11T12:10:00.000Z",
              endedAt: "2026-02-11T12:12:30.000Z",
              profitLoss: 120,
            },
          ],
          nextCursor: "next-cursor-token",
        }),
        {
          status: HttpStatusCode.OK,
          headers: {
            [HttpHeaderName.CONTENT_TYPE]: MediaType.APPLICATION_JSON,
          },
        },
      );
    });

    const api = createHistoryApi(fetchMock);
    await expect(api.getHands({ limit: 10 })).resolves.toMatchObject({
      items: [
        {
          handNo: 3,
          gameType: GameType.STUD_HI,
          profitLoss: 120,
        },
      ],
      nextCursor: "next-cursor-token",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/history/hands?limit=10",
      expect.any(Object),
    );
  });

  it("getHands がサーバーエラー時に HistoryApiError を投げる", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: ErrorCode.INTERNAL_SERVER_ERROR,
            message: "サーバー内部エラー",
          },
        }),
        {
          status: HttpStatusCode.INTERNAL_SERVER_ERROR,
          headers: {
            [HttpHeaderName.CONTENT_TYPE]: MediaType.APPLICATION_JSON,
          },
        },
      );
    });

    const api = createHistoryApi(fetchMock);
    await expect(api.getHands()).rejects.toMatchObject({
      name: "HistoryApiError",
      status: HttpStatusCode.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_SERVER_ERROR,
    } satisfies Partial<HistoryApiError>);
  });

  it("getHands が不正レスポンスを受けた場合にエラーを返す", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          items: [{ handId: "invalid" }],
          nextCursor: null,
        }),
        {
          status: HttpStatusCode.OK,
          headers: {
            [HttpHeaderName.CONTENT_TYPE]: MediaType.APPLICATION_JSON,
          },
        },
      );
    });

    const api = createHistoryApi(fetchMock);
    await expect(api.getHands()).rejects.toMatchObject({
      name: "HistoryApiError",
      code: ErrorCode.INTERNAL_SERVER_ERROR,
    } satisfies Partial<HistoryApiError>);
  });

  it("getHandDetail が履歴詳細を返す", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          handId: "d1b2c3d4-0003-4000-8000-000000000003",
          tableId: "a1b2c3d4-0001-4000-8000-000000000001",
          tableName: "Table 1",
          handNo: 3,
          gameType: GameType.STUD_HI,
          participants: [
            {
              userId: "f1b2c3d4-9999-4999-8999-999999999999",
              displayName: "MVP User",
              seatNo: 1,
              resultDelta: 120,
              shownCardsUp: ["6H", "QH"],
              shownCardsDown: ["KH", "JH"],
            },
          ],
          streetActions: [
            {
              street: Street.THIRD,
              actions: [
                {
                  seq: 1,
                  actionType: ActionType.ANTE,
                  seatNo: 1,
                  isAuto: false,
                  userId: "f1b2c3d4-9999-4999-8999-999999999999",
                  displayName: "MVP User",
                  amount: 5,
                  potAfter: 5,
                  occurredAt: "2026-02-11T12:10:03.000Z",
                },
              ],
            },
          ],
          showdown: {
            hasShowdown: true,
            potResults: [
              {
                potNo: 1,
                side: PotSide.SCOOP,
                winners: [
                  {
                    userId: "f1b2c3d4-9999-4999-8999-999999999999",
                    displayName: "MVP User",
                    amount: 210,
                  },
                ],
                amount: 210,
              },
            ],
          },
          profitLoss: 120,
          startedAt: "2026-02-11T12:10:00.000Z",
          endedAt: "2026-02-11T12:12:30.000Z",
        }),
        {
          status: HttpStatusCode.OK,
          headers: {
            [HttpHeaderName.CONTENT_TYPE]: MediaType.APPLICATION_JSON,
          },
        },
      );
    });

    const api = createHistoryApi(fetchMock);
    await expect(
      api.getHandDetail("d1b2c3d4-0003-4000-8000-000000000003"),
    ).resolves.toMatchObject({
      handId: "d1b2c3d4-0003-4000-8000-000000000003",
      gameType: GameType.STUD_HI,
      profitLoss: 120,
    });
  });
});
