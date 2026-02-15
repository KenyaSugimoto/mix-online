import { GameType, PotSide } from "@mix-online/shared";
import { buildSidePots, splitAmountAcrossWinners } from "./pot";
import {
  compareHighScores,
  compareLowScores,
  evaluateBestHigh,
  evaluateBestLowAto5,
  labelForHighScoreJa,
  labelForLowScore,
  qualifiesStud8Low,
} from "./scoring";
import type {
  EvaluatedPlayer,
  LowScore,
  PotResult,
  ShowdownGameType,
  ShowdownOutcome,
  ShowdownPlayerInput,
} from "./types";

const evaluatePlayers = (
  gameType: ShowdownGameType,
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
  gameType: ShowdownGameType;
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

        const highLabel = `H: ${labelForHighScoreJa(highWinners[0]?.highScore ?? [0])}`;
        const lowLabel = `L: ${labelForLowScore(lowWinners[0]?.lowScore ?? null)}`;

        potResults.push({
          potNo: pot.potNo,
          side: PotSide.HI,
          amount: hiAmount,
          winners: splitAmountAcrossWinners({
            amount: hiAmount,
            winners: highWinners,
            dealerSeatNo: params.dealerSeatNo,
          }).map((winner) => ({
            ...winner,
            handLabel: highLabel,
          })),
        });
        potResults.push({
          potNo: pot.potNo,
          side: PotSide.LO,
          amount: loAmount,
          winners: splitAmountAcrossWinners({
            amount: loAmount,
            winners: lowWinners,
            dealerSeatNo: params.dealerSeatNo,
          }).map((winner) => ({
            ...winner,
            handLabel: lowLabel,
          })),
        });
        continue;
      }
    }

    const topHighWinner = highWinners[0];
    const scoopLabel = (() => {
      if (!topHighWinner) return null;
      if (params.gameType === GameType.RAZZ) {
        return `L: ${labelForLowScore(topHighWinner.lowScore ?? null)}`;
      }
      return `H: ${labelForHighScoreJa(topHighWinner.highScore)}`;
    })();
    potResults.push({
      potNo: pot.potNo,
      side: PotSide.SCOOP,
      amount: pot.amount,
      winners: splitAmountAcrossWinners({
        amount: pot.amount,
        winners: highWinners,
        dealerSeatNo: params.dealerSeatNo,
      }).map((winner) => ({
        ...winner,
        handLabel: scoopLabel,
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
