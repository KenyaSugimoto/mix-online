import type { LobbyTableRecord } from "../lobby-table";

export interface LobbyTableRepository {
  listTables(): Promise<LobbyTableRecord[]>;
}

const MVP_FIXED_TABLES: LobbyTableRecord[] = [
  {
    tableId: "a1b2c3d4-0001-4000-8000-000000000001",
    tableName: "Table 1",
    smallBet: 20,
    bigBet: 40,
    ante: 5,
    bringIn: 10,
    players: 0,
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
    players: 0,
    maxPlayers: 6,
    mixIndex: 0,
  },
];

export const createMvpLobbyTableRepository = (): LobbyTableRepository => {
  return {
    async listTables() {
      return MVP_FIXED_TABLES;
    },
  };
};
