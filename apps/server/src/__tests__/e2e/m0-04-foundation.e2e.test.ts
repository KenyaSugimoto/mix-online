import { describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { E2E_SCENARIO_IDS } from "../../testing/e2e-scenarios";

describe("E2E基盤テスト", () => {
  it("E2EシナリオID一覧を固定化する", () => {
    expect(E2E_SCENARIO_IDS).toHaveLength(34);
    expect(E2E_SCENARIO_IDS[0]).toBe("HP-01");
    expect(E2E_SCENARIO_IDS.at(-1)).toBe("ED-11");

    const uniqueIds = new Set(E2E_SCENARIO_IDS);
    expect(uniqueIds.size).toBe(E2E_SCENARIO_IDS.length);
  });

  it("HP-01 最小導線としてロビー一覧取得が成功する", async () => {
    const app = createApp();
    const response = await app.request("/api/lobby/tables");
    const body = (await response.json()) as {
      tables: unknown[];
      serverTime: string;
    };

    expect(response.status).toBe(200);
    expect(body.tables).toHaveLength(2);
    expect(body.serverTime).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/,
    );
  });
});
