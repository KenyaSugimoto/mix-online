import {
  BettingStructure,
  GameType,
  HandStatus,
  SeatStatus,
  Street,
  TableStatus,
} from "@mix-online/shared";
import { describe, expect, it } from "vitest";
import { toTableDetailResponse } from "../../table-detail";

describe("table-detail", () => {
  it("OpenAPI準拠の卓詳細へ変換する", () => {
    const response = toTableDetailResponse({
      tableId: "a1b2c3d4-0001-4000-8000-000000000001",
      tableName: "Table 1",
      status: TableStatus.BETTING,
      gameType: GameType.STUD_HI,
      mixIndex: 0,
      handsSinceRotation: 2,
      dealerSeatNo: 5,
      smallBet: 20,
      bigBet: 40,
      ante: 5,
      bringIn: 10,
      minPlayers: 2,
      maxPlayers: 6,
      seats: [
        {
          seatNo: 1,
          status: SeatStatus.ACTIVE,
          userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          displayName: "Player 1",
          stack: 1200,
          isYou: true,
          joinedAt: "2026-02-11T00:00:00.000Z",
          disconnectStreak: 0,
        },
      ],
      currentHand: {
        handId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        handNo: 12,
        status: HandStatus.IN_PROGRESS,
        street: Street.FOURTH,
        potTotal: 140,
        streetBetTo: 20,
        raiseCount: 1,
        toActSeatNo: 1,
        actionDeadlineAt: "2026-02-11T00:00:30.000Z",
      },
    });

    expect(response).toEqual({
      table: {
        tableId: "a1b2c3d4-0001-4000-8000-000000000001",
        tableName: "Table 1",
        status: TableStatus.BETTING,
        gameType: GameType.STUD_HI,
        mixIndex: 0,
        handsSinceRotation: 2,
        dealerSeatNo: 5,
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
            userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            displayName: "Player 1",
            stack: 1200,
            isYou: true,
            joinedAt: "2026-02-11T00:00:00.000Z",
            disconnectStreak: 0,
          },
        ],
        currentHand: {
          handId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          handNo: 12,
          status: HandStatus.IN_PROGRESS,
          street: Street.FOURTH,
          potTotal: 140,
          streetBetTo: 20,
          raiseCount: 1,
          toActSeatNo: 1,
          actionDeadlineAt: "2026-02-11T00:00:30.000Z",
        },
      },
    });
  });

  it("進行中ハンドが無い場合は currentHand に null を返す", () => {
    const response = toTableDetailResponse({
      tableId: "a1b2c3d4-0001-4000-8000-000000000001",
      tableName: "Table 1",
      status: TableStatus.WAITING,
      gameType: GameType.STUD_HI,
      mixIndex: 0,
      handsSinceRotation: 0,
      dealerSeatNo: 1,
      smallBet: 20,
      bigBet: 40,
      ante: 5,
      bringIn: 10,
      minPlayers: 2,
      maxPlayers: 6,
      seats: [],
      currentHand: null,
    });

    expect(response.table.currentHand).toBeNull();
  });
});
