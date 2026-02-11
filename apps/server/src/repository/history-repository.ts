import { GameType } from "@mix-online/shared";
import type { HandHistoryListItemRecord } from "../history-hand";

export interface HistoryRepository {
  listHands(userId: string): Promise<HandHistoryListItemRecord[]>;
}

const MVP_AUTH_USER_ID = "f1b2c3d4-9999-4999-8999-999999999999";

const MVP_HANDS_FOR_AUTH_USER: HandHistoryListItemRecord[] = [
  {
    handId: "d1b2c3d4-0003-4000-8000-000000000003",
    tableId: "a1b2c3d4-0001-4000-8000-000000000001",
    tableName: "Table 1",
    handNo: 3,
    gameType: GameType.STUD_HI,
    participants: [
      {
        userId: MVP_AUTH_USER_ID,
        displayName: "MVP User",
        seatNo: 1,
        resultDelta: 120,
        shownCardsUp: ["6H", "QH", "AH", "2C"],
        shownCardsDown: ["KH", "JH", "8H"],
      },
      {
        userId: "e1b2c3d4-8888-4888-8888-888888888888",
        displayName: "River",
        seatNo: 2,
        resultDelta: -120,
        shownCardsUp: ["7S", "8S", "9S", "TS"],
        shownCardsDown: ["AS", "2S", "3S"],
      },
    ],
    startedAt: "2026-02-11T12:10:00.000Z",
    endedAt: "2026-02-11T12:12:30.000Z",
    profitLoss: 120,
  },
  {
    handId: "d1b2c3d4-0002-4000-8000-000000000002",
    tableId: "a1b2c3d4-0002-4000-8000-000000000002",
    tableName: "Table 2",
    handNo: 2,
    gameType: GameType.RAZZ,
    participants: [
      {
        userId: MVP_AUTH_USER_ID,
        displayName: "MVP User",
        seatNo: 4,
        resultDelta: -40,
        shownCardsUp: ["KD", "QC", "7D", "4C"],
        shownCardsDown: ["9H", "8H", "6H"],
      },
      {
        userId: "e1b2c3d4-7777-4777-8777-777777777777",
        displayName: "Turn",
        seatNo: 5,
        resultDelta: 40,
        shownCardsUp: ["2D", "3C", "4D", "5C"],
        shownCardsDown: ["AH", "2H", "3H"],
      },
    ],
    startedAt: "2026-02-11T11:55:00.000Z",
    endedAt: "2026-02-11T11:57:45.000Z",
    profitLoss: -40,
  },
  {
    handId: "d1b2c3d4-0001-4000-8000-000000000001",
    tableId: "a1b2c3d4-0001-4000-8000-000000000001",
    tableName: "Table 1",
    handNo: 1,
    gameType: GameType.STUD_8,
    participants: [
      {
        userId: MVP_AUTH_USER_ID,
        displayName: "MVP User",
        seatNo: 2,
        resultDelta: 0,
        shownCardsUp: ["5H", "6D", "7C", "8S"],
        shownCardsDown: ["AD", "2D", "3D"],
      },
      {
        userId: "e1b2c3d4-6666-4666-8666-666666666666",
        displayName: "Flop",
        seatNo: 6,
        resultDelta: 0,
        shownCardsUp: ["9C", "TD", "JH", "QS"],
        shownCardsDown: ["KC", "AC", "4C"],
      },
    ],
    startedAt: "2026-02-11T11:40:00.000Z",
    endedAt: "2026-02-11T11:42:00.000Z",
    profitLoss: 0,
  },
];

export const createMvpHistoryRepository = (): HistoryRepository => {
  return {
    async listHands(userId) {
      if (userId !== MVP_AUTH_USER_ID) {
        return [];
      }

      return MVP_HANDS_FOR_AUTH_USER;
    },
  };
};
