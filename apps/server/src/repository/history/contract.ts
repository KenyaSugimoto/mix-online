import type {
  HandHistoryDetailRecord,
  HandHistoryListItemRecord,
} from "../../history-hand";

export interface HistoryRepository {
  listHands(userId: string): Promise<HandHistoryListItemRecord[]>;
  getHandDetail(
    userId: string,
    handId: string,
  ): Promise<HandHistoryDetailRecord | null>;
}
