import {
  ActionType,
  GameType,
  HandStatus,
  PotSide,
  SeatStatus,
  Street,
  TableEventName,
  TableStatus,
} from "@mix-online/shared";
import { describe, expect, it, vi } from "vitest";
import { createSupabaseHistoryRepository } from "../../repository/history-repository.supabase";
import { createSupabaseLobbyTableRepository } from "../../repository/lobby-table-repository.supabase";
import { createSupabaseTableDetailRepository } from "../../repository/table-detail-repository.supabase";

const SUPABASE_URL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = "service-role-key";

describe("supabase api repositories", () => {
  it("lobby repository は table_seats を集計して卓サマリを返す", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "table-1",
              name: "Table 1",
              small_bet: 20,
              big_bet: 40,
              ante: 5,
              bring_in: 10,
              max_players: 6,
              mix_index: 0,
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              table_id: "table-1",
              user_id: "user-1",
              status: SeatStatus.ACTIVE,
            },
            {
              table_id: "table-1",
              user_id: null,
              status: SeatStatus.EMPTY,
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    const repository = createSupabaseLobbyTableRepository({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_ROLE_KEY,
      fetchImpl: fetchMock,
    });

    const tables = await repository.listTables();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(tables).toEqual([
      {
        tableId: "table-1",
        tableName: "Table 1",
        smallBet: 20,
        bigBet: 40,
        ante: 5,
        bringIn: 10,
        players: 1,
        maxPlayers: 6,
        mixIndex: 0,
      },
    ]);
  });

  it("table detail repository は snapshot を優先して currentHand を返す", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "table-1",
              name: "Table 1",
              status: TableStatus.WAITING,
              small_bet: 20,
              big_bet: 40,
              ante: 5,
              bring_in: 10,
              min_players: 2,
              max_players: 6,
              mix_index: 0,
              hands_since_rotation: 0,
              dealer_seat: 1,
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              seat_no: 1,
              status: SeatStatus.ACTIVE,
              user_id: "user-1",
              stack: 1500,
              joined_at: "2026-02-14T10:00:00.000Z",
              disconnect_streak: 0,
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "user-1",
              display_name: "Player 1",
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "hand-1",
              hand_no: 3,
              status: HandStatus.IN_PROGRESS,
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              payload: {
                table: {
                  currentHand: {
                    handId: "hand-1",
                    street: Street.FOURTH,
                    potTotal: 80,
                    toActSeatNo: 1,
                    actionDeadlineAt: "2026-02-14T10:05:00.000Z",
                  },
                },
              },
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const repository = createSupabaseTableDetailRepository({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_ROLE_KEY,
      fetchImpl: fetchMock,
    });

    const table = await repository.getById("table-1");

    expect(table).not.toBeNull();
    expect(table?.tableId).toBe("table-1");
    expect(table?.seats).toHaveLength(6);
    expect(table?.seats[0]).toMatchObject({
      seatNo: 1,
      status: SeatStatus.ACTIVE,
      userId: "user-1",
      displayName: "Player 1",
      stack: 1500,
      isYou: false,
    });
    expect(table?.currentHand).toMatchObject({
      handId: "hand-1",
      handNo: 3,
      status: HandStatus.IN_PROGRESS,
      street: Street.FOURTH,
      potTotal: 80,
      toActSeatNo: 1,
      actionDeadlineAt: "2026-02-14T10:05:00.000Z",
    });
  });

  it("history repository は履歴一覧を endedAt DESC で返す", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { hand_id: "hand-1", result_delta: 20 },
            { hand_id: "hand-2", result_delta: -5 },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "hand-1",
              table_id: "table-1",
              hand_no: 10,
              game_type: GameType.STUD_HI,
              started_at: "2026-02-14T09:00:00.000Z",
              ended_at: "2026-02-14T09:03:00.000Z",
            },
            {
              id: "hand-2",
              table_id: "table-1",
              hand_no: 11,
              game_type: GameType.RAZZ,
              started_at: "2026-02-14T09:05:00.000Z",
              ended_at: "2026-02-14T09:07:00.000Z",
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              hand_id: "hand-1",
              user_id: "user-1",
              seat_no: 1,
              result_delta: 20,
              cards_up: ["AH"],
              cards_down: ["AD"],
            },
            {
              hand_id: "hand-1",
              user_id: "user-2",
              seat_no: 2,
              result_delta: -20,
              cards_up: ["KH"],
              cards_down: ["KD"],
            },
            {
              hand_id: "hand-2",
              user_id: "user-1",
              seat_no: 1,
              result_delta: -5,
              cards_up: ["2H"],
              cards_down: ["2D"],
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: "user-1", display_name: "Alice" },
            { id: "user-2", display_name: "Bob" },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "table-1", name: "Table 1" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const repository = createSupabaseHistoryRepository({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_ROLE_KEY,
      fetchImpl: fetchMock,
    });

    const hands = await repository.listHands("user-1");

    expect(hands).toHaveLength(2);
    expect(hands[0]?.handId).toBe("hand-2");
    expect(hands[0]?.profitLoss).toBe(-5);
    expect(hands[1]?.handId).toBe("hand-1");
    expect(hands[1]?.participants[0]?.displayName).toBe("Alice");
  });

  it("history repository は履歴詳細をイベント/結果から再構成する", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ hand_id: "hand-1", result_delta: 30 }]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "hand-1",
              table_id: "table-1",
              hand_no: 12,
              game_type: GameType.STUD_HI,
              started_at: "2026-02-14T11:00:00.000Z",
              ended_at: "2026-02-14T11:03:00.000Z",
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              hand_id: "hand-1",
              user_id: "user-1",
              seat_no: 1,
              result_delta: 30,
              cards_up: ["AH"],
              cards_down: ["AD"],
            },
            {
              hand_id: "hand-1",
              user_id: "user-2",
              seat_no: 2,
              result_delta: -30,
              cards_up: ["KH"],
              cards_down: ["KD"],
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { id: "user-1", display_name: "Alice" },
            { id: "user-2", display_name: "Bob" },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "table-1", name: "Table 1" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              hand_seq: 1,
              event_name: TableEventName.PostAnteEvent,
              payload: {
                street: Street.THIRD,
                seatNo: 1,
                amount: 5,
                potAfter: 5,
              },
              created_at: "2026-02-14T11:00:10.000Z",
            },
            {
              hand_seq: 2,
              event_name: TableEventName.CheckEvent,
              payload: {
                street: Street.THIRD,
                seatNo: 2,
                isAuto: true,
                potAfter: 5,
              },
              created_at: "2026-02-14T11:00:20.000Z",
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              pot_no: 1,
              side: PotSide.SCOOP,
              winner_user_id: "user-1",
              amount: 60,
            },
          ]),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    const repository = createSupabaseHistoryRepository({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_ROLE_KEY,
      fetchImpl: fetchMock,
    });

    const detail = await repository.getHandDetail("user-1", "hand-1");

    expect(detail).not.toBeNull();
    expect(detail?.handId).toBe("hand-1");
    expect(detail?.profitLoss).toBe(30);
    expect(detail?.streetActions[0]?.actions[0]?.actionType).toBe(
      ActionType.ANTE,
    );
    expect(detail?.streetActions[0]?.actions[1]?.actionType).toBe(
      ActionType.AUTO_CHECK,
    );
    expect(detail?.showdown.hasShowdown).toBe(true);
    expect(detail?.showdown.potResults[0]?.side).toBe(PotSide.SCOOP);
  });
});
