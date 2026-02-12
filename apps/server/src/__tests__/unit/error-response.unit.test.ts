import { ERROR_CODES, ErrorCode, RealtimeErrorCode } from "@mix-online/shared";
import { describe, expect, it } from "vitest";
import {
  HttpAppError,
  toHttpErrorResponse,
  toTableErrorMessage,
} from "../../error-response";

describe("エラー応答基盤", () => {
  it("HTTPエラーを code と status に正規化する", () => {
    const error = new HttpAppError(ErrorCode.BAD_REQUEST);
    expect(error.code).toBe(ErrorCode.BAD_REQUEST);
    expect(error.status).toBe(400);
  });

  it("HTTPエラーレスポンスに requestId を含める", () => {
    expect(toHttpErrorResponse(ErrorCode.NOT_FOUND, "req-1")).toEqual({
      error: {
        code: ErrorCode.NOT_FOUND,
        message: "対象リソースが見つかりません。",
        requestId: "req-1",
      },
    });
  });

  it("定義済みErrorCodeをすべて HttpAppError で扱える", () => {
    for (const code of ERROR_CODES) {
      const error = new HttpAppError(code);
      expect(error.code).toBe(code);
      expect(error.message.length).toBeGreaterThan(0);
    }
  });

  it("table.error メッセージ形式を生成する", () => {
    expect(
      toTableErrorMessage({
        code: RealtimeErrorCode.INVALID_ACTION,
        message: "アクションが不正です。",
        occurredAt: "2026-02-11T00:00:00.000Z",
        requestId: null,
        tableId: null,
      }),
    ).toEqual({
      type: "table.error",
      requestId: null,
      tableId: null,
      code: RealtimeErrorCode.INVALID_ACTION,
      message: "アクションが不正です。",
      occurredAt: "2026-02-11T00:00:00.000Z",
    });
  });
});
