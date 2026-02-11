import {
  type CardRank,
  type CardSuit,
  GameType,
  type GameType as GameTypeType,
  Street,
  type Street as StreetType,
} from "@mix-online/shared";

export type StreetViewPlayer = {
  seatNo: number;
  upCards: Array<{
    rank: CardRank;
    suit: CardSuit;
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

const studRankHighValue = (rank: CardRank): number => {
  if (rank === "A") return 14;
  if (rank === "K") return 13;
  if (rank === "Q") return 12;
  if (rank === "J") return 11;
  if (rank === "T") return 10;
  return Number.parseInt(rank, 10);
};

const razzRankLowValue = (rank: CardRank): number => {
  if (rank === "A") return 1;
  if (rank === "K") return 13;
  if (rank === "Q") return 12;
  if (rank === "J") return 11;
  if (rank === "T") return 10;
  return Number.parseInt(rank, 10);
};

const studWeakSuitScore = (suit: CardSuit): number => {
  if (suit === "C") return 4;
  if (suit === "D") return 3;
  if (suit === "H") return 2;
  return 1;
};

const razzWeakSuitScore = (suit: CardSuit): number => {
  if (suit === "S") return 4;
  if (suit === "H") return 3;
  if (suit === "D") return 2;
  return 1;
};

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
