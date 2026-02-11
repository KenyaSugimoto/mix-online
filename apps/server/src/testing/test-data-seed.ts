import { GameType, SeatStatus } from "@mix-online/shared";

export type TestUserSeed = {
  userId: string;
  displayName: string;
  walletBalance: number;
};

export type TestTableSeed = {
  tableId: string;
  tableName: string;
  smallBet: number;
  bigBet: number;
  ante: number;
  bringIn: number;
  minPlayers: number;
  maxPlayers: number;
  dealerSeatNo: number;
  gameType: typeof GameType.STUD_HI;
};

export type TestSeatStatus =
  | typeof SeatStatus.EMPTY
  | typeof SeatStatus.ACTIVE
  | typeof SeatStatus.SEATED_WAIT_NEXT_HAND;

export type TestSeatSeed = {
  seatNo: number;
  status: TestSeatStatus;
  userId: string | null;
  stack: number;
};

export type TestDataSeed = {
  users: TestUserSeed[];
  table: TestTableSeed;
  seats: TestSeatSeed[];
};

const toDeterministicUuid = (index: number): string =>
  `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;

export const createTestUsers = (params?: {
  count?: number;
  walletBalance?: number;
}): TestUserSeed[] => {
  const count = params?.count ?? 6;
  const walletBalance = params?.walletBalance ?? 4000;

  return Array.from({ length: count }, (_, i) => {
    const userNo = i + 1;
    return {
      userId: toDeterministicUuid(userNo),
      displayName: `U${userNo}`,
      walletBalance,
    };
  });
};

export const createTestTable = (): TestTableSeed => ({
  tableId: toDeterministicUuid(100),
  tableName: "Test Table 1",
  smallBet: 20,
  bigBet: 40,
  ante: 5,
  bringIn: 10,
  minPlayers: 2,
  maxPlayers: 6,
  dealerSeatNo: 1,
  gameType: GameType.STUD_HI,
});

export const createInitialSeats = (): TestSeatSeed[] =>
  Array.from({ length: 6 }, (_, i) => ({
    seatNo: i + 1,
    status: SeatStatus.EMPTY,
    userId: null,
    stack: 0,
  }));

export const assignActiveSeats = (
  seats: TestSeatSeed[],
  users: TestUserSeed[],
  buyIn: number,
): TestSeatSeed[] => {
  return seats.map((seat, i) => {
    const user = users[i];
    if (!user) {
      return seat;
    }

    return {
      ...seat,
      status: SeatStatus.ACTIVE,
      userId: user.userId,
      stack: buyIn,
    };
  });
};

export const createTestDataSeed = (params?: {
  userCount?: number;
  walletBalance?: number;
  buyIn?: number;
}): TestDataSeed => {
  const users = createTestUsers({
    count: params?.userCount ?? 6,
    walletBalance: params?.walletBalance ?? 4000,
  });
  const table = createTestTable();
  const seats = assignActiveSeats(
    createInitialSeats(),
    users.slice(0, 2),
    params?.buyIn ?? 1000,
  );

  return { users, table, seats };
};
