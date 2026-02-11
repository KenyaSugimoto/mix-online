import { describe, expect, it } from "vitest";
import {
  HttpAppError,
  toHttpErrorResponse,
  toTableErrorMessage,
} from "../../error-response";

describe("エラー応答基盤", () => {
  it("HTTPエラーを code と status に正規化する", () => {
    const error = new HttpAppError("BAD_REQUEST");
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.status).toBe(400);
  });

  it("HTTPエラーレスポンスに requestId を含める", () => {
    expect(toHttpErrorResponse("NOT_FOUND", "req-1")).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "対象リソースが見つかりません。",
        requestId: "req-1",
      },
    });
  });

  it("table.error メッセージ形式を生成する", () => {
    expect(
      toTableErrorMessage({
        code: "INVALID_ACTION",
        message: "アクションが不正です。",
        occurredAt: "2026-02-11T00:00:00.000Z",
        requestId: null,
        tableId: null,
      }),
    ).toEqual({
      type: "table.error",
      requestId: null,
      tableId: null,
      code: "INVALID_ACTION",
      message: "アクションが不正です。",
      occurredAt: "2026-02-11T00:00:00.000Z",
    });
  });
});
