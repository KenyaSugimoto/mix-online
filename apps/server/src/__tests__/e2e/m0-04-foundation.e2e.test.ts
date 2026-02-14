import { describe, expect, it } from "vitest";
import { E2E_SCENARIO_IDS } from "../../testing/e2e-scenarios";

describe("E2E基盤テスト", () => {
  it("E2EシナリオID一覧を固定化する", () => {
    expect(E2E_SCENARIO_IDS).toHaveLength(34);
    expect(E2E_SCENARIO_IDS[0]).toBe("HP-01");
    expect(E2E_SCENARIO_IDS.at(-1)).toBe("ED-11");

    const uniqueIds = new Set(E2E_SCENARIO_IDS);
    expect(uniqueIds.size).toBe(E2E_SCENARIO_IDS.length);
  });

  it("シナリオIDが HP -> NG -> ED の順序で定義されている", () => {
    const hpStart = E2E_SCENARIO_IDS.indexOf("HP-01");
    const ngStart = E2E_SCENARIO_IDS.indexOf("NG-01");
    const edStart = E2E_SCENARIO_IDS.indexOf("ED-01");

    expect(hpStart).toBe(0);
    expect(ngStart).toBeGreaterThan(hpStart);
    expect(edStart).toBeGreaterThan(ngStart);
  });
});
