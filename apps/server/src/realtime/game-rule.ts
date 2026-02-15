import {
  CardRank,
  type CardRank as CardRankType,
  CardSuit,
  type CardSuit as CardSuitType,
  GameType,
  type GameType as GameTypeType,
  Street,
  type Street as StreetType,
} from "@mix-online/shared";

export type StreetViewPlayer = {
  seatNo: number;
  upCards: Array<{
    rank: CardRankType;
    suit: CardSuitType;
  }>;
  hasPairOnBoard?: boolean;
};

export interface GameRule {
  readonly gameType: GameTypeType;
  determineBringIn(players: StreetViewPlayer[]): number;
  determineFirstToAct(
    street: StreetType,
    players: StreetViewPlayer[],
  ): number | null;
}

const STUD_RANK_HIGH_VALUES: Record<CardRankType, number> = {
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

const RAZZ_RANK_LOW_VALUES: Record<CardRankType, number> = {
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

const STUD_WEAK_SUIT_SCORES: Record<CardSuitType, number> = {
  [CardSuit.C]: 4,
  [CardSuit.D]: 3,
  [CardSuit.H]: 2,
  [CardSuit.S]: 1,
};

const RAZZ_WEAK_SUIT_SCORES: Record<CardSuitType, number> = {
  [CardSuit.S]: 4,
  [CardSuit.H]: 3,
  [CardSuit.D]: 2,
  [CardSuit.C]: 1,
};

const studRankHighValue = (rank: CardRankType): number =>
  STUD_RANK_HIGH_VALUES[rank];

const razzRankLowValue = (rank: CardRankType): number =>
  RAZZ_RANK_LOW_VALUES[rank];

const studWeakSuitScore = (suit: CardSuitType): number =>
  STUD_WEAK_SUIT_SCORES[suit];

const razzWeakSuitScore = (suit: CardSuitType): number =>
  RAZZ_WEAK_SUIT_SCORES[suit];

const getUpCard = (player: StreetViewPlayer) => player.upCards.at(-1);

const compareStudShowing = (
  left: StreetViewPlayer,
  right: StreetViewPlayer,
): number => {
  const leftCountByRank = new Map<number, number>();
  const rightCountByRank = new Map<number, number>();

  for (const card of left.upCards) {
    const rank = studRankHighValue(card.rank);
    leftCountByRank.set(rank, (leftCountByRank.get(rank) ?? 0) + 1);
  }
  for (const card of right.upCards) {
    const rank = studRankHighValue(card.rank);
    rightCountByRank.set(rank, (rightCountByRank.get(rank) ?? 0) + 1);
  }

  const leftGroups = [...leftCountByRank.entries()].sort((a, b) => {
    if (a[1] !== b[1]) {
      return b[1] - a[1];
    }
    return b[0] - a[0];
  });
  const rightGroups = [...rightCountByRank.entries()].sort((a, b) => {
    if (a[1] !== b[1]) {
      return b[1] - a[1];
    }
    return b[0] - a[0];
  });

  const groupLength = Math.max(leftGroups.length, rightGroups.length);
  for (let index = 0; index < groupLength; index += 1) {
    const leftGroup = leftGroups[index];
    const rightGroup = rightGroups[index];

    const leftCount = leftGroup?.[1] ?? 0;
    const rightCount = rightGroup?.[1] ?? 0;
    if (leftCount !== rightCount) {
      return rightCount - leftCount;
    }

    const leftRank = leftGroup?.[0] ?? 0;
    const rightRank = rightGroup?.[0] ?? 0;
    if (leftRank !== rightRank) {
      return rightRank - leftRank;
    }
  }

  const leftCards = [...left.upCards].sort((a, b) => {
    const byRank = studRankHighValue(b.rank) - studRankHighValue(a.rank);
    if (byRank !== 0) {
      return byRank;
    }
    return studWeakSuitScore(a.suit) - studWeakSuitScore(b.suit);
  });
  const rightCards = [...right.upCards].sort((a, b) => {
    const byRank = studRankHighValue(b.rank) - studRankHighValue(a.rank);
    if (byRank !== 0) {
      return byRank;
    }
    return studWeakSuitScore(a.suit) - studWeakSuitScore(b.suit);
  });

  const cardLength = Math.max(leftCards.length, rightCards.length);
  for (let index = 0; index < cardLength; index += 1) {
    const leftCard = leftCards[index];
    const rightCard = rightCards[index];

    const leftRank = leftCard ? studRankHighValue(leftCard.rank) : 0;
    const rightRank = rightCard ? studRankHighValue(rightCard.rank) : 0;
    if (leftRank !== rightRank) {
      return rightRank - leftRank;
    }

    const leftSuit = leftCard ? studWeakSuitScore(leftCard.suit) : 99;
    const rightSuit = rightCard ? studWeakSuitScore(rightCard.suit) : 99;
    if (leftSuit !== rightSuit) {
      return leftSuit - rightSuit;
    }
  }

  return left.seatNo - right.seatNo;
};

const compareRazzShowing = (
  left: StreetViewPlayer,
  right: StreetViewPlayer,
): number => {
  const leftCards = [...left.upCards].sort((a, b) => {
    const byRank = razzRankLowValue(b.rank) - razzRankLowValue(a.rank);
    if (byRank !== 0) {
      return byRank;
    }
    return razzWeakSuitScore(a.suit) - razzWeakSuitScore(b.suit);
  });
  const rightCards = [...right.upCards].sort((a, b) => {
    const byRank = razzRankLowValue(b.rank) - razzRankLowValue(a.rank);
    if (byRank !== 0) {
      return byRank;
    }
    return razzWeakSuitScore(a.suit) - razzWeakSuitScore(b.suit);
  });

  const cardLength = Math.max(leftCards.length, rightCards.length);
  for (let index = 0; index < cardLength; index += 1) {
    const leftCard = leftCards[index];
    const rightCard = rightCards[index];

    const leftRank = leftCard ? razzRankLowValue(leftCard.rank) : 99;
    const rightRank = rightCard ? razzRankLowValue(rightCard.rank) : 99;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    const leftSuit = leftCard ? razzWeakSuitScore(leftCard.suit) : 99;
    const rightSuit = rightCard ? razzWeakSuitScore(rightCard.suit) : 99;
    if (leftSuit !== rightSuit) {
      return leftSuit - rightSuit;
    }
  }

  return left.seatNo - right.seatNo;
};

const selectStudBringIn = (players: StreetViewPlayer[]): number => {
  const ordered = [...players].sort((left, right) => {
    const leftPair = left.hasPairOnBoard ?? false;
    const rightPair = right.hasPairOnBoard ?? false;
    if (leftPair !== rightPair) {
      return leftPair ? 1 : -1;
    }

    const leftCard = getUpCard(left);
    const rightCard = getUpCard(right);
    if (!leftCard || !rightCard) {
      return left.seatNo - right.seatNo;
    }

    const byRank =
      studRankHighValue(leftCard.rank) - studRankHighValue(rightCard.rank);
    if (byRank !== 0) {
      return byRank;
    }

    return studWeakSuitScore(rightCard.suit) - studWeakSuitScore(leftCard.suit);
  });

  return ordered[0]?.seatNo ?? players[0]?.seatNo ?? 1;
};

const selectRazzBringIn = (players: StreetViewPlayer[]): number => {
  const ordered = [...players].sort((left, right) => {
    const leftPair = left.hasPairOnBoard ?? false;
    const rightPair = right.hasPairOnBoard ?? false;
    if (leftPair !== rightPair) {
      return leftPair ? -1 : 1;
    }

    const leftCard = getUpCard(left);
    const rightCard = getUpCard(right);
    if (!leftCard || !rightCard) {
      return left.seatNo - right.seatNo;
    }

    const byRank =
      razzRankLowValue(rightCard.rank) - razzRankLowValue(leftCard.rank);
    if (byRank !== 0) {
      return byRank;
    }

    return razzWeakSuitScore(rightCard.suit) - razzWeakSuitScore(leftCard.suit);
  });

  return ordered[0]?.seatNo ?? players[0]?.seatNo ?? 1;
};

const createStudRule = (
  gameType: typeof GameType.STUD_HI | typeof GameType.STUD_8,
): GameRule => ({
  gameType,
  determineBringIn(players) {
    return selectStudBringIn(players);
  },
  determineFirstToAct(street, players) {
    if (players.length === 0) {
      return null;
    }
    if (street === Street.THIRD) {
      return this.determineBringIn(players);
    }

    const ordered = [...players].sort(compareStudShowing);

    return ordered[0]?.seatNo ?? null;
  },
});

const createRazzRule = (): GameRule => ({
  gameType: GameType.RAZZ,
  determineBringIn(players) {
    return selectRazzBringIn(players);
  },
  determineFirstToAct(street, players) {
    if (players.length === 0) {
      return null;
    }
    if (street === Street.THIRD) {
      return this.determineBringIn(players);
    }

    const ordered = [...players].sort(compareRazzShowing);

    return ordered[0]?.seatNo ?? null;
  },
});

export const resolveGameRule = (gameType: GameTypeType): GameRule => {
  if (gameType === GameType.RAZZ) {
    return createRazzRule();
  }
  if (gameType === GameType.STUD_8) {
    return createStudRule(GameType.STUD_8);
  }
  return createStudRule(GameType.STUD_HI);
};
