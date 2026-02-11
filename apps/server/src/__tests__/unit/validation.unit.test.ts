import { describe, expect, it } from "vitest";
import { HttpAppError } from "../../error-response";
import {
  isUuid,
  validateOptionalTableStatus,
  validateUuid,
  validateWsBaseCommand,
} from "../../validation";

describe("入力バリデーション", () => {
  it("UUID形式の文字列を判定できる", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });

  it("tableId の UUID 検証で不正値を拒否する", () => {
    expect(() => validateUuid("abc", "tableId")).toThrow(HttpAppError);
  });

  it("state クエリは TableStatus のみ許可する", () => {
    expect(validateOptionalTableStatus(undefined)).toBeUndefined();
    expect(validateOptionalTableStatus("WAITING")).toBe("WAITING");
    expect(() => validateOptionalTableStatus("INVALID")).toThrow(HttpAppError);
  });

  it("WebSocketコマンドの基本フォーマットを検証する", () => {
    expect(
      validateWsBaseCommand({
        type: "table.join",
        requestId: "11111111-1111-4111-8111-111111111111",
        sentAt: "2026-02-11T00:00:00.000Z",
        payload: { tableId: "22222222-2222-4222-8222-222222222222" },
      }),
    ).toEqual({
      type: "table.join",
      requestId: "11111111-1111-4111-8111-111111111111",
      sentAt: "2026-02-11T00:00:00.000Z",
      payload: { tableId: "22222222-2222-4222-8222-222222222222" },
    });
  });

  it("WebSocketコマンドの必須項目欠落を拒否する", () => {
    expect(() =>
      validateWsBaseCommand({
        type: "table.join",
        sentAt: "2026-02-11T00:00:00.000Z",
        payload: {},
      }),
    ).toThrow(HttpAppError);
  });
});
