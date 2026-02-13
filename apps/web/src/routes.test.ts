import { describe, expect, it } from "vitest";
import { AppRouteKind, resolveRoute } from "./routes";

describe("routes", () => {
  it("ログイン画面の経路を判定する", () => {
    expect(resolveRoute("/")).toEqual({ kind: AppRouteKind.LOGIN });
    expect(resolveRoute("/login")).toEqual({ kind: AppRouteKind.LOGIN });
    expect(resolveRoute("/login/")).toEqual({ kind: AppRouteKind.LOGIN });
  });

  it("ロビー画面の経路を判定する", () => {
    expect(resolveRoute("/lobby")).toEqual({ kind: AppRouteKind.LOBBY });
  });

  it("卓詳細の経路を判定する", () => {
    expect(resolveRoute("/tables/table-01")).toEqual({
      kind: AppRouteKind.TABLE,
      tableId: "table-01",
    });
  });

  it("未定義経路を not-found として判定する", () => {
    expect(resolveRoute("/unknown")).toEqual({
      kind: AppRouteKind.NOT_FOUND,
      pathname: "/unknown",
    });
  });
});
