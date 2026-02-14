import type {
  GameType as GameTypeType,
  HandStatus,
  RealtimeTableEventMessage,
  SeatStatus,
  SnapshotCurrentHandSeatCards,
  SnapshotReason,
  Street,
  TableStatus,
} from "@mix-online/shared";

export const TABLE_SNAPSHOT_MESSAGE_TYPE = "table.snapshot" as const;

export const TABLE_RESUME_RESULT_KIND = {
  EVENTS: "events",
  SNAPSHOT: "snapshot",
} as const;

export type TableSnapshotMessage = {
  type: typeof TABLE_SNAPSHOT_MESSAGE_TYPE;
  tableId: string;
  tableSeq: number;
  occurredAt: string;
  payload: {
    reason:
      | typeof SnapshotReason.OUT_OF_RANGE
      | typeof SnapshotReason.RESYNC_REQUIRED;
    table: {
      status: TableStatus;
      gameType: GameTypeType;
      stakes: {
        smallBet: number;
        bigBet: number;
        ante: number;
        bringIn: number;
      };
      seats: Array<{
        seatNo: number;
        status: SeatStatus;
        stack: number;
        disconnectStreak: number;
        user: {
          userId: string;
          displayName: string;
        } | null;
      }>;
      currentHand: {
        handId: string;
        handNo: number;
        status: HandStatus;
        street: Street;
        potTotal: number;
        streetBetTo: number;
        raiseCount: number;
        toActSeatNo: number | null;
        actionDeadlineAt: string | null;
        cards: SnapshotCurrentHandSeatCards[];
      } | null;
      dealerSeatNo: number;
      mixIndex: number;
      handsSinceRotation: number;
    };
  };
};

export type TableResumeResult =
  | {
      kind: typeof TABLE_RESUME_RESULT_KIND.EVENTS;
      events: RealtimeTableEventMessage[];
    }
  | {
      kind: typeof TABLE_RESUME_RESULT_KIND.SNAPSHOT;
      snapshot: TableSnapshotMessage;
    };
