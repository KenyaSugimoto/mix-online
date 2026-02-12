import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { HandStatus, TableEventName, TableStatus } from "@mix-online/shared";
import { beforeEach, describe, expect, it } from "vitest";

const dbContainerName =
  process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_mix-online";

const runPsql = (sql: string) => {
  return spawnSync(
    "docker",
    [
      "exec",
      dbContainerName,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { encoding: "utf-8" },
  );
};

const executeSql = (sql: string): string => {
  const result = runPsql(sql);

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      [
        "SQL実行に失敗しました。",
        `sql: ${sql}`,
        `stdout: ${result.stdout}`,
        `stderr: ${result.stderr}`,
      ].join("\n"),
    );
  }

  return result.stdout.trim();
};

const executeSqlExpectFailure = (sql: string): string => {
  const result = runPsql(sql);

  if (result.error) {
    throw result.error;
  }

  if (result.status === 0) {
    throw new Error(`失敗を期待したSQLが成功しました: ${sql}`);
  }

  return `${result.stdout}${result.stderr}`;
};

const isDatabaseReady = (): boolean => {
  const result = runPsql("SELECT 1");
  return result.status === 0 && result.stdout.trim() === "1";
};

const resetDatabase = () => {
  executeSql(`
    TRUNCATE TABLE
      hand_results,
      hand_players,
      hand_events,
      table_snapshots,
      wallet_transactions,
      hands,
      table_seats,
      tables,
      wallets,
      users
    RESTART IDENTITY CASCADE;
  `);
};

const describeDb = isDatabaseReady() ? describe : describe.skip;

describeDb("DBスキーマ統合テスト（M1-04）", () => {
  beforeEach(() => {
    resetDatabase();
  });

  it("users の CRUD と UNIQUE 制約を満たす", () => {
    const userId = randomUUID();
    const googleSub = `sub-${randomUUID()}`;

    executeSql(`
      INSERT INTO users (id, google_sub, display_name)
      VALUES ('${userId}', '${googleSub}', 'User 1');
    `);
    expect(
      executeSql(`SELECT display_name FROM users WHERE id = '${userId}';`),
    ).toBe("User 1");

    executeSql(`
      UPDATE users
      SET display_name = 'User 1 Updated'
      WHERE id = '${userId}';
    `);
    expect(
      executeSql(`SELECT display_name FROM users WHERE id = '${userId}';`),
    ).toBe("User 1 Updated");

    const duplicateError = executeSqlExpectFailure(`
      INSERT INTO users (id, google_sub, display_name)
      VALUES ('${randomUUID()}', '${googleSub}', 'Duplicated');
    `);
    expect(duplicateError).toContain("users_google_sub_key");

    executeSql(`DELETE FROM users WHERE id = '${userId}';`);
    expect(
      executeSql(`SELECT COUNT(*) FROM users WHERE id = '${userId}';`),
    ).toBe("0");
  });

  it("wallets の CRUD と FK/CHECK 制約を満たす", () => {
    const userId = randomUUID();

    executeSql(`
      INSERT INTO users (id, google_sub, display_name)
      VALUES ('${userId}', 'wallet-owner-${randomUUID()}', 'Wallet Owner');
    `);
    executeSql(`
      INSERT INTO wallets (user_id, balance)
      VALUES ('${userId}', 1000);
    `);
    expect(
      executeSql(`SELECT balance FROM wallets WHERE user_id = '${userId}';`),
    ).toBe("1000");

    executeSql(`
      UPDATE wallets
      SET balance = 1200
      WHERE user_id = '${userId}';
    `);
    expect(
      executeSql(`SELECT balance FROM wallets WHERE user_id = '${userId}';`),
    ).toBe("1200");

    const fkError = executeSqlExpectFailure(`
      INSERT INTO wallets (user_id, balance)
      VALUES ('${randomUUID()}', 100);
    `);
    expect(fkError).toContain("wallets_user_id_fkey");

    const checkError = executeSqlExpectFailure(`
      UPDATE wallets
      SET balance = -1
      WHERE user_id = '${userId}';
    `);
    expect(checkError).toContain("wallets_balance_check");

    executeSql(`DELETE FROM users WHERE id = '${userId}';`);
    expect(
      executeSql(`SELECT COUNT(*) FROM wallets WHERE user_id = '${userId}';`),
    ).toBe("0");
  });

  it("tables の CRUD と CHECK 制約を満たす", () => {
    const tableId = randomUUID();

    executeSql(`
      INSERT INTO tables (
        id, name, small_bet, big_bet, ante, bring_in,
        max_players, min_players, mix_index, hands_since_rotation, dealer_seat, status
      ) VALUES (
        '${tableId}', 'Table A', 20, 40, 5, 10,
        6, 2, 0, 0, 1, 'WAITING'
      );
    `);
    expect(
      executeSql(`SELECT status FROM tables WHERE id = '${tableId}';`),
    ).toBe(TableStatus.WAITING);

    executeSql(`
      UPDATE tables
      SET status = 'BETTING'
      WHERE id = '${tableId}';
    `);
    expect(
      executeSql(`SELECT status FROM tables WHERE id = '${tableId}';`),
    ).toBe(TableStatus.BETTING);

    const checkError = executeSqlExpectFailure(`
      INSERT INTO tables (id, name, max_players)
      VALUES ('${randomUUID()}', 'Invalid Table', 7);
    `);
    expect(checkError).toContain("tables_max_players_check");

    executeSql(`DELETE FROM tables WHERE id = '${tableId}';`);
    expect(
      executeSql(`SELECT COUNT(*) FROM tables WHERE id = '${tableId}';`),
    ).toBe("0");
  });

  it("table_seats の CRUD と FK/UNIQUE/CHECK 制約を満たす", () => {
    const tableId = randomUUID();
    const userId = randomUUID();
    const otherUserId = randomUUID();

    executeSql(`
      INSERT INTO tables (id, name)
      VALUES ('${tableId}', 'Seat Table');
    `);
    executeSql(`
      INSERT INTO users (id, google_sub, display_name)
      VALUES ('${userId}', 'seat-user-${randomUUID()}', 'Seat User');
    `);
    executeSql(`
      INSERT INTO users (id, google_sub, display_name)
      VALUES ('${otherUserId}', 'seat-user-${randomUUID()}', 'Other User');
    `);

    executeSql(`
      INSERT INTO table_seats (table_id, seat_no, user_id, status, stack)
      VALUES ('${tableId}', 1, '${userId}', 'SEATED_WAIT_NEXT_HAND', 1000);
    `);
    expect(
      executeSql(
        `SELECT status || ':' || stack FROM table_seats WHERE table_id = '${tableId}' AND seat_no = 1;`,
      ),
    ).toBe("SEATED_WAIT_NEXT_HAND:1000");

    executeSql(`
      UPDATE table_seats
      SET status = 'ACTIVE', stack = 1200
      WHERE table_id = '${tableId}' AND seat_no = 1;
    `);
    expect(
      executeSql(
        `SELECT status || ':' || stack FROM table_seats WHERE table_id = '${tableId}' AND seat_no = 1;`,
      ),
    ).toBe("ACTIVE:1200");

    const uniqueError = executeSqlExpectFailure(`
      INSERT INTO table_seats (table_id, seat_no, user_id, status, stack)
      VALUES ('${tableId}', 2, '${userId}', 'ACTIVE', 900);
    `);
    expect(uniqueError).toContain("uq_table_seats_user");

    const checkError = executeSqlExpectFailure(`
      INSERT INTO table_seats (table_id, seat_no, user_id, status, stack)
      VALUES ('${tableId}', 7, '${otherUserId}', 'ACTIVE', 900);
    `);
    expect(checkError).toContain("table_seats_seat_no_check");

    executeSql(`DELETE FROM tables WHERE id = '${tableId}';`);
    expect(
      executeSql(
        `SELECT COUNT(*) FROM table_seats WHERE table_id = '${tableId}';`,
      ),
    ).toBe("0");
  });

  it("hands の CRUD と FK/CHECK 制約を満たす", () => {
    const tableId = randomUUID();
    const handId = randomUUID();

    executeSql(`
      INSERT INTO tables (id, name)
      VALUES ('${tableId}', 'Hand Table');
    `);
    executeSql(`
      INSERT INTO hands (id, table_id, hand_no, game_type, deck_hash)
      VALUES ('${handId}', '${tableId}', 1, 'STUD_HI', 'deck-hash-1');
    `);
    expect(executeSql(`SELECT status FROM hands WHERE id = '${handId}';`)).toBe(
      HandStatus.IN_PROGRESS,
    );

    executeSql(`
      UPDATE hands
      SET status = 'HAND_END', ended_at = now(), winner_summary = '{}'::jsonb
      WHERE id = '${handId}';
    `);
    expect(executeSql(`SELECT status FROM hands WHERE id = '${handId}';`)).toBe(
      HandStatus.HAND_END,
    );

    const fkError = executeSqlExpectFailure(`
      INSERT INTO hands (id, table_id, hand_no, game_type, deck_hash)
      VALUES ('${randomUUID()}', '${randomUUID()}', 2, 'STUD_HI', 'deck-hash-2');
    `);
    expect(fkError).toContain("hands_table_id_fkey");

    const checkError = executeSqlExpectFailure(`
      INSERT INTO hands (id, table_id, hand_no, game_type, deck_hash)
      VALUES ('${randomUUID()}', '${tableId}', 3, 'UNKNOWN_GAME', 'deck-hash-3');
    `);
    expect(checkError).toContain("hands_game_type_check");

    executeSql(`DELETE FROM tables WHERE id = '${tableId}';`);
    expect(
      executeSql(`SELECT COUNT(*) FROM hands WHERE id = '${handId}';`),
    ).toBe("0");
  });

  it("hand_events の作成/参照と FK/UNIQUE/CHECK 制約を満たす", () => {
    const tableId = randomUUID();
    const anotherTableId = randomUUID();
    const handId = randomUUID();

    executeSql(`
      INSERT INTO tables (id, name)
      VALUES ('${tableId}', 'Event Table');
    `);
    executeSql(`
      INSERT INTO tables (id, name)
      VALUES ('${anotherTableId}', 'Another Event Table');
    `);
    executeSql(`
      INSERT INTO hands (id, table_id, hand_no, game_type, deck_hash)
      VALUES ('${handId}', '${tableId}', 1, 'STUD_HI', 'deck-hash-event');
    `);
    executeSql(`
      INSERT INTO hand_events (hand_id, table_id, table_seq, hand_seq, event_name, payload)
      VALUES ('${handId}', '${tableId}', 1, 1, 'DealInitEvent', '{}'::jsonb);
    `);
    expect(
      executeSql(
        `SELECT event_name FROM hand_events WHERE hand_id = '${handId}' AND hand_seq = 1;`,
      ),
    ).toBe(TableEventName.DealInitEvent);

    const tableSeqUniqueError = executeSqlExpectFailure(`
      INSERT INTO hand_events (hand_id, table_id, table_seq, hand_seq, event_name, payload)
      VALUES ('${handId}', '${tableId}', 1, 2, 'PostAnteEvent', '{}'::jsonb);
    `);
    expect(tableSeqUniqueError).toContain("hand_events_table_id_table_seq_key");

    const handSeqUniqueError = executeSqlExpectFailure(`
      INSERT INTO hand_events (hand_id, table_id, table_seq, hand_seq, event_name, payload)
      VALUES ('${handId}', '${tableId}', 2, 1, 'BringInEvent', '{}'::jsonb);
    `);
    expect(handSeqUniqueError).toContain("hand_events_hand_id_hand_seq_key");

    const compositeFkError = executeSqlExpectFailure(`
      INSERT INTO hand_events (hand_id, table_id, table_seq, hand_seq, event_name, payload)
      VALUES ('${handId}', '${anotherTableId}', 1, 3, 'BetEvent', '{}'::jsonb);
    `);
    expect(compositeFkError).toContain("fk_hand_events_hand_table");

    const checkError = executeSqlExpectFailure(`
      INSERT INTO hand_events (hand_id, table_id, table_seq, hand_seq, event_name, payload)
      VALUES ('${handId}', '${tableId}', 3, 3, 'UnknownEvent', '{}'::jsonb);
    `);
    expect(checkError).toContain("hand_events_event_name_check");

    executeSql(`DELETE FROM hands WHERE id = '${handId}';`);
    expect(
      executeSql(
        `SELECT COUNT(*) FROM hand_events WHERE hand_id = '${handId}';`,
      ),
    ).toBe("0");
  });
});
