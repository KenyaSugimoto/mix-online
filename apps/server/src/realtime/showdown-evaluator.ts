import {
  type CardRank,
  type CardSuit,
  GameType,
  type GameType as GameTypeType,
  PotSide,
  type PotSide as PotSideType,
} from "@mix-online/shared";

export type CardValue = {
  rank: CardRank;
  suit: CardSuit;
};

type HighScore = number[];
type LowScore = number[];

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

type EvaluatedPlayer = ShowdownPlayerInput & {
  highScore: HighScore;
  lowScore: LowScore | null;
};

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

const highRankValue = (rank: CardRank): number => {
  if (rank === "A") return 14;
  if (rank === "K") return 13;
  if (rank === "Q") return 12;
  if (rank === "J") return 11;
  if (rank === "T") return 10;
  return Number.parseInt(rank, 10);
};

const lowRankValue = (rank: CardRank): number => {
  if (rank === "A") return 1;
  if (rank === "K") return 13;
  if (rank === "Q") return 12;
  if (rank === "J") return 11;
  if (rank === "T") return 10;
  return Number.parseInt(rank, 10);
};

const compareHighScores = (left: HighScore, right: HighScore): number => {
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

const compareLowScores = (left: LowScore, right: LowScore): number => {
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

const evaluateBestHigh = (cards: CardValue[]): HighScore => {
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

const evaluateBestLowAto5 = (cards: CardValue[]): LowScore | null => {
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

const qualifiesStud8Low = (score: LowScore | null): boolean => {
  if (!score) {
    return false;
  }
  if ((score[0] ?? 99) > 8) {
    return false;
  }
  return new Set(score).size === 5;
};

const evaluatePlayers = (
  gameType: GameTypeType,
  players: ShowdownPlayerInput[],
): EvaluatedPlayer[] => {
  return players.map((player) => {
    const fullCards = [...player.cardsUp, ...player.cardsDown];
    const highScore = player.highScoreOverride ?? evaluateBestHigh(fullCards);
    const lowFromCards =
      gameType === GameType.STUD_HI
        ? null
        : (player.lowScoreOverride ?? evaluateBestLowAto5(fullCards));

    return {
      ...player,
      highScore,
      lowScore:
        gameType === GameType.STUD_8 && !qualifiesStud8Low(lowFromCards)
          ? null
          : lowFromCards,
    };
  });
};

export const buildSidePots = (
  players: Pick<ShowdownPlayerInput, "seatNo" | "contribution">[],
): PotLayer[] => {
  const levels = [
    ...new Set(
      players.map((player) => player.contribution).filter((value) => value > 0),
    ),
  ].sort((a, b) => a - b);
  const pots: PotLayer[] = [];
  let previous = 0;

  levels.forEach((level, index) => {
    const eligible = players.filter((player) => player.contribution >= level);
    const amount = (level - previous) * eligible.length;
    previous = level;
    if (amount > 0) {
      pots.push({
        potNo: index + 1,
        amount,
        eligibleSeatNos: eligible.map((player) => player.seatNo),
      });
    }
  });

  return pots;
};

export const splitAmountAcrossWinners = (params: {
  amount: number;
  winners: Array<
    Pick<ShowdownPlayerInput, "seatNo" | "userId" | "displayName">
  >;
  dealerSeatNo: number;
}): PotWinner[] => {
  if (params.winners.length === 0) {
    return [];
  }

  const ordered = [...params.winners].sort((left, right) => {
    const leftDistance = (left.seatNo - params.dealerSeatNo + 6) % 6;
    const rightDistance = (right.seatNo - params.dealerSeatNo + 6) % 6;
    return leftDistance - rightDistance;
  });

  const base = Math.floor(params.amount / ordered.length);
  let remainder = params.amount % ordered.length;

  return ordered.map((winner) => {
    const oddChip = remainder > 0 ? 1 : 0;
    if (remainder > 0) {
      remainder -= 1;
    }

    return {
      seatNo: winner.seatNo,
      userId: winner.userId,
      displayName: winner.displayName,
      amount: base + oddChip,
      handLabel: null,
    };
  });
};

const selectBestHigh = (players: EvaluatedPlayer[]): EvaluatedPlayer[] => {
  const sorted = [...players].sort((left, right) =>
    compareHighScores(right.highScore, left.highScore),
  );
  const best = sorted[0];
  if (!best) {
    return [];
  }
  return sorted.filter(
    (player) => compareHighScores(player.highScore, best.highScore) === 0,
  );
};

const selectBestLow = (players: EvaluatedPlayer[]): EvaluatedPlayer[] => {
  const lowPlayers = players.filter((player) => player.lowScore !== null);
  if (lowPlayers.length === 0) {
    return [];
  }

  const sorted = [...lowPlayers].sort((left, right) =>
    compareLowScores(right.lowScore as LowScore, left.lowScore as LowScore),
  );
  const best = sorted[0];
  if (!best?.lowScore) {
    return [];
  }

  return sorted.filter(
    (player) =>
      player.lowScore !== null &&
      compareLowScores(player.lowScore, best.lowScore as LowScore) === 0,
  );
};

export const createShowdownOutcome = (params: {
  gameType: GameTypeType;
  dealerSeatNo: number;
  players: ShowdownPlayerInput[];
}): ShowdownOutcome => {
  const evaluated = evaluatePlayers(params.gameType, params.players);
  const sidePots = buildSidePots(evaluated);
  const potResults: PotResult[] = [];

  for (const pot of sidePots) {
    const candidates = evaluated
      .filter(
        (player) =>
          pot.eligibleSeatNos.includes(player.seatNo) && !player.isFolded,
      )
      .map((player) => ({
        ...player,
        highScore: player.highScoreByPot?.[pot.potNo] ?? player.highScore,
        lowScore:
          player.lowScoreByPot?.[pot.potNo] === undefined
            ? player.lowScore
            : (player.lowScoreByPot?.[pot.potNo] ?? null),
      }));
    if (candidates.length === 0) {
      continue;
    }

    const highWinners = selectBestHigh(candidates);
    if (params.gameType === GameType.STUD_8) {
      const lowWinners = selectBestLow(candidates);
      if (lowWinners.length > 0) {
        const hiAmount = Math.floor(pot.amount / 2) + (pot.amount % 2);
        const loAmount = pot.amount - hiAmount;

        potResults.push({
          potNo: pot.potNo,
          side: PotSide.HI,
          amount: hiAmount,
          winners: splitAmountAcrossWinners({
            amount: hiAmount,
            winners: highWinners,
            dealerSeatNo: params.dealerSeatNo,
          }),
        });
        potResults.push({
          potNo: pot.potNo,
          side: PotSide.LO,
          amount: loAmount,
          winners: splitAmountAcrossWinners({
            amount: loAmount,
            winners: lowWinners,
            dealerSeatNo: params.dealerSeatNo,
          }),
        });
        continue;
      }
    }

    potResults.push({
      potNo: pot.potNo,
      side: PotSide.SINGLE,
      amount: pot.amount,
      winners: splitAmountAcrossWinners({
        amount: pot.amount,
        winners: highWinners,
        dealerSeatNo: params.dealerSeatNo,
      }).map((winner) => ({
        ...winner,
        handLabel:
          HIGH_CARD_LABELS[selectBestHigh(candidates)[0]?.highScore[0] ?? 0] ??
          null,
      })),
    });
  }

  const profitLossByUserId: Record<string, number> = {};
  for (const player of evaluated) {
    profitLossByUserId[player.userId] = -player.contribution;
  }
  for (const result of potResults) {
    for (const winner of result.winners) {
      profitLossByUserId[winner.userId] =
        (profitLossByUserId[winner.userId] ?? 0) + winner.amount;
    }
  }

  return {
    potResults,
    profitLossByUserId,
  };
};
