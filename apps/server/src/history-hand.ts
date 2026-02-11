import type { GameType } from "@mix-online/shared";

export type HandParticipantRecord = {
  userId: string;
  displayName: string;
  seatNo: number;
  resultDelta: number | null;
  shownCardsUp: string[] | null;
  shownCardsDown: string[] | null;
};

export type HandHistoryListItemRecord = {
  handId: string;
  tableId: string;
  tableName?: string;
  handNo?: number;
  gameType: GameType;
  participants: HandParticipantRecord[];
  startedAt: string;
  endedAt: string;
  profitLoss: number;
};

export type HandHistoryListResponse = {
  items: HandHistoryListItemRecord[];
  nextCursor: string | null;
};

export type HandHistoryCursorKey = {
  endedAt: string;
  handId: string;
};

export const compareHistoryOrder = (
  left: HandHistoryCursorKey,
  right: HandHistoryCursorKey,
) => {
  const endedAtCompare = right.endedAt.localeCompare(left.endedAt);
  if (endedAtCompare !== 0) {
    return endedAtCompare;
  }

  return right.handId.localeCompare(left.handId);
};
