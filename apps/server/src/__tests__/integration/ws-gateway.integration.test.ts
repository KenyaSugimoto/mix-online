import {
  RealtimeErrorCode,
  RealtimeTableCommandType,
  SeatStateChangeReason,
  SeatStatus,
  SnapshotReason,
  TableEventName,
} from "@mix-online/shared";
import { describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createSessionCookie } from "../../auth-session";
import { startRealtimeServer } from "../../realtime/server";
import {
  TABLE_SNAPSHOT_MESSAGE_TYPE,
  createRealtimeTableService,
} from "../../realtime/table-service";

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
      expect(message.code).toBe(RealtimeErrorCode.AUTH_EXPIRED);
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
      expect(message.code).toBe(RealtimeErrorCode.INVALID_ACTION);
    } finally {
      socket.terminate();
      await server.close();
    }
  });

  it("table.join を受理して SeatStateChangedEvent を返す", async () => {
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
          type: RealtimeTableCommandType.JOIN,
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
        eventName: string;
        tableSeq: number;
        tableId: string;
        payload: {
          reason: string;
          currentStatus: string;
          stack: number;
        };
      };

      expect(message.type).toBe("table.event");
      expect(message.eventName).toBe(TableEventName.SeatStateChangedEvent);
      expect(message.tableSeq).toBe(1);
      expect(message.tableId).toBe("22222222-2222-4222-8222-222222222222");
      expect(message.payload.reason).toBe(SeatStateChangeReason.JOIN);
      expect(message.payload.currentStatus).toBe(SeatStatus.ACTIVE);
      expect(message.payload.stack).toBe(1000);
    } finally {
      socket.terminate();
      await server.close();
    }
  });

  it("HP-09 table.resume で差分イベントを再送する", async () => {
    const now = new Date("2026-02-11T12:00:00.000Z");
    const tableId = "22222222-2222-4222-8222-222222222222";
    const server = startRealtimeServer({ port: 0, now: () => now });
    const session1 = server.sessionStore.create(TEST_USER, now);
    const session2 = server.sessionStore.create(
      {
        userId: "00000000-0000-4000-8000-000000000002",
        displayName: "U2",
        walletBalance: 4000,
      },
      now,
    );

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
          sentAt: now.toISOString(),
          payload: {
            tableId,
            buyIn: 1000,
          },
        }),
      );
      await waitForMessage(socket1);

      socket2.send(
        JSON.stringify({
          type: RealtimeTableCommandType.JOIN,
          requestId: "11111111-1111-4111-8111-111111111112",
          sentAt: now.toISOString(),
          payload: {
            tableId,
            buyIn: 1000,
          },
        }),
      );
      await waitForMessages(socket1, 5);

      socket1.send(
        JSON.stringify({
          type: RealtimeTableCommandType.RESUME,
          requestId: "11111111-1111-4111-8111-111111111113",
          sentAt: now.toISOString(),
          payload: {
            tableId,
            lastTableSeq: 2,
          },
        }),
      );

      const resumed = (await waitForMessages(socket1, 4)) as Array<{
        type: string;
        tableSeq: number;
      }>;
      expect(resumed.map((message) => message.type)).toEqual([
        "table.event",
        "table.event",
        "table.event",
        "table.event",
      ]);
      expect(resumed.map((message) => message.tableSeq)).toEqual([3, 4, 5, 6]);
    } finally {
      socket1.terminate();
      socket2.terminate();
      await server.close();
    }
  });

  it("HP-11 差分保持外の table.resume で table.snapshot を返す", async () => {
    const now = new Date("2026-02-11T12:00:00.000Z");
    const tableId = "22222222-2222-4222-8222-222222222222";
    const tableService = createRealtimeTableService({ retainedEventLimit: 2 });
    const server = startRealtimeServer({
      port: 0,
      now: () => now,
      tableService,
    });
    const session1 = server.sessionStore.create(TEST_USER, now);
    const session2 = server.sessionStore.create(
      {
        userId: "00000000-0000-4000-8000-000000000002",
        displayName: "U2",
        walletBalance: 4000,
      },
      now,
    );

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
          sentAt: now.toISOString(),
          payload: {
            tableId,
            buyIn: 1000,
          },
        }),
      );
      await waitForMessage(socket1);

      socket2.send(
        JSON.stringify({
          type: RealtimeTableCommandType.JOIN,
          requestId: "11111111-1111-4111-8111-111111111112",
          sentAt: now.toISOString(),
          payload: {
            tableId,
            buyIn: 1000,
          },
        }),
      );
      await waitForMessages(socket1, 5);

      socket1.send(
        JSON.stringify({
          type: RealtimeTableCommandType.RESUME,
          requestId: "11111111-1111-4111-8111-111111111114",
          sentAt: now.toISOString(),
          payload: {
            tableId,
            lastTableSeq: 1,
          },
        }),
      );

      const snapshot = (await waitForMessage(socket1)) as {
        type: string;
        tableId: string;
        tableSeq: number;
        payload: {
          reason: string;
          table: {
            status: string;
            gameType: string;
            stakes: Record<string, number>;
            seats: unknown[];
            currentHand: unknown;
            dealerSeatNo: number;
            mixIndex: number;
            handsSinceRotation: number;
          };
        };
      };

      expect(snapshot.type).toBe(TABLE_SNAPSHOT_MESSAGE_TYPE);
      expect(snapshot.tableId).toBe(tableId);
      expect(snapshot.payload.reason).toBe(SnapshotReason.OUT_OF_RANGE);
      expect(snapshot.payload.table).toMatchObject({
        status: expect.any(String),
        gameType: expect.any(String),
        stakes: {
          smallBet: expect.any(Number),
          bigBet: expect.any(Number),
          ante: expect.any(Number),
          bringIn: expect.any(Number),
        },
        seats: expect.any(Array),
        dealerSeatNo: expect.any(Number),
        mixIndex: expect.any(Number),
        handsSinceRotation: expect.any(Number),
      });
    } finally {
      socket1.terminate();
      socket2.terminate();
      await server.close();
    }
  });

  it("HP-12 再起動後も進行中ハンドを復元し tableSeq を継続できる", async () => {
    const now = new Date("2026-02-11T12:00:00.000Z");
    const tableId = "33333333-3333-4333-8333-333333333333";

    const server1 = startRealtimeServer({
      port: 0,
      now: () => now,
      actionTimeoutMs: 30_000,
    });

    let latestBeforeRestart = 0;
    let runtimeState = server1.tableService.exportRuntimeState();

    try {
      await server1.tableService.executeCommand({
        command: {
          type: RealtimeTableCommandType.JOIN,
          requestId: "11111111-1111-4111-8111-111111111121",
          sentAt: now.toISOString(),
          payload: {
            tableId,
            buyIn: 1000,
          },
        },
        user: TEST_USER,
        occurredAt: now,
      });

      await server1.tableService.executeCommand({
        command: {
          type: RealtimeTableCommandType.JOIN,
          requestId: "11111111-1111-4111-8111-111111111122",
          sentAt: now.toISOString(),
          payload: {
            tableId,
            buyIn: 1000,
          },
        },
        user: {
          userId: "00000000-0000-4000-8000-000000000002",
          displayName: "U2",
          walletBalance: 4000,
        },
        occurredAt: now,
      });

      runtimeState = server1.tableService.exportRuntimeState();
      const historyBefore = runtimeState.eventHistoryByTableId[tableId] ?? [];
      latestBeforeRestart =
        historyBefore[historyBefore.length - 1]?.tableSeq ?? 0;
      expect(latestBeforeRestart).toBeGreaterThan(0);
    } finally {
      await server1.close();
    }

    const server2 = startRealtimeServer({
      port: 0,
      now: () => now,
      initialRealtimeState: runtimeState,
      actionTimeoutMs: 30,
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 80));

      const resumed = await server2.tableService.resumeFrom({
        tableId,
        lastTableSeq: latestBeforeRestart,
        occurredAt: now,
      });
      expect(resumed.kind).toBe("events");
      if (resumed.kind !== "events") {
        return;
      }

      expect(resumed.events.length).toBeGreaterThan(0);
      expect(resumed.events[0]?.tableSeq).toBeGreaterThan(latestBeforeRestart);
    } finally {
      await server2.close();
    }
  });
});
