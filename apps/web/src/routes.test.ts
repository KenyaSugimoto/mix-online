import { describe, expect, it } from "vitest";
import { resolveRoute } from "./routes";

describe("routes", () => {
  it("ログイン画面の経路を判定する", () => {
    expect(resolveRoute("/")).toEqual({ kind: "login" });
    expect(resolveRoute("/login")).toEqual({ kind: "login" });
    expect(resolveRoute("/login/")).toEqual({ kind: "login" });
  });

  it("ロビー画面の経路を判定する", () => {
    expect(resolveRoute("/lobby")).toEqual({ kind: "lobby" });
  });

  it("卓詳細の経路を判定する", () => {
    expect(resolveRoute("/tables/table-01")).toEqual({
      kind: "table",
      tableId: "table-01",
    });
  });

  it("未定義経路を not-found として判定する", () => {
    expect(resolveRoute("/unknown")).toEqual({
      kind: "not-found",
      pathname: "/unknown",
    });
  });
});
