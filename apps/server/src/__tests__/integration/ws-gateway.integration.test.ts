import { describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createSessionCookie } from "../../auth-session";
import { startRealtimeServer } from "../../realtime/server";

const TEST_USER = {
  userId: "00000000-0000-4000-8000-000000000001",
  displayName: "U1",
  walletBalance: 4000,
};

const waitForOpen = (socket: WebSocket): Promise<void> =>
  new Promise((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", (error) => reject(error));
  });

const waitForMessage = (socket: WebSocket): Promise<unknown> =>
  new Promise((resolve, reject) => {
    socket.once("message", (message) => {
      try {
        resolve(JSON.parse(message.toString("utf-8")));
      } catch (error) {
        reject(error);
      }
    });
    socket.once("error", (error) => reject(error));
  });

describe("WebSocketゲートウェイ統合", () => {
  it("pingコマンドにpongを返す", async () => {
    const now = new Date("2026-02-11T12:00:00.000Z");
    const server = startRealtimeServer({ port: 0, now: () => now });
    const session = server.sessionStore.create(TEST_USER, now);
    const socket = new WebSocket(`ws://127.0.0.1:${server.port}/ws`, {
      headers: {
        Cookie: createSessionCookie(session.sessionId),
      },
    });

    try {
      await waitForOpen(socket);
      socket.send(
        JSON.stringify({
          type: "ping",
          requestId: "11111111-1111-4111-8111-111111111111",
          sentAt: "2026-02-11T12:00:00.000Z",
          payload: {},
        }),
      );

      const message = (await waitForMessage(socket)) as {
        type: string;
        requestId: string;
        occurredAt: string;
      };

      expect(message).toEqual({
        type: "pong",
        requestId: "11111111-1111-4111-8111-111111111111",
        occurredAt: "2026-02-11T12:00:00.000Z",
      });
    } finally {
      socket.terminate();
      await server.close();
    }
  });

  it("認証なし接続はAUTH_EXPIREDを返す", async () => {
    const now = new Date("2026-02-11T12:00:00.000Z");
    const server = startRealtimeServer({ port: 0, now: () => now });
    const socket = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);

    try {
      await waitForOpen(socket);
      socket.send(
        JSON.stringify({
          type: "ping",
          requestId: "11111111-1111-4111-8111-111111111111",
          sentAt: "2026-02-11T12:00:00.000Z",
          payload: {},
        }),
      );

      const message = (await waitForMessage(socket)) as {
        type: string;
        requestId: string | null;
        tableId: string | null;
        code: string;
      };

      expect(message.type).toBe("table.error");
      expect(message.code).toBe("AUTH_EXPIRED");
      expect(message.requestId).toBeNull();
      expect(message.tableId).toBeNull();
    } finally {
      socket.terminate();
      await server.close();
    }
  });

  it("不正JSONをINVALID_ACTIONとして拒否する", async () => {
    const now = new Date("2026-02-11T12:00:00.000Z");
    const server = startRealtimeServer({ port: 0, now: () => now });
    const session = server.sessionStore.create(TEST_USER, now);
    const socket = new WebSocket(`ws://127.0.0.1:${server.port}/ws`, {
      headers: {
        Cookie: createSessionCookie(session.sessionId),
      },
    });

    try {
      await waitForOpen(socket);
      socket.send("{invalid");

      const message = (await waitForMessage(socket)) as {
        type: string;
        code: string;
      };

      expect(message.type).toBe("table.error");
      expect(message.code).toBe("INVALID_ACTION");
    } finally {
      socket.terminate();
      await server.close();
    }
  });

  it("未実装コマンドをtable.errorで返す", async () => {
    const now = new Date("2026-02-11T12:00:00.000Z");
    const server = startRealtimeServer({ port: 0, now: () => now });
    const session = server.sessionStore.create(TEST_USER, now);
    const socket = new WebSocket(`ws://127.0.0.1:${server.port}/ws`, {
      headers: {
        Cookie: createSessionCookie(session.sessionId),
      },
    });

    try {
      await waitForOpen(socket);
      socket.send(
        JSON.stringify({
          type: "table.join",
          requestId: "11111111-1111-4111-8111-111111111111",
          sentAt: "2026-02-11T12:00:00.000Z",
          payload: {
            tableId: "22222222-2222-4222-8222-222222222222",
            buyIn: 1000,
          },
        }),
      );

      const message = (await waitForMessage(socket)) as {
        type: string;
        code: string;
        requestId: string;
        tableId: string;
      };

      expect(message.type).toBe("table.error");
      expect(message.code).toBe("INVALID_ACTION");
      expect(message.requestId).toBe("11111111-1111-4111-8111-111111111111");
      expect(message.tableId).toBe("22222222-2222-4222-8222-222222222222");
    } finally {
      socket.terminate();
      await server.close();
    }
  });
});
