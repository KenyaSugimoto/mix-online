import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  RealtimeErrorCode,
  RealtimeTableCommandType,
  TableEventName,
} from "@mix-online/shared";
import { describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createSessionCookie } from "../../auth-session";
import { startRealtimeServer } from "../../realtime/server";
import { createRealtimeTableService } from "../../realtime/table-service";

const BASE_TIME = new Date("2026-02-11T12:00:00.000Z");
const TABLE_ID = "22222222-2222-4222-8222-222222222222";
const USER_1 = {
  userId: "00000000-0000-4000-8000-000000000001",
  displayName: "U1",
  walletBalance: 4000,
};
const USER_2 = {
  userId: "00000000-0000-4000-8000-000000000002",
  displayName: "U2",
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

const waitForMessages = (
  socket: WebSocket,
  count: number,
): Promise<unknown[]> =>
  new Promise((resolve, reject) => {
    const messages: unknown[] = [];
    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(`Expected ${count} messages but got ${messages.length}`),
      );
    }, 2000);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("message", onMessage);
      socket.off("error", onError);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onMessage = (message: WebSocket.RawData) => {
      try {
        messages.push(JSON.parse(message.toString("utf-8")));
      } catch (error) {
        cleanup();
        reject(error);
        return;
      }

      if (messages.length === count) {
        cleanup();
        resolve(messages);
      }
    };

    socket.on("message", onMessage);
    socket.on("error", onError);
  });

const expectExactKeys = (value: Record<string, unknown>, keys: string[]) => {
  expect(Object.keys(value).sort()).toEqual([...keys].sort());
};

describe("Realtime契約テスト（M3-11）", () => {
  it("AsyncAPIに realtime 必須メッセージが定義されている", () => {
    const asyncapiPath = fileURLToPath(
      new URL("../../../../../docs/mvp/asyncapi.yaml", import.meta.url),
    );
    const asyncapi = readFileSync(asyncapiPath, "utf-8");

    expect(asyncapi).toContain("table.event.message");
    expect(asyncapi).toContain("table.error.message");
    expect(asyncapi).toContain("table.snapshot.message");
    expect(asyncapi).toContain("pong.message");
    expect(asyncapi).toContain("table.resume.command");
  });

  it("pong メッセージが契約どおり", async () => {
    const server = startRealtimeServer({ port: 0, now: () => BASE_TIME });
    const session = server.sessionStore.create(USER_1, BASE_TIME);
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
          sentAt: BASE_TIME.toISOString(),
          payload: {},
        }),
      );

      const message = (await waitForMessage(socket)) as Record<string, unknown>;
      expectExactKeys(message, ["type", "requestId", "occurredAt"]);
      expect(message.type).toBe("pong");
      expect(typeof message.requestId).toBe("string");
      expect(typeof message.occurredAt).toBe("string");
    } finally {
      socket.terminate();
      await server.close();
    }
  });

  it("table.error メッセージが契約どおり", async () => {
    const server = startRealtimeServer({ port: 0, now: () => BASE_TIME });
    const socket = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);

    try {
      await waitForOpen(socket);
      socket.send(
        JSON.stringify({
          type: "ping",
          requestId: "11111111-1111-4111-8111-111111111111",
          sentAt: BASE_TIME.toISOString(),
          payload: {},
        }),
      );

      const message = (await waitForMessage(socket)) as Record<string, unknown>;
      expectExactKeys(message, [
        "type",
        "requestId",
        "tableId",
        "code",
        "message",
        "occurredAt",
      ]);
      expect(message.type).toBe("table.error");
      expect(message.code).toBe(RealtimeErrorCode.AUTH_EXPIRED);
      expect(message.requestId).toBeNull();
      expect(message.tableId).toBeNull();
      expect(typeof message.occurredAt).toBe("string");
    } finally {
      socket.terminate();
      await server.close();
    }
  });

  it("table.event メッセージが契約どおり", async () => {
    const server = startRealtimeServer({ port: 0, now: () => BASE_TIME });
    const session = server.sessionStore.create(USER_1, BASE_TIME);
    const socket = new WebSocket(`ws://127.0.0.1:${server.port}/ws`, {
      headers: {
        Cookie: createSessionCookie(session.sessionId),
      },
    });

    try {
      await waitForOpen(socket);
      socket.send(
        JSON.stringify({
          type: RealtimeTableCommandType.JOIN,
          requestId: "11111111-1111-4111-8111-111111111111",
          sentAt: BASE_TIME.toISOString(),
          payload: {
            tableId: TABLE_ID,
            buyIn: 1000,
          },
        }),
      );

      const message = (await waitForMessage(socket)) as {
        type: string;
        payload: Record<string, unknown>;
      } & Record<string, unknown>;
      expectExactKeys(message, [
        "type",
        "tableId",
        "tableSeq",
        "handId",
        "handSeq",
        "occurredAt",
        "eventName",
        "payload",
      ]);
      expect(message.type).toBe("table.event");
      expect(message.eventName).toBe(TableEventName.SeatStateChangedEvent);
      expectExactKeys(message.payload, [
        "seatNo",
        "previousStatus",
        "currentStatus",
        "reason",
        "user",
        "stack",
        "appliesFrom",
      ]);
    } finally {
      socket.terminate();
      await server.close();
    }
  });

  it("table.snapshot メッセージが契約どおり", async () => {
    const tableService = createRealtimeTableService({ retainedEventLimit: 2 });
    const server = startRealtimeServer({
      port: 0,
      now: () => BASE_TIME,
      tableService,
    });

    const session1 = server.sessionStore.create(USER_1, BASE_TIME);
    const session2 = server.sessionStore.create(USER_2, BASE_TIME);

    const socket1 = new WebSocket(`ws://127.0.0.1:${server.port}/ws`, {
      headers: {
        Cookie: createSessionCookie(session1.sessionId),
      },
    });
    const socket2 = new WebSocket(`ws://127.0.0.1:${server.port}/ws`, {
      headers: {
        Cookie: createSessionCookie(session2.sessionId),
      },
    });

    try {
      await waitForOpen(socket1);
      await waitForOpen(socket2);

      socket1.send(
        JSON.stringify({
          type: RealtimeTableCommandType.JOIN,
          requestId: "11111111-1111-4111-8111-111111111111",
          sentAt: BASE_TIME.toISOString(),
          payload: {
            tableId: TABLE_ID,
            buyIn: 1000,
          },
        }),
      );
      await waitForMessage(socket1);

      socket2.send(
        JSON.stringify({
          type: RealtimeTableCommandType.JOIN,
          requestId: "11111111-1111-4111-8111-111111111112",
          sentAt: BASE_TIME.toISOString(),
          payload: {
            tableId: TABLE_ID,
            buyIn: 1000,
          },
        }),
      );
      await waitForMessages(socket1, 5);

      socket1.send(
        JSON.stringify({
          type: RealtimeTableCommandType.RESUME,
          requestId: "11111111-1111-4111-8111-111111111113",
          sentAt: BASE_TIME.toISOString(),
          payload: {
            tableId: TABLE_ID,
            lastTableSeq: 1,
          },
        }),
      );

      const message = (await waitForMessage(socket1)) as {
        payload: {
          table: Record<string, unknown>;
        };
      } & Record<string, unknown>;
      expectExactKeys(message, [
        "type",
        "tableId",
        "tableSeq",
        "occurredAt",
        "payload",
      ]);
      expect(message.type).toBe("table.snapshot");
      expectExactKeys(message.payload as Record<string, unknown>, [
        "reason",
        "table",
      ]);
      expectExactKeys(message.payload.table, [
        "status",
        "gameType",
        "stakes",
        "seats",
        "currentHand",
        "dealerSeatNo",
        "mixIndex",
        "handsSinceRotation",
      ]);
    } finally {
      socket1.terminate();
      socket2.terminate();
      await server.close();
    }
  });
});
