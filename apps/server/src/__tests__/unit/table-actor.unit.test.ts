import { describe, expect, it } from "vitest";
import { createTableActorRegistry } from "../../realtime/table-actor";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

describe("Table Actor 基盤", () => {
  it("同一卓の処理を直列化し tableSeq を単調増加で採番する", async () => {
    const registry = createTableActorRegistry();
    const actor = registry.getOrCreate("table-1");
    const started: number[] = [];
    const finished: number[] = [];

    const task1 = actor.enqueue(async ({ allocateTableSeq }) => {
      started.push(1);
      await sleep(20);
      const tableSeq = allocateTableSeq();
      finished.push(1);
      return tableSeq;
    });

    const task2 = actor.enqueue(async ({ allocateTableSeq }) => {
      started.push(2);
      const tableSeq = allocateTableSeq();
      finished.push(2);
      return tableSeq;
    });

    const task3 = actor.enqueue(async ({ allocateTableSeq }) => {
      started.push(3);
      const tableSeq = allocateTableSeq();
      finished.push(3);
      return tableSeq;
    });

    const seqs = await Promise.all([task1, task2, task3]);

    expect(seqs).toEqual([1, 2, 3]);
    expect(started).toEqual([1, 2, 3]);
    expect(finished).toEqual([1, 2, 3]);
    expect(actor.getCurrentTableSeq()).toBe(3);
  });

  it("handSeq を handId 単位で連番管理する", async () => {
    const registry = createTableActorRegistry();
    const actor = registry.getOrCreate("table-2");

    const handSeqs = await Promise.all([
      actor.enqueue(({ allocateHandSeq }) => allocateHandSeq("hand-a")),
      actor.enqueue(({ allocateHandSeq }) => allocateHandSeq("hand-a")),
      actor.enqueue(({ allocateHandSeq }) => allocateHandSeq("hand-b")),
      actor.enqueue(({ allocateHandSeq }) => allocateHandSeq("hand-a")),
      actor.enqueue(({ allocateHandSeq }) => allocateHandSeq("hand-b")),
    ]);

    expect(handSeqs).toEqual([1, 2, 1, 3, 2]);
    expect(actor.getCurrentHandSeq("hand-a")).toBe(3);
    expect(actor.getCurrentHandSeq("hand-b")).toBe(2);
  });

  it("異なる卓は別Actorとして管理される", async () => {
    const registry = createTableActorRegistry();
    const table1 = registry.getOrCreate("table-1");
    const table2 = registry.getOrCreate("table-2");

    const [seq1, seq2] = await Promise.all([
      table1.enqueue(({ allocateTableSeq }) => allocateTableSeq()),
      table2.enqueue(({ allocateTableSeq }) => allocateTableSeq()),
    ]);

    expect(seq1).toBe(1);
    expect(seq2).toBe(1);
  });
});
