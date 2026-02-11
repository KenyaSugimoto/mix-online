import { TableStatus } from "@mix-online/shared";
import { describe, expect, it } from "vitest";
import { HttpAppError } from "../../error-response";
import {
  isUuid,
  resolveRequestId,
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
    expect(validateOptionalTableStatus(TableStatus.WAITING)).toBe(
      TableStatus.WAITING,
    );
    expect(() => validateOptionalTableStatus("INVALID")).toThrow(HttpAppError);
  });

  it("requestId は有効UUIDを優先し、無効値は再採番する", () => {
    const createRequestId = () => "99999999-9999-4999-8999-999999999999";
    expect(
      resolveRequestId("11111111-1111-4111-8111-111111111111", createRequestId),
    ).toBe("11111111-1111-4111-8111-111111111111");
    expect(resolveRequestId("invalid-request-id", createRequestId)).toBe(
      "99999999-9999-4999-8999-999999999999",
    );
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

  it("WebSocketコマンド種別の列挙を受け入れる", () => {
    const requestId = "11111111-1111-4111-8111-111111111111";
    const sentAt = "2026-02-11T00:00:00.000Z";

    expect(
      validateWsBaseCommand({
        type: "table.sitOut",
        requestId,
        sentAt,
        payload: {},
      }).type,
    ).toBe("table.sitOut");
    expect(
      validateWsBaseCommand({
        type: "table.return",
        requestId,
        sentAt,
        payload: {},
      }).type,
    ).toBe("table.return");
    expect(
      validateWsBaseCommand({
        type: "table.leave",
        requestId,
        sentAt,
        payload: {},
      }).type,
    ).toBe("table.leave");
    expect(
      validateWsBaseCommand({
        type: "table.act",
        requestId,
        sentAt,
        payload: { action: "CHECK" },
      }).type,
    ).toBe("table.act");
    expect(
      validateWsBaseCommand({
        type: "table.resume",
        requestId,
        sentAt,
        payload: { lastTableSeq: 12 },
      }).type,
    ).toBe("table.resume");
    expect(
      validateWsBaseCommand({
        type: "ping",
        requestId,
        sentAt,
        payload: {},
      }).type,
    ).toBe("ping");
  });
});
