type TableActorContext = {
  allocateTableSeq: () => number;
  allocateHandSeq: (handId: string) => number;
};

type TableActorOperation<T> = (context: TableActorContext) => Promise<T> | T;

export class TableActor {
  readonly tableId: string;
  private queue: Promise<void> = Promise.resolve();
  private nextTableSeqValue = 1;
  private readonly handSeqByHandId = new Map<string, number>();

  constructor(tableId: string) {
    this.tableId = tableId;
  }

  enqueue<T>(operation: TableActorOperation<T>): Promise<T> {
    const task = this.queue.then(() =>
      operation({
        allocateTableSeq: () => this.allocateTableSeq(),
        allocateHandSeq: (handId) => this.allocateHandSeq(handId),
      }),
    );

    this.queue = task.then(
      () => undefined,
      () => undefined,
    );

    return task;
  }

  getCurrentTableSeq(): number {
    return this.nextTableSeqValue - 1;
  }

  getCurrentHandSeq(handId: string): number {
    return this.handSeqByHandId.get(handId) ?? 0;
  }

  private allocateTableSeq(): number {
    const current = this.nextTableSeqValue;
    this.nextTableSeqValue += 1;
    return current;
  }

  private allocateHandSeq(handId: string): number {
    const next = (this.handSeqByHandId.get(handId) ?? 0) + 1;
    this.handSeqByHandId.set(handId, next);
    return next;
  }
}

export class TableActorRegistry {
  private readonly actors = new Map<string, TableActor>();

  getOrCreate(tableId: string): TableActor {
    const existing = this.actors.get(tableId);
    if (existing) {
      return existing;
    }

    const actor = new TableActor(tableId);
    this.actors.set(tableId, actor);
    return actor;
  }
}

export const createTableActorRegistry = (): TableActorRegistry =>
  new TableActorRegistry();
