type TableActorContext = {
  allocateTableSeq: () => number;
  allocateHandSeq: (handId: string) => number;
};

type TableActorOperation<T> = (context: TableActorContext) => Promise<T> | T;

export type TableActorSeed = {
  nextTableSeq?: number;
  handSeqByHandId?: Record<string, number>;
};

export type TableActorRegistrySeed = Record<string, TableActorSeed>;

export class TableActor {
  readonly tableId: string;
  private queue: Promise<void> = Promise.resolve();
  private nextTableSeqValue = 1;
  private readonly handSeqByHandId: Map<string, number>;

  constructor(tableId: string, seed: TableActorSeed = {}) {
    this.tableId = tableId;
    this.nextTableSeqValue = seed.nextTableSeq ?? 1;
    this.handSeqByHandId = new Map(Object.entries(seed.handSeqByHandId ?? {}));
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
  private readonly seed: TableActorRegistrySeed;
  private readonly actors = new Map<string, TableActor>();

  constructor(seed: TableActorRegistrySeed = {}) {
    this.seed = seed;
  }

  getOrCreate(tableId: string): TableActor {
    const existing = this.actors.get(tableId);
    if (existing) {
      return existing;
    }

    const actor = new TableActor(tableId, this.seed[tableId]);
    this.actors.set(tableId, actor);
    return actor;
  }
}

export const createTableActorRegistry = (
  seed: TableActorRegistrySeed = {},
): TableActorRegistry => new TableActorRegistry(seed);
