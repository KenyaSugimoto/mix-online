import type { RealtimeTableEventMessage } from "@mix-online/shared";
import type { SessionUser } from "../auth-session";
import {
  TABLE_SNAPSHOT_MESSAGE_TYPE,
  type TableSnapshotMessage,
} from "./table-service-protocol";
import { createDefaultTableState } from "./table-service-state";
import type { PendingEvent, TableState } from "./table-service-types";

export const resolveTableIdFromPayload = (
  payload: Record<string, unknown>,
): string | null => {
  const raw = payload.tableId;
  if (typeof raw !== "string" || raw.length === 0) {
    return null;
  }
  return raw;
};

export const getOrCreateTable = (
  tables: Map<string, TableState>,
  tableId: string,
): TableState => {
  const existing = tables.get(tableId);
  if (existing) {
    return existing;
  }

  const created = createDefaultTableState(tableId);
  tables.set(tableId, created);
  return created;
};

export const resolveWalletBalance = (
  walletByUserId: Map<string, number>,
  user: SessionUser,
): number => {
  return walletByUserId.get(user.userId) ?? user.walletBalance;
};

export const mapEvents = (params: {
  tableId: string;
  events: PendingEvent[];
  occurredAt: Date;
  allocateTableSeq: () => number;
  allocateHandSeq: (handId: string) => number;
  eventHistoryByTableId: Map<string, RealtimeTableEventMessage[]>;
  retainedEventLimit: number;
}): RealtimeTableEventMessage[] => {
  const mapped = params.events.map(
    (event) =>
      ({
        type: "table.event",
        tableId: params.tableId,
        tableSeq: params.allocateTableSeq(),
        handId: event.handId,
        handSeq: event.handId ? params.allocateHandSeq(event.handId) : null,
        occurredAt: params.occurredAt.toISOString(),
        eventName: event.eventName,
        payload: event.payload,
      }) as RealtimeTableEventMessage,
  );

  appendEventHistory({
    tableId: params.tableId,
    events: mapped,
    eventHistoryByTableId: params.eventHistoryByTableId,
    retainedEventLimit: params.retainedEventLimit,
  });
  return mapped;
};

const appendEventHistory = (params: {
  tableId: string;
  events: RealtimeTableEventMessage[];
  eventHistoryByTableId: Map<string, RealtimeTableEventMessage[]>;
  retainedEventLimit: number;
}): void => {
  if (params.events.length === 0) {
    return;
  }

  const history = params.eventHistoryByTableId.get(params.tableId) ?? [];
  history.push(...params.events);
  if (history.length > params.retainedEventLimit) {
    const removeCount = history.length - params.retainedEventLimit;
    history.splice(0, removeCount);
  }
  params.eventHistoryByTableId.set(params.tableId, history);
};

export const createSnapshotMessage = (params: {
  tables: Map<string, TableState>;
  tableId: string;
  tableSeq: number;
  occurredAt: Date;
  reason: TableSnapshotMessage["payload"]["reason"];
}): TableSnapshotMessage => {
  const table =
    params.tables.get(params.tableId) ??
    createDefaultTableState(params.tableId);
  return {
    type: TABLE_SNAPSHOT_MESSAGE_TYPE,
    tableId: params.tableId,
    tableSeq: params.tableSeq,
    occurredAt: params.occurredAt.toISOString(),
    payload: {
      reason: params.reason,
      table: {
        status: table.status,
        gameType: table.gameType,
        stakes: {
          smallBet: table.smallBet,
          bigBet: table.bigBet,
          ante: table.ante,
          bringIn: table.bringIn,
        },
        seats: table.seats.map((seat) => ({
          seatNo: seat.seatNo,
          status: seat.status,
          stack: seat.stack,
          disconnectStreak: seat.disconnectStreak,
          user:
            seat.userId && seat.displayName
              ? {
                  userId: seat.userId,
                  displayName: seat.displayName,
                }
              : null,
        })),
        currentHand: table.currentHand
          ? {
              handId: table.currentHand.handId,
              handNo: table.currentHand.handNo,
              status: table.currentHand.status,
              street: table.currentHand.street,
              potTotal: table.currentHand.potTotal,
              toActSeatNo: table.currentHand.toActSeatNo,
              actionDeadlineAt: null,
            }
          : null,
        dealerSeatNo: table.dealerSeatNo,
        mixIndex: table.mixIndex,
        handsSinceRotation: table.handsSinceRotation,
      },
    },
  };
};
