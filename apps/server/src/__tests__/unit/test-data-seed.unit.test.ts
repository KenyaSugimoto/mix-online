import { describe, expect, it } from "vitest";
import {
  assignActiveSeats,
  createInitialSeats,
  createTestDataSeed,
  createTestUsers,
} from "../../testing/test-data-seed";

describe("テストデータ初期化", () => {
  it("既定ユーザーを6名生成する", () => {
    const users = createTestUsers();
    expect(users).toHaveLength(6);
    expect(users[0]).toEqual({
      userId: "00000000-0000-4000-8000-000000000001",
      displayName: "U1",
      walletBalance: 4000,
    });
  });

  it("初期座席は全席 EMPTY で生成される", () => {
    const seats = createInitialSeats();
    expect(seats).toHaveLength(6);
    expect(seats.every((seat) => seat.status === "EMPTY")).toBe(true);
    expect(seats.every((seat) => seat.userId === null)).toBe(true);
  });

  it("assignActiveSeats で先頭席を ACTIVE にできる", () => {
    const users = createTestUsers({ count: 2 });
    const seats = assignActiveSeats(createInitialSeats(), users, 1000);

    expect(seats[0]).toMatchObject({
      seatNo: 1,
      status: "ACTIVE",
      userId: users[0]?.userId,
      stack: 1000,
    });
    expect(seats[1]).toMatchObject({
      seatNo: 2,
      status: "ACTIVE",
      userId: users[1]?.userId,
      stack: 1000,
    });
    expect(seats[2]?.status).toBe("EMPTY");
  });

  it("createTestDataSeed で卓・席・ユーザーの初期セットを生成できる", () => {
    const seed = createTestDataSeed();
    expect(seed.users).toHaveLength(6);
    expect(seed.table.tableName).toBe("Test Table 1");
    expect(seed.seats.filter((seat) => seat.status === "ACTIVE")).toHaveLength(
      2,
    );
  });
});
