import type { PotLayer, PotWinner, ShowdownPlayerInput } from "./types";

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
