import { describe, expect, it } from "vitest";
import { decodeHistoryCursor, encodeHistoryCursor } from "../../history-cursor";

describe("history-cursor", () => {
  it("署名付きcursorを生成し復号できる", () => {
    const now = new Date("2026-02-11T12:00:00.000Z");
    const cursor = encodeHistoryCursor({
      cursorKey: {
        endedAt: "2026-02-11T11:57:45.000Z",
        handId: "d1b2c3d4-0002-4000-8000-000000000002",
      },
      now,
      secret: "test-secret",
    });

    const decoded = decodeHistoryCursor({
      cursor,
      now,
      secret: "test-secret",
    });

    expect(decoded).toEqual({
      endedAt: "2026-02-11T11:57:45.000Z",
      handId: "d1b2c3d4-0002-4000-8000-000000000002",
    });
  });

  it("改ざんされたcursorで INVALID_CURSOR を投げる", () => {
    const now = new Date("2026-02-11T12:00:00.000Z");
    const cursor = encodeHistoryCursor({
      cursorKey: {
        endedAt: "2026-02-11T11:57:45.000Z",
        handId: "d1b2c3d4-0002-4000-8000-000000000002",
      },
      now,
      secret: "test-secret",
    });

    expect(() =>
      decodeHistoryCursor({
        cursor: `${cursor}tampered`,
        now,
        secret: "test-secret",
      }),
    ).toThrowError("cursor が不正です。最新一覧から取得し直してください。");
  });

  it("期限切れcursorで INVALID_CURSOR を投げる", () => {
    const issuedAt = new Date("2026-02-11T12:00:00.000Z");
    const cursor = encodeHistoryCursor({
      cursorKey: {
        endedAt: "2026-02-11T11:57:45.000Z",
        handId: "d1b2c3d4-0002-4000-8000-000000000002",
      },
      now: issuedAt,
      secret: "test-secret",
      ttlMs: 1000,
    });

    expect(() =>
      decodeHistoryCursor({
        cursor,
        now: new Date("2026-02-11T12:00:02.000Z"),
        secret: "test-secret",
      }),
    ).toThrowError("cursor が不正です。最新一覧から取得し直してください。");
  });
});
