import {
  BettingStructure,
  type GameType,
  type HandStatus,
  type SeatStatus,
  type Street,
  type TableStatus,
} from "@mix-online/shared";

export type TableSeatRecord = {
  seatNo: number;
  status: SeatStatus;
  userId: string | null;
  displayName: string | null;
  stack: number;
  isYou: boolean;
  joinedAt: string | null;
  disconnectStreak: number | null;
};

export type CurrentHandSummaryRecord = {
  handId: string;
  handNo: number;
  status: HandStatus;
  street: Street;
  potTotal: number;
  toActSeatNo: number | null;
  actionDeadlineAt: string | null;
};

export type TableDetailRecord = {
  tableId: string;
  tableName: string;
  status: TableStatus;
  gameType: GameType;
  mixIndex: number;
  handsSinceRotation: number;
  dealerSeatNo: number;
  smallBet: number;
  bigBet: number;
  ante: number;
  bringIn: number;
  minPlayers: number;
  maxPlayers: number;
  seats: TableSeatRecord[];
  currentHand: CurrentHandSummaryRecord | null;
};

type TableStakesView = {
  smallBet: number;
  bigBet: number;
  ante: number;
  bringIn: number;
  bettingStructure: (typeof BettingStructure)[keyof typeof BettingStructure];
  display: string;
};

type TableSeatView = {
  seatNo: number;
  status: SeatStatus;
  userId: string | null;
  displayName: string | null;
  stack: number;
  isYou: boolean;
  joinedAt: string | null;
  disconnectStreak: number | null;
};

type CurrentHandSummaryView = {
  handId: string;
  handNo: number;
  status: HandStatus;
  street: Street;
  potTotal: number;
  toActSeatNo: number | null;
  actionDeadlineAt: string | null;
};

type TableDetailView = {
  tableId: string;
  tableName: string;
  status: TableStatus;
  gameType: GameType;
  mixIndex: number;
  handsSinceRotation: number;
  dealerSeatNo: number;
  stakes: TableStakesView;
  minPlayers: number;
  maxPlayers: number;
  seats: TableSeatView[];
  currentHand: CurrentHandSummaryView | null;
};

export type TableDetailResponse = {
  table: TableDetailView;
};

const toTableStakes = (record: TableDetailRecord): TableStakesView => ({
  smallBet: record.smallBet,
  bigBet: record.bigBet,
  ante: record.ante,
  bringIn: record.bringIn,
  bettingStructure: BettingStructure.FIXED_LIMIT,
  display: `$${record.smallBet}/$${record.bigBet} Fixed Limit`,
});

const toSeatView = (record: TableSeatRecord): TableSeatView => ({
  seatNo: record.seatNo,
  status: record.status,
  userId: record.userId,
  displayName: record.displayName,
  stack: record.stack,
  isYou: record.isYou,
  joinedAt: record.joinedAt,
  disconnectStreak: record.disconnectStreak,
});

const toCurrentHandView = (
  record: CurrentHandSummaryRecord | null,
): CurrentHandSummaryView | null => {
  if (record === null) {
    return null;
  }

  return {
    handId: record.handId,
    handNo: record.handNo,
    status: record.status,
    street: record.street,
    potTotal: record.potTotal,
    toActSeatNo: record.toActSeatNo,
    actionDeadlineAt: record.actionDeadlineAt,
  };
};

export const toTableDetailResponse = (
  record: TableDetailRecord,
): TableDetailResponse => {
  return {
    table: {
      tableId: record.tableId,
      tableName: record.tableName,
      status: record.status,
      gameType: record.gameType,
      mixIndex: record.mixIndex,
      handsSinceRotation: record.handsSinceRotation,
      dealerSeatNo: record.dealerSeatNo,
      stakes: toTableStakes(record),
      minPlayers: record.minPlayers,
      maxPlayers: record.maxPlayers,
      seats: record.seats.map((seat) => toSeatView(seat)),
      currentHand: toCurrentHandView(record.currentHand),
    },
  };
};
