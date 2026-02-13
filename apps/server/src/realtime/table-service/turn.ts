import { SeatStatus, TableStatus } from "@mix-online/shared";
import type { HandState, TableState } from "./types";

export const canStartHand = (table: TableState): boolean => {
  if (table.currentHand !== null || table.status !== TableStatus.WAITING) {
    return false;
  }

  const eligibleSeats = table.seats.filter(
    (seat) => seat.status === SeatStatus.ACTIVE && seat.stack >= table.ante,
  );
  return eligibleSeats.length >= 2;
};

export const resolveNextToAct = (
  hand: HandState,
  fromSeatNo: number,
): number | null => {
  const sorted = [...hand.players].sort(
    (left, right) => left.seatNo - right.seatNo,
  );
  const currentIndex = sorted.findIndex(
    (player) => player.seatNo === fromSeatNo,
  );
  if (currentIndex < 0) {
    return sorted[0]?.seatNo ?? null;
  }

  for (let offset = 1; offset <= sorted.length; offset += 1) {
    const candidate = sorted[(currentIndex + offset) % sorted.length];
    if (!candidate) {
      continue;
    }

    if (
      candidate.inHand &&
      !candidate.allIn &&
      (!candidate.actedThisRound ||
        candidate.streetContribution < hand.streetBetTo)
    ) {
      return candidate.seatNo;
    }
  }

  return null;
};
