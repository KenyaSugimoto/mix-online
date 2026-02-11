import { describe, expect, it } from "vitest";
import { toLobbyTablesResponse } from "../../lobby-table";

describe("lobby-table", () => {
  it("OpenAPI準拠の卓サマリへ変換する", () => {
    const now = new Date("2026-02-11T12:34:56.000Z");
    const response = toLobbyTablesResponse(
      [
        {
          tableId: "a1b2c3d4-0001-4000-8000-000000000001",
          tableName: "Table 1",
          smallBet: 20,
          bigBet: 40,
          ante: 5,
          bringIn: 10,
          players: 2,
          maxPlayers: 6,
          mixIndex: 1,
        },
      ],
      now,
    );

    expect(response.serverTime).toBe("2026-02-11T12:34:56.000Z");
    expect(response.tables).toEqual([
      {
        tableId: "a1b2c3d4-0001-4000-8000-000000000001",
        tableName: "Table 1",
        stakes: {
          smallBet: 20,
          bigBet: 40,
          ante: 5,
          bringIn: 10,
          bettingStructure: "FIXED_LIMIT",
          display: "$20/$40 Fixed Limit",
        },
        players: 2,
        maxPlayers: 6,
        gameType: "RAZZ",
        emptySeats: 4,
      },
    ]);
  });

  it("players は 0..maxPlayers に正規化する", () => {
    const now = new Date("2026-02-11T12:34:56.000Z");
    const response = toLobbyTablesResponse(
      [
        {
          tableId: "a1b2c3d4-0001-4000-8000-000000000001",
          tableName: "Table 1",
          smallBet: 20,
          bigBet: 40,
          ante: 5,
          bringIn: 10,
          players: 999,
          maxPlayers: 6,
          mixIndex: 0,
        },
        {
          tableId: "a1b2c3d4-0002-4000-8000-000000000002",
          tableName: "Table 2",
          smallBet: 20,
          bigBet: 40,
          ante: 5,
          bringIn: 10,
          players: -1,
          maxPlayers: 6,
          mixIndex: 2,
        },
      ],
      now,
    );

    expect(response.tables[0]?.players).toBe(6);
    expect(response.tables[0]?.emptySeats).toBe(0);
    expect(response.tables[1]?.players).toBe(0);
    expect(response.tables[1]?.emptySeats).toBe(6);
    expect(response.tables[1]?.gameType).toBe("STUD_8");
  });
});
