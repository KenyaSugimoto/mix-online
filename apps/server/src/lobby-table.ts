import { GameType } from "@mix-online/shared";

export type LobbyTableRecord = {
  tableId: string;
  tableName: string;
  smallBet: number;
  bigBet: number;
  ante: number;
  bringIn: number;
  players: number;
  maxPlayers: number;
  mixIndex: number;
};

type LobbyTableSummary = {
  tableId: string;
  tableName: string;
  stakes: {
    smallBet: number;
    bigBet: number;
    ante: number;
    bringIn: number;
    bettingStructure: "FIXED_LIMIT";
    display: string;
  };
  players: number;
  maxPlayers: number;
  gameType: (typeof GameType)[keyof typeof GameType];
  emptySeats: number;
};

export type LobbyTablesResponse = {
  tables: LobbyTableSummary[];
  serverTime: string;
};

const mixIndexToGameType = (
  mixIndex: number,
): (typeof GameType)[keyof typeof GameType] => {
  switch (mixIndex) {
    case 0:
      return GameType.STUD_HI;
    case 1:
      return GameType.RAZZ;
    case 2:
      return GameType.STUD_8;
    default:
      return GameType.STUD_HI;
  }
};

const toTableSummary = (record: LobbyTableRecord): LobbyTableSummary => {
  const players = Math.min(Math.max(record.players, 0), record.maxPlayers);
  const emptySeats = Math.max(record.maxPlayers - players, 0);

  return {
    tableId: record.tableId,
    tableName: record.tableName,
    stakes: {
      smallBet: record.smallBet,
      bigBet: record.bigBet,
      ante: record.ante,
      bringIn: record.bringIn,
      bettingStructure: "FIXED_LIMIT",
      display: `$${record.smallBet}/$${record.bigBet} Fixed Limit`,
    },
    players,
    maxPlayers: record.maxPlayers,
    gameType: mixIndexToGameType(record.mixIndex),
    emptySeats,
  };
};

export const toLobbyTablesResponse = (
  records: LobbyTableRecord[],
  now: Date,
): LobbyTablesResponse => {
  return {
    tables: records.map((record) => toTableSummary(record)),
    serverTime: now.toISOString(),
  };
};
