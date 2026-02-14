import type {
  HandHistoryDetailRecord,
  HandHistoryListItemRecord,
} from "../../history-hand";
import type { HistoryRepository } from "./contract";
import { MVP_AUTH_USER_ID, MVP_HAND_DETAILS_FOR_AUTH_USER } from "./mvp-data";

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
