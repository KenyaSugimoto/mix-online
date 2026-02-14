import {
  ErrorCode,
  RealtimeErrorCode,
  RealtimeTableCommandType,
} from "@mix-online/shared";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { createInMemorySessionStore } from "../../auth-session";
import type { SessionUser } from "../../auth-session";
import { createRealtimeTableService } from "../../realtime/table-service";

const createAuthenticatedHttpApp = () => {
  const sessionStore = createInMemorySessionStore();
  const session = sessionStore.create(
    {
      userId: "f1b2c3d4-9999-4999-8999-999999999999",
      displayName: "MVP User",
      walletBalance: 4000,
    },
    new Date("2026-02-11T12:00:00.000Z"),
  );
  const app = createApp({
    sessionStore,
    now: () => new Date("2026-02-11T12:30:00.000Z"),
    historyCursorSecret: "test-history-cursor-secret",
  });

  return {
    app,
    cookie: `session=${session.sessionId}`,
  };
};

const NOW = new Date("2026-02-11T12:00:00.000Z");
const TABLE_ID = "a1b2c3d4-0001-4000-8000-000000000001";

const createUser = (index: number, walletBalance = 4000): SessionUser => ({
  userId: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
  displayName: `U${index}`,
  walletBalance,
});

describe("E2E 異常系", () => {
  it("NG-08 履歴 cursor 改ざん時は INVALID_CURSOR を返す", async () => {
    const { app, cookie } = createAuthenticatedHttpApp();
    const response = await app.request("/api/history/hands?cursor=tampered", {
      headers: {
        cookie,
      },
    });
    const body = (await response.json()) as {
      error: {
        code: string;
      };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe(ErrorCode.INVALID_CURSOR);
  });

  it("NG-01 buy-in 範囲外は BUYIN_OUT_OF_RANGE を返す", async () => {
    const service = createRealtimeTableService();
    const result = await service.executeCommand({
      command: {
        type: RealtimeTableCommandType.JOIN,
        requestId: "11111111-1111-4111-8111-111111111111",
        sentAt: NOW.toISOString(),
        payload: {
          tableId: TABLE_ID,
          buyIn: 399,
        },
      },
      user: createUser(1),
      occurredAt: NOW,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(RealtimeErrorCode.BUYIN_OUT_OF_RANGE);
    }
  });
});
