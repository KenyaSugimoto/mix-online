import type { ActionType, GameType, PotSide, Street } from "@mix-online/shared";

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

export type HandActionRecord = {
  seq: number;
  actionType: ActionType;
  seatNo: number;
  isAuto: boolean;
  userId: string | null;
  displayName: string | null;
  amount: number | null;
  potAfter: number | null;
  occurredAt: string;
};

export type StreetActionGroupRecord = {
  street: Street;
  actions: HandActionRecord[];
};

export type PotWinnerRecord = {
  userId: string;
  displayName: string;
  amount: number;
};

export type PotResultRecord = {
  potNo: number;
  side: PotSide;
  winners: PotWinnerRecord[];
  amount: number;
};

export type ShowdownSummaryRecord = {
  hasShowdown: boolean;
  potResults: PotResultRecord[];
};

export type HandHistoryDetailRecord = {
  handId: string;
  tableId: string;
  tableName?: string;
  handNo?: number;
  gameType: GameType;
  participants: HandParticipantRecord[];
  streetActions: StreetActionGroupRecord[];
  showdown: ShowdownSummaryRecord;
  profitLoss: number;
  startedAt: string;
  endedAt: string;
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
