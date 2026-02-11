import type {
  HandPlayerState,
  HandStatus,
  SeatStatus,
  TableEventName,
  TableStatus,
} from "@mix-online/shared";

export type JsonScalar = string | number | boolean | null;
export type JsonValue = JsonScalar | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export type WalletTransactionType =
  | "INIT_GRANT"
  | "BUY_IN"
  | "CASH_OUT"
  | "HAND_RESULT";

export type HandEventInsert = {
  handId: string;
  tableId: string;
  tableSeq: number;
  handSeq: number;
  eventName: TableEventName;
  payload: JsonObject;
};

export type TableSeatMutation = {
  tableId: string;
  seatNo: number;
  status: SeatStatus;
  userId?: string | null;
  stack?: number;
  disconnectStreak?: number;
  joinedAt?: Date | null;
};

export type HandMutation = {
  handId: string;
  tableId: string;
  status?: HandStatus;
  endedAt?: Date | null;
  winnerSummary?: JsonObject | null;
};

export type HandPlayerMutation = {
  handId: string;
  userId: string;
  seatNo?: number;
  state?: HandPlayerState;
  endStack?: number | null;
  resultDelta?: number | null;
  cardsUp?: JsonValue[];
  cardsDown?: JsonValue[];
};

export type WalletTransactionInsert = {
  userId: string;
  type: WalletTransactionType;
  amount: number;
  balanceAfter: number;
  handId?: string | null;
};

export type TableMutation = {
  tableId: string;
  status?: TableStatus;
  mixIndex?: number;
  handsSinceRotation?: number;
  dealerSeat?: number;
};

export type CommandPersistenceBatch = {
  handEvent: HandEventInsert;
  table?: TableMutation;
  seats?: TableSeatMutation[];
  hand?: HandMutation;
  handPlayers?: HandPlayerMutation[];
  walletTransactions?: WalletTransactionInsert[];
};

export interface CommandTransactionRepository {
  appendHandEvent(event: HandEventInsert): Promise<void>;
  updateTable(table: TableMutation): Promise<void>;
  updateTableSeats(seats: TableSeatMutation[]): Promise<void>;
  updateHand(hand: HandMutation): Promise<void>;
  upsertHandPlayers(players: HandPlayerMutation[]): Promise<void>;
  appendWalletTransactions(
    transactions: WalletTransactionInsert[],
  ): Promise<void>;
}

export interface CommandRepository {
  withTransaction<T>(
    operation: (tx: CommandTransactionRepository) => Promise<T>,
  ): Promise<T>;
}

export interface TableEventPublisher {
  publish(event: HandEventInsert): Promise<void>;
}
