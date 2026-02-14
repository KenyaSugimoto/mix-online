import {
  HandPlayerState,
  HandStatus,
  SeatStatus,
  TableEventName,
  TableStatus,
  WalletTransactionType,
} from "@mix-online/shared";
import { describe, expect, it } from "vitest";
import type {
  CommandRepository,
  CommandTransactionRepository,
  HandEventInsert,
  TableEventPublisher,
} from "../../repository/command";
import { persistCommandAndPublish } from "../../repository/command";

class RecordingRepository implements CommandRepository {
  public readonly operations: string[] = [];
  public shouldFailOnAppend = false;

  async withTransaction<T>(
    operation: (tx: CommandTransactionRepository) => Promise<T>,
  ): Promise<T> {
    this.operations.push("tx.begin");

    const tx: CommandTransactionRepository = {
      appendHandEvent: async () => {
        this.operations.push("tx.appendHandEvent");
        if (this.shouldFailOnAppend) {
          throw new Error("append failed");
        }
      },
      updateTable: async () => {
        this.operations.push("tx.updateTable");
      },
      updateTableSeats: async () => {
        this.operations.push("tx.updateTableSeats");
      },
      updateHand: async () => {
        this.operations.push("tx.updateHand");
      },
      upsertHandPlayers: async () => {
        this.operations.push("tx.upsertHandPlayers");
      },
      appendWalletTransactions: async () => {
        this.operations.push("tx.appendWalletTransactions");
      },
    };

    try {
      const result = await operation(tx);
      this.operations.push("tx.commit");
      return result;
    } catch (error) {
      this.operations.push("tx.rollback");
      throw error;
    }
  }
}

class RecordingPublisher implements TableEventPublisher {
  public publishCount = 0;
  public readonly operations: string[] = [];

  async publish(): Promise<void> {
    this.publishCount += 1;
    this.operations.push("publish");
  }
}

const createHandEvent = (): HandEventInsert => ({
  handId: "00000000-0000-4000-8000-000000000301",
  tableId: "00000000-0000-4000-8000-000000000302",
  tableSeq: 10,
  handSeq: 4,
  eventName: TableEventName.RaiseEvent,
  payload: {
    actorUserId: "00000000-0000-4000-8000-000000000001",
    amount: 40,
  },
});

describe("persistCommandAndPublish", () => {
  it("コミット成功後にのみイベントを配信する", async () => {
    const repository = new RecordingRepository();
    const publisher = new RecordingPublisher();
    const handEvent = createHandEvent();

    await persistCommandAndPublish({
      repository,
      publisher,
      batch: {
        handEvent,
        table: {
          tableId: handEvent.tableId,
          status: TableStatus.BETTING,
        },
        seats: [
          {
            tableId: handEvent.tableId,
            seatNo: 1,
            status: SeatStatus.ACTIVE,
            stack: 960,
          },
        ],
        hand: {
          handId: handEvent.handId,
          tableId: handEvent.tableId,
          status: HandStatus.IN_PROGRESS,
        },
        handPlayers: [
          {
            handId: handEvent.handId,
            userId: "00000000-0000-4000-8000-000000000001",
            state: HandPlayerState.IN_HAND,
          },
        ],
        walletTransactions: [
          {
            userId: "00000000-0000-4000-8000-000000000001",
            type: WalletTransactionType.HAND_RESULT,
            amount: 80,
            balanceAfter: 4080,
            handId: handEvent.handId,
          },
        ],
      },
    });

    expect(repository.operations).toEqual([
      "tx.begin",
      "tx.appendHandEvent",
      "tx.updateTable",
      "tx.updateTableSeats",
      "tx.updateHand",
      "tx.upsertHandPlayers",
      "tx.appendWalletTransactions",
      "tx.commit",
    ]);
    expect(publisher.operations).toEqual(["publish"]);
  });

  it("トランザクション失敗時はロールバックし配信しない", async () => {
    const repository = new RecordingRepository();
    repository.shouldFailOnAppend = true;
    const publisher = new RecordingPublisher();

    await expect(
      persistCommandAndPublish({
        repository,
        publisher,
        batch: {
          handEvent: createHandEvent(),
        },
      }),
    ).rejects.toThrow("append failed");

    expect(repository.operations).toEqual([
      "tx.begin",
      "tx.appendHandEvent",
      "tx.rollback",
    ]);
    expect(publisher.publishCount).toBe(0);
  });
});
