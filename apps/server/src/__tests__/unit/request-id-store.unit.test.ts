import { describe, expect, it } from "vitest";
import { RequestIdStore } from "../../request-id-store";

describe("requestId 重複送信ストア", () => {
  it("同一スコープ・同一requestIdを重複として判定する", () => {
    const store = new RequestIdStore(10_000);
    const scope = {
      userId: "11111111-1111-4111-8111-111111111111",
      tableId: "22222222-2222-4222-8222-222222222222",
    };

    expect(store.isDuplicate(scope, "req-1", 0)).toBe(false);
    expect(store.isDuplicate(scope, "req-1", 1)).toBe(true);
  });

  it("TTL経過後は同じrequestIdを再利用できる", () => {
    const store = new RequestIdStore(100);
    const scope = {
      userId: "11111111-1111-4111-8111-111111111111",
      tableId: null,
    };

    expect(store.isDuplicate(scope, "req-1", 0)).toBe(false);
    expect(store.isDuplicate(scope, "req-1", 50)).toBe(true);
    expect(store.isDuplicate(scope, "req-1", 101)).toBe(false);
  });
});
