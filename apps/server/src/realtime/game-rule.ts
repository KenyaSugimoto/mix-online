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

    const ordered = [...players].sort((left, right) => {
      const leftCard = getUpCard(left);
      const rightCard = getUpCard(right);
      if (!leftCard || !rightCard) {
        return left.seatNo - right.seatNo;
      }

      const byRank =
        studRankHighValue(rightCard.rank) - studRankHighValue(leftCard.rank);
      if (byRank !== 0) {
        return byRank;
      }

      return (
        studWeakSuitScore(leftCard.suit) - studWeakSuitScore(rightCard.suit)
      );
    });

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

    const ordered = [...players].sort((left, right) => {
      const leftCard = getUpCard(left);
      const rightCard = getUpCard(right);
      if (!leftCard || !rightCard) {
        return left.seatNo - right.seatNo;
      }

      const byRank =
        razzRankLowValue(leftCard.rank) - razzRankLowValue(rightCard.rank);
      if (byRank !== 0) {
        return byRank;
      }

      return (
        razzWeakSuitScore(leftCard.suit) - razzWeakSuitScore(rightCard.suit)
      );
    });

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
