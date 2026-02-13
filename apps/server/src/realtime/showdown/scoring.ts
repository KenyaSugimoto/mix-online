import { CardRank, type CardRank as CardRankType } from "@mix-online/shared";
import type { CardValue, HighScore, LowScore } from "./types";

const HIGH_CARD_LABELS: Record<number, string> = {
  8: "Straight Flush",
  7: "Four of a Kind",
  6: "Full House",
  5: "Flush",
  4: "Straight",
  3: "Three of a Kind",
  2: "Two Pair",
  1: "One Pair",
  0: "High Card",
};

const HIGH_RANK_VALUES: Record<CardRankType, number> = {
  [CardRank.A]: 14,
  [CardRank.K]: 13,
  [CardRank.Q]: 12,
  [CardRank.J]: 11,
  [CardRank.T]: 10,
  [CardRank.N9]: 9,
  [CardRank.N8]: 8,
  [CardRank.N7]: 7,
  [CardRank.N6]: 6,
  [CardRank.N5]: 5,
  [CardRank.N4]: 4,
  [CardRank.N3]: 3,
  [CardRank.N2]: 2,
};

const LOW_RANK_VALUES: Record<CardRankType, number> = {
  [CardRank.A]: 1,
  [CardRank.K]: 13,
  [CardRank.Q]: 12,
  [CardRank.J]: 11,
  [CardRank.T]: 10,
  [CardRank.N9]: 9,
  [CardRank.N8]: 8,
  [CardRank.N7]: 7,
  [CardRank.N6]: 6,
  [CardRank.N5]: 5,
  [CardRank.N4]: 4,
  [CardRank.N3]: 3,
  [CardRank.N2]: 2,
};

const highRankValue = (rank: CardRankType): number => HIGH_RANK_VALUES[rank];

const lowRankValue = (rank: CardRankType): number => LOW_RANK_VALUES[rank];

export const compareHighScores = (
  left: HighScore,
  right: HighScore,
): number => {
  const max = Math.max(left.length, right.length);
  for (let index = 0; index < max; index += 1) {
    const l = left[index] ?? -1;
    const r = right[index] ?? -1;
    if (l !== r) {
      return l - r;
    }
  }
  return 0;
};

export const compareLowScores = (left: LowScore, right: LowScore): number => {
  const max = Math.max(left.length, right.length);
  for (let index = 0; index < max; index += 1) {
    const l = left[index] ?? 99;
    const r = right[index] ?? 99;
    if (l !== r) {
      return r - l;
    }
  }
  return 0;
};

const combinations = <T>(items: T[], choose: number): T[][] => {
  if (choose === 0) {
    return [[]];
  }
  if (items.length < choose) {
    return [];
  }

  const [head, ...tail] = items;
  if (!head) {
    return [];
  }

  const withHead = combinations(tail, choose - 1).map((subset) => [
    head,
    ...subset,
  ]);
  const withoutHead = combinations(tail, choose);
  return [...withHead, ...withoutHead];
};

const evaluateFiveHigh = (cards: CardValue[]): HighScore => {
  const values = cards
    .map((card) => highRankValue(card.rank))
    .sort((a, b) => b - a);
  const suits = cards.map((card) => card.suit);
  const countsByRank = new Map<number, number>();
  for (const value of values) {
    countsByRank.set(value, (countsByRank.get(value) ?? 0) + 1);
  }
  const groups = [...countsByRank.entries()].sort((left, right) => {
    if (left[1] !== right[1]) {
      return right[1] - left[1];
    }
    return right[0] - left[0];
  });

  const isFlush = suits.every((suit) => suit === suits[0]);
  const uniqueValues = [...new Set(values)].sort((a, b) => b - a);
  let straightHigh = 0;
  if (uniqueValues.length === 5) {
    const highest = uniqueValues[0];
    const lowest = uniqueValues[4];
    if (
      highest !== undefined &&
      lowest !== undefined &&
      highest - lowest === 4
    ) {
      straightHigh = highest;
    } else if (
      uniqueValues[0] === 14 &&
      uniqueValues[1] === 5 &&
      uniqueValues[2] === 4 &&
      uniqueValues[3] === 3 &&
      uniqueValues[4] === 2
    ) {
      straightHigh = 5;
    }
  }

  if (isFlush && straightHigh > 0) {
    return [8, straightHigh];
  }
  if (groups[0]?.[1] === 4) {
    return [7, groups[0][0], groups[1]?.[0] ?? 0];
  }
  if (groups[0]?.[1] === 3 && groups[1]?.[1] === 2) {
    return [6, groups[0][0], groups[1][0]];
  }
  if (isFlush) {
    return [5, ...values];
  }
  if (straightHigh > 0) {
    return [4, straightHigh];
  }
  if (groups[0]?.[1] === 3) {
    const kickers = groups
      .slice(1)
      .map((entry) => entry[0])
      .sort((a, b) => b - a);
    return [3, groups[0][0], ...kickers];
  }
  if (groups[0]?.[1] === 2 && groups[1]?.[1] === 2) {
    const topPair = Math.max(groups[0][0], groups[1][0]);
    const secondPair = Math.min(groups[0][0], groups[1][0]);
    const kicker = groups.find((entry) => entry[1] === 1)?.[0] ?? 0;
    return [2, topPair, secondPair, kicker];
  }
  if (groups[0]?.[1] === 2) {
    const pairRank = groups[0][0];
    const kickers = groups
      .slice(1)
      .map((entry) => entry[0])
      .sort((a, b) => b - a);
    return [1, pairRank, ...kickers];
  }
  return [0, ...values];
};

export const evaluateBestHigh = (cards: CardValue[]): HighScore => {
  const allFive = combinations(cards, 5);
  let best: HighScore | null = null;
  for (const hand of allFive) {
    const score = evaluateFiveHigh(hand);
    if (best === null || compareHighScores(score, best) > 0) {
      best = score;
    }
  }
  return best ?? [0];
};

export const evaluateBestLowAto5 = (cards: CardValue[]): LowScore | null => {
  const allFive = combinations(cards, 5);
  let best: LowScore | null = null;

  for (const hand of allFive) {
    const values = hand.map((card) => lowRankValue(card.rank));
    const sortedDesc = [...values].sort((a, b) => b - a);
    if (best === null || compareLowScores(sortedDesc, best) > 0) {
      best = sortedDesc;
    }
  }

  return best;
};

export const qualifiesStud8Low = (score: LowScore | null): boolean => {
  if (!score) {
    return false;
  }
  if ((score[0] ?? 99) > 8) {
    return false;
  }
  return new Set(score).size === 5;
};

export const labelForHighScore = (score: HighScore): string | null =>
  HIGH_CARD_LABELS[score[0] ?? 0] ?? null;
