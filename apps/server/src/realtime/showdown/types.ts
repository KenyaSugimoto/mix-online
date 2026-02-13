import type {
  CardRank as CardRankType,
  CardSuit,
  GameType as GameTypeType,
  PotSide as PotSideType,
} from "@mix-online/shared";

export type CardValue = {
  rank: CardRankType;
  suit: CardSuit;
};

export type HighScore = number[];
export type LowScore = number[];

export type ShowdownPlayerInput = {
  seatNo: number;
  userId: string;
  displayName: string;
  cardsUp: CardValue[];
  cardsDown: CardValue[];
  contribution: number;
  isFolded?: boolean;
  highScoreOverride?: HighScore;
  lowScoreOverride?: LowScore | null;
  highScoreByPot?: Record<number, HighScore>;
  lowScoreByPot?: Record<number, LowScore | null>;
};

export type PotLayer = {
  potNo: number;
  amount: number;
  eligibleSeatNos: number[];
};

export type PotWinner = {
  seatNo: number;
  userId: string;
  displayName: string;
  amount: number;
  handLabel: string | null;
};

export type PotResult = {
  potNo: number;
  side: PotSideType;
  amount: number;
  winners: PotWinner[];
};

export type ShowdownOutcome = {
  potResults: PotResult[];
  profitLossByUserId: Record<string, number>;
};

export type ShowdownGameType = GameTypeType;

export type EvaluatedPlayer = ShowdownPlayerInput & {
  highScore: HighScore;
  lowScore: LowScore | null;
};
