import { GameType, SeatStatus, TableStatus } from "@mix-online/shared";
import type { TableActorRegistrySeed } from "./table-actor";
import type { TableEventMessage, TableState } from "./table-service-types";

export const createDefaultTableState = (tableId: string): TableState => ({
  tableId,
  status: TableStatus.WAITING,
  gameType: GameType.STUD_HI,
  mixIndex: 0,
  handsSinceRotation: 0,
  dealerSeatNo: 1,
  smallBet: 20,
  bigBet: 40,
  ante: 5,
  bringIn: 10,
  currentHand: null,
  nextHandNo: 1,
  seats: Array.from({ length: 6 }, (_, index) => ({
    seatNo: index + 1,
    status: SeatStatus.EMPTY,
    statusBeforeDisconnect: null,
    userId: null,
    displayName: null,
    stack: 0,
    disconnectStreak: 0,
    joinedAt: null,
  })),
});

export const cloneValue = <T>(value: T): T => structuredClone(value);

export const createActorRegistrySeedFromHistory = (
  historyByTableId: Record<string, TableEventMessage[]>,
): TableActorRegistrySeed => {
  const seed: TableActorRegistrySeed = {};

  for (const [tableId, events] of Object.entries(historyByTableId)) {
    const latestTableSeq = events[events.length - 1]?.tableSeq ?? 0;
    const handSeqByHandId: Record<string, number> = {};

    for (const event of events) {
      if (!event.handId || event.handSeq === null) {
        continue;
      }
      handSeqByHandId[event.handId] = Math.max(
        handSeqByHandId[event.handId] ?? 0,
        event.handSeq,
      );
    }

    seed[tableId] = {
      nextTableSeq: latestTableSeq + 1,
      handSeqByHandId,
    };
  }

  return seed;
};
