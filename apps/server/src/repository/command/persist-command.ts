import type {
  CommandPersistenceBatch,
  CommandRepository,
  TableEventPublisher,
} from "./contract";

export type PersistCommandInput = {
  repository: CommandRepository;
  publisher: TableEventPublisher;
  batch: CommandPersistenceBatch;
};

// 1コマンド=1トランザクションで永続化し、コミット成功後のみ配信する。
export const persistCommandAndPublish = async ({
  repository,
  publisher,
  batch,
}: PersistCommandInput): Promise<void> => {
  await repository.withTransaction(async (tx) => {
    await tx.appendHandEvent(batch.handEvent);

    if (batch.table) {
      await tx.updateTable(batch.table);
    }

    if (batch.seats && batch.seats.length > 0) {
      await tx.updateTableSeats(batch.seats);
    }

    if (batch.hand) {
      await tx.updateHand(batch.hand);
    }

    if (batch.handPlayers && batch.handPlayers.length > 0) {
      await tx.upsertHandPlayers(batch.handPlayers);
    }

    if (batch.walletTransactions && batch.walletTransactions.length > 0) {
      await tx.appendWalletTransactions(batch.walletTransactions);
    }
  });

  await publisher.publish(batch.handEvent);
};
