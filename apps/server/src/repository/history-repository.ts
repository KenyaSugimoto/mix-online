import { ActionType, GameType, PotSide, Street } from "@mix-online/shared";
import type {
  HandHistoryDetailRecord,
  HandHistoryListItemRecord,
} from "../history-hand";

export interface HistoryRepository {
  listHands(userId: string): Promise<HandHistoryListItemRecord[]>;
  getHandDetail(
    userId: string,
    handId: string,
  ): Promise<HandHistoryDetailRecord | null>;
}

const MVP_AUTH_USER_ID = "f1b2c3d4-9999-4999-8999-999999999999";

const MVP_HAND_DETAILS_FOR_AUTH_USER: HandHistoryDetailRecord[] = [
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
    streetActions: [
      {
        street: Street.THIRD,
        actions: [
          {
            seq: 1,
            actionType: ActionType.ANTE,
            seatNo: 1,
            isAuto: false,
            userId: MVP_AUTH_USER_ID,
            displayName: "MVP User",
            amount: 5,
            potAfter: 5,
            occurredAt: "2026-02-11T12:10:03.000Z",
          },
          {
            seq: 2,
            actionType: ActionType.ANTE,
            seatNo: 2,
            isAuto: false,
            userId: "e1b2c3d4-8888-4888-8888-888888888888",
            displayName: "River",
            amount: 5,
            potAfter: 10,
            occurredAt: "2026-02-11T12:10:05.000Z",
          },
          {
            seq: 3,
            actionType: ActionType.COMPLETE,
            seatNo: 1,
            isAuto: false,
            userId: MVP_AUTH_USER_ID,
            displayName: "MVP User",
            amount: 20,
            potAfter: 30,
            occurredAt: "2026-02-11T12:10:15.000Z",
          },
          {
            seq: 4,
            actionType: ActionType.CALL,
            seatNo: 2,
            isAuto: false,
            userId: "e1b2c3d4-8888-4888-8888-888888888888",
            displayName: "River",
            amount: 20,
            potAfter: 50,
            occurredAt: "2026-02-11T12:10:20.000Z",
          },
        ],
      },
      {
        street: Street.FOURTH,
        actions: [
          {
            seq: 5,
            actionType: ActionType.BET,
            seatNo: 1,
            isAuto: false,
            userId: MVP_AUTH_USER_ID,
            displayName: "MVP User",
            amount: 20,
            potAfter: 70,
            occurredAt: "2026-02-11T12:10:45.000Z",
          },
          {
            seq: 6,
            actionType: ActionType.CALL,
            seatNo: 2,
            isAuto: false,
            userId: "e1b2c3d4-8888-4888-8888-888888888888",
            displayName: "River",
            amount: 20,
            potAfter: 90,
            occurredAt: "2026-02-11T12:10:55.000Z",
          },
        ],
      },
    ],
    showdown: {
      hasShowdown: true,
      potResults: [
        {
          potNo: 1,
          side: PotSide.SINGLE,
          winners: [
            {
              userId: MVP_AUTH_USER_ID,
              displayName: "MVP User",
              amount: 210,
            },
          ],
          amount: 210,
        },
      ],
    },
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
    streetActions: [
      {
        street: Street.THIRD,
        actions: [
          {
            seq: 1,
            actionType: ActionType.BRING_IN,
            seatNo: 5,
            isAuto: false,
            userId: "e1b2c3d4-7777-4777-8777-777777777777",
            displayName: "Turn",
            amount: 10,
            potAfter: 10,
            occurredAt: "2026-02-11T11:55:05.000Z",
          },
          {
            seq: 2,
            actionType: ActionType.CALL,
            seatNo: 4,
            isAuto: false,
            userId: MVP_AUTH_USER_ID,
            displayName: "MVP User",
            amount: 10,
            potAfter: 20,
            occurredAt: "2026-02-11T11:55:10.000Z",
          },
        ],
      },
      {
        street: Street.FOURTH,
        actions: [
          {
            seq: 3,
            actionType: ActionType.CHECK,
            seatNo: 5,
            isAuto: false,
            userId: "e1b2c3d4-7777-4777-8777-777777777777",
            displayName: "Turn",
            amount: null,
            potAfter: 20,
            occurredAt: "2026-02-11T11:55:40.000Z",
          },
          {
            seq: 4,
            actionType: ActionType.AUTO_CHECK,
            seatNo: 4,
            isAuto: true,
            userId: MVP_AUTH_USER_ID,
            displayName: "MVP User",
            amount: null,
            potAfter: 20,
            occurredAt: "2026-02-11T11:55:50.000Z",
          },
        ],
      },
    ],
    showdown: {
      hasShowdown: true,
      potResults: [
        {
          potNo: 1,
          side: PotSide.SINGLE,
          winners: [
            {
              userId: "e1b2c3d4-7777-4777-8777-777777777777",
              displayName: "Turn",
              amount: 80,
            },
          ],
          amount: 80,
        },
      ],
    },
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
    streetActions: [
      {
        street: Street.THIRD,
        actions: [
          {
            seq: 1,
            actionType: ActionType.ANTE,
            seatNo: 2,
            isAuto: false,
            userId: MVP_AUTH_USER_ID,
            displayName: "MVP User",
            amount: 5,
            potAfter: 5,
            occurredAt: "2026-02-11T11:40:03.000Z",
          },
          {
            seq: 2,
            actionType: ActionType.ANTE,
            seatNo: 6,
            isAuto: false,
            userId: "e1b2c3d4-6666-4666-8666-666666666666",
            displayName: "Flop",
            amount: 5,
            potAfter: 10,
            occurredAt: "2026-02-11T11:40:06.000Z",
          },
          {
            seq: 3,
            actionType: ActionType.CALL,
            seatNo: 2,
            isAuto: false,
            userId: MVP_AUTH_USER_ID,
            displayName: "MVP User",
            amount: 10,
            potAfter: 20,
            occurredAt: "2026-02-11T11:40:15.000Z",
          },
          {
            seq: 4,
            actionType: ActionType.CALL,
            seatNo: 6,
            isAuto: false,
            userId: "e1b2c3d4-6666-4666-8666-666666666666",
            displayName: "Flop",
            amount: 10,
            potAfter: 30,
            occurredAt: "2026-02-11T11:40:20.000Z",
          },
        ],
      },
    ],
    showdown: {
      hasShowdown: true,
      potResults: [
        {
          potNo: 1,
          side: PotSide.HI,
          winners: [
            {
              userId: MVP_AUTH_USER_ID,
              displayName: "MVP User",
              amount: 25,
            },
          ],
          amount: 25,
        },
        {
          potNo: 1,
          side: PotSide.LO,
          winners: [
            {
              userId: "e1b2c3d4-6666-4666-8666-666666666666",
              displayName: "Flop",
              amount: 25,
            },
          ],
          amount: 25,
        },
      ],
    },
  },
];

const toHistoryListItem = (
  detail: HandHistoryDetailRecord,
): HandHistoryListItemRecord => ({
  handId: detail.handId,
  tableId: detail.tableId,
  tableName: detail.tableName,
  handNo: detail.handNo,
  gameType: detail.gameType,
  participants: detail.participants,
  startedAt: detail.startedAt,
  endedAt: detail.endedAt,
  profitLoss: detail.profitLoss,
});

export const createMvpHistoryRepository = (): HistoryRepository => {
  return {
    async listHands(userId) {
      if (userId !== MVP_AUTH_USER_ID) {
        return [];
      }

      return MVP_HAND_DETAILS_FOR_AUTH_USER.map((detail) =>
        toHistoryListItem(detail),
      );
    },
    async getHandDetail(userId, handId) {
      if (userId !== MVP_AUTH_USER_ID) {
        return null;
      }

      return (
        MVP_HAND_DETAILS_FOR_AUTH_USER.find(
          (detail) => detail.handId === handId,
        ) ?? null
      );
    },
  };
};
