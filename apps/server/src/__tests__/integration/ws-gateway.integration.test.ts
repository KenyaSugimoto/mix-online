import {
  RealtimeErrorCode,
  RealtimeTableCommandType,
  SeatStateChangeReason,
  SeatStatus,
  SnapshotReason,
  TableCommandAction,
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

const collectMessagesForDuration = (
  socket: WebSocket,
  durationMs: number,
): Promise<unknown[]> =>
  new Promise((resolve, reject) => {
    const messages: unknown[] = [];
    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("message", onMessage);
      socket.off("error", onError);
    };

    const onMessage = (message: WebSocket.RawData) => {
      try {
        messages.push(JSON.parse(message.toString("utf-8")));
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve(messages);
    }, durationMs);

    socket.on("message", onMessage);
    socket.on("error", onError);
  });

const waitFor = (durationMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs);
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

  it("ハンド終局後に /api/history/hands で履歴が参照できる", async () => {
    const now = new Date("2026-02-11T12:00:00.000Z");
    const tableId = "22222222-2222-4222-8222-222222222222";
    const user2 = {
      userId: "00000000-0000-4000-8000-000000000002",
      displayName: "U2",
      walletBalance: 4000,
    };
    const server = startRealtimeServer({ port: 0, now: () => now });
    const session1 = server.sessionStore.create(TEST_USER, now);
    const session2 = server.sessionStore.create(user2, now);
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
          requestId: "11111111-1111-4111-8111-111111111131",
          sentAt: now.toISOString(),
          payload: {
            tableId,
            buyIn: 1000,
          },
        }),
      );
      const joined1 = (await waitForMessage(socket1)) as {
        eventName?: string;
        payload?: {
          seatNo?: number;
          user?: {
            userId?: string;
          };
        };
      };
      const seatNoByUserId = new Map<string, number>();
      if (
        joined1.eventName === TableEventName.SeatStateChangedEvent &&
        joined1.payload?.seatNo &&
        joined1.payload.user?.userId
      ) {
        seatNoByUserId.set(joined1.payload.user.userId, joined1.payload.seatNo);
      }

      socket2.send(
        JSON.stringify({
          type: RealtimeTableCommandType.JOIN,
          requestId: "11111111-1111-4111-8111-111111111132",
          sentAt: now.toISOString(),
          payload: {
            tableId,
            buyIn: 1000,
          },
        }),
      );
      const openingEvents = (await waitForMessages(socket1, 4)) as Array<{
        eventName?: string;
        payload?: {
          seatNo?: number;
          bringInSeatNo?: number;
          nextToActSeatNo?: number | null;
          user?: {
            userId?: string;
          };
        };
      }>;
      for (const event of openingEvents) {
        if (
          event.eventName === TableEventName.SeatStateChangedEvent &&
          event.payload?.seatNo &&
          event.payload.user?.userId
        ) {
          seatNoByUserId.set(event.payload.user.userId, event.payload.seatNo);
        }
      }
      const user1SeatNo = seatNoByUserId.get(TEST_USER.userId);
      const user2SeatNo = seatNoByUserId.get(user2.userId);
      expect(typeof user1SeatNo).toBe("number");
      expect(typeof user2SeatNo).toBe("number");
      const dealCards3rd = openingEvents.find(
        (event) => event.eventName === TableEventName.DealCards3rdEvent,
      );
      const bringInSeatNo = dealCards3rd?.payload?.bringInSeatNo;
      expect(
        bringInSeatNo === user1SeatNo || bringInSeatNo === user2SeatNo,
      ).toBe(true);

      const bringInSocket = bringInSeatNo === user1SeatNo ? socket1 : socket2;
      bringInSocket.send(
        JSON.stringify({
          type: RealtimeTableCommandType.ACT,
          requestId: "11111111-1111-4111-8111-111111111133",
          sentAt: now.toISOString(),
          payload: {
            tableId,
            action: TableCommandAction.BRING_IN,
          },
        }),
      );
      const bringInEvent = (await waitForMessage(socket1)) as {
        eventName?: string;
        payload?: {
          nextToActSeatNo?: number | null;
        };
      };
      expect(bringInEvent.eventName).toBe(TableEventName.BringInEvent);
      const nextToActSeatNo = bringInEvent.payload?.nextToActSeatNo;
      expect(
        nextToActSeatNo === user1SeatNo || nextToActSeatNo === user2SeatNo,
      ).toBe(true);

      const foldSocket = nextToActSeatNo === user1SeatNo ? socket1 : socket2;
      foldSocket.send(
        JSON.stringify({
          type: RealtimeTableCommandType.ACT,
          requestId: "11111111-1111-4111-8111-111111111134",
          sentAt: now.toISOString(),
          payload: {
            tableId,
            action: TableCommandAction.FOLD,
          },
        }),
      );
      await waitForMessage(socket1);

      let historyListBody: { items: Array<{ handId: string }> } = { items: [] };
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const historyListResponse = await server.app.request(
          "/api/history/hands",
          {
            headers: {
              cookie: `session=${session1.sessionId}`,
            },
          },
        );
        expect(historyListResponse.status).toBe(200);
        historyListBody = (await historyListResponse.json()) as {
          items: Array<{ handId: string }>;
        };
        if (historyListBody.items.length > 0) {
          break;
        }
        await new Promise((resolve) => {
          setTimeout(resolve, 50);
        });
      }
      expect(historyListBody.items.length).toBeGreaterThan(0);

      const targetHandId = historyListBody.items[0]?.handId;
      expect(targetHandId).toBeDefined();
      const historyDetailResponse = await server.app.request(
        `/api/history/hands/${targetHandId}`,
        {
          headers: {
            cookie: `session=${session1.sessionId}`,
          },
        },
      );
      expect(historyDetailResponse.status).toBe(200);
    } finally {
      socket1.terminate();
      socket2.terminate();
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
      await waitForMessages(socket1, 4);

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

      const resumed = (await waitForMessages(socket1, 3)) as Array<{
        type: string;
        tableSeq: number;
      }>;
      expect(resumed.map((message) => message.type)).toEqual([
        "table.event",
        "table.event",
        "table.event",
      ]);
      expect(resumed.map((message) => message.tableSeq)).toEqual([3, 4, 5]);
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
      await waitForMessages(socket1, 4);

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

  it("M5-39 切断中でも手番タイムアウト期限を延長せず自動FOLDする", async () => {
    const tableId = "44444444-4444-4444-8444-444444444444";
    const user2 = {
      userId: "00000000-0000-4000-8000-000000000002",
      displayName: "U2",
      walletBalance: 4000,
    };
    const server = startRealtimeServer({
      port: 0,
      now: () => new Date(),
      actionTimeoutMs: 120,
    });
    const session1 = server.sessionStore.create(TEST_USER, new Date());
    const session2 = server.sessionStore.create(user2, new Date());
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
          requestId: "11111111-1111-4111-8111-111111111141",
          sentAt: new Date().toISOString(),
          payload: {
            tableId,
            buyIn: 1000,
          },
        }),
      );
      const joined1 = (await waitForMessage(socket1)) as {
        eventName?: string;
        payload?: {
          seatNo?: number;
          user?: {
            userId?: string;
          };
        };
      };

      socket2.send(
        JSON.stringify({
          type: RealtimeTableCommandType.JOIN,
          requestId: "11111111-1111-4111-8111-111111111142",
          sentAt: new Date().toISOString(),
          payload: {
            tableId,
            buyIn: 1000,
          },
        }),
      );
      const openingEvents = (await waitForMessages(socket1, 4)) as Array<{
        eventName?: string;
        payload?: {
          seatNo?: number;
          bringInSeatNo?: number;
          nextToActSeatNo?: number | null;
          user?: {
            userId?: string;
          };
          isAuto?: boolean;
        };
      }>;

      const seatNoByUserId = new Map<string, number>();
      if (
        joined1.eventName === TableEventName.SeatStateChangedEvent &&
        joined1.payload?.seatNo &&
        joined1.payload.user?.userId
      ) {
        seatNoByUserId.set(joined1.payload.user.userId, joined1.payload.seatNo);
      }
      for (const event of openingEvents) {
        if (
          event.eventName === TableEventName.SeatStateChangedEvent &&
          event.payload?.seatNo &&
          event.payload.user?.userId
        ) {
          seatNoByUserId.set(event.payload.user.userId, event.payload.seatNo);
        }
      }

      const user1SeatNo = seatNoByUserId.get(TEST_USER.userId) ?? null;
      const user2SeatNo = seatNoByUserId.get(user2.userId) ?? null;
      expect(user1SeatNo).not.toBeNull();
      expect(user2SeatNo).not.toBeNull();

      const bringInSeatNo = openingEvents.find(
        (event) => event.eventName === TableEventName.DealCards3rdEvent,
      )?.payload?.bringInSeatNo;
      expect(bringInSeatNo).not.toBeUndefined();
      if (!user1SeatNo || !user2SeatNo || !bringInSeatNo) {
        return;
      }

      const bringInSocket = bringInSeatNo === user1SeatNo ? socket1 : socket2;
      bringInSocket.send(
        JSON.stringify({
          type: RealtimeTableCommandType.ACT,
          requestId: "11111111-1111-4111-8111-111111111143",
          sentAt: new Date().toISOString(),
          payload: {
            tableId,
            action: TableCommandAction.BRING_IN,
          },
        }),
      );

      const bringInEvent = (await waitForMessage(socket1)) as {
        eventName?: string;
        payload?: {
          nextToActSeatNo?: number | null;
        };
      };
      expect(bringInEvent.eventName).toBe(TableEventName.BringInEvent);
      const timeoutSeatNo = bringInEvent.payload?.nextToActSeatNo ?? null;
      expect(timeoutSeatNo).not.toBeNull();
      if (!timeoutSeatNo) {
        return;
      }

      const timeoutSocket = timeoutSeatNo === user1SeatNo ? socket1 : socket2;
      const observerSocket = timeoutSeatNo === user1SeatNo ? socket2 : socket1;

      await waitFor(90);
      timeoutSocket.terminate();
      const observed = (await collectMessagesForDuration(
        observerSocket,
        100,
      )) as Array<{
        eventName?: string;
        payload?: {
          isAuto?: boolean;
        };
      }>;

      const autoFoldEvent = observed.find(
        (message) =>
          message.eventName === TableEventName.FoldEvent &&
          message.payload?.isAuto === true,
      );
      expect(autoFoldEvent).toBeDefined();
    } finally {
      socket1.terminate();
      socket2.terminate();
      await server.close();
    }
  });

  it("M5-40 ヘッズアップで期限超過後に再接続しても table.act を受理しない", async () => {
    const tableId = "55555555-5555-4555-8555-555555555555";
    const user2 = {
      userId: "00000000-0000-4000-8000-000000000002",
      displayName: "U2",
      walletBalance: 4000,
    };
    const server = startRealtimeServer({
      port: 0,
      now: () => new Date(),
      actionTimeoutMs: 120,
    });
    const session1 = server.sessionStore.create(TEST_USER, new Date());
    const session2 = server.sessionStore.create(user2, new Date());
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

    let reconnectSocket: WebSocket | null = null;
    try {
      await waitForOpen(socket1);
      await waitForOpen(socket2);

      socket1.send(
        JSON.stringify({
          type: RealtimeTableCommandType.JOIN,
          requestId: "11111111-1111-4111-8111-111111111151",
          sentAt: new Date().toISOString(),
          payload: {
            tableId,
            buyIn: 1000,
          },
        }),
      );
      const joined1 = (await waitForMessage(socket1)) as {
        eventName?: string;
        payload?: {
          seatNo?: number;
          user?: {
            userId?: string;
          };
        };
      };

      socket2.send(
        JSON.stringify({
          type: RealtimeTableCommandType.JOIN,
          requestId: "11111111-1111-4111-8111-111111111152",
          sentAt: new Date().toISOString(),
          payload: {
            tableId,
            buyIn: 1000,
          },
        }),
      );
      const openingEvents = (await waitForMessages(socket1, 4)) as Array<{
        eventName?: string;
        payload?: {
          seatNo?: number;
          bringInSeatNo?: number;
          nextToActSeatNo?: number | null;
          user?: {
            userId?: string;
          };
        };
      }>;

      const seatNoByUserId = new Map<string, number>();
      if (
        joined1.eventName === TableEventName.SeatStateChangedEvent &&
        joined1.payload?.seatNo &&
        joined1.payload.user?.userId
      ) {
        seatNoByUserId.set(joined1.payload.user.userId, joined1.payload.seatNo);
      }
      for (const event of openingEvents) {
        if (
          event.eventName === TableEventName.SeatStateChangedEvent &&
          event.payload?.seatNo &&
          event.payload.user?.userId
        ) {
          seatNoByUserId.set(event.payload.user.userId, event.payload.seatNo);
        }
      }

      const user1SeatNo = seatNoByUserId.get(TEST_USER.userId) ?? null;
      const user2SeatNo = seatNoByUserId.get(user2.userId) ?? null;
      expect(user1SeatNo).not.toBeNull();
      expect(user2SeatNo).not.toBeNull();

      const bringInSeatNo = openingEvents.find(
        (event) => event.eventName === TableEventName.DealCards3rdEvent,
      )?.payload?.bringInSeatNo;
      expect(bringInSeatNo).not.toBeUndefined();
      if (!user1SeatNo || !user2SeatNo || !bringInSeatNo) {
        return;
      }

      const bringInSocket = bringInSeatNo === user1SeatNo ? socket1 : socket2;
      bringInSocket.send(
        JSON.stringify({
          type: RealtimeTableCommandType.ACT,
          requestId: "11111111-1111-4111-8111-111111111153",
          sentAt: new Date().toISOString(),
          payload: {
            tableId,
            action: TableCommandAction.BRING_IN,
          },
        }),
      );

      const bringInEvent = (await waitForMessage(socket1)) as {
        eventName?: string;
        payload?: {
          nextToActSeatNo?: number | null;
        };
      };
      expect(bringInEvent.eventName).toBe(TableEventName.BringInEvent);
      const timeoutSeatNo = bringInEvent.payload?.nextToActSeatNo ?? null;
      expect(timeoutSeatNo).not.toBeNull();
      if (!timeoutSeatNo) {
        return;
      }

      const timeoutSocket = timeoutSeatNo === user1SeatNo ? socket1 : socket2;
      const reconnectSessionId =
        timeoutSeatNo === user1SeatNo ? session1.sessionId : session2.sessionId;

      await waitFor(90);
      timeoutSocket.terminate();
      await waitFor(40);

      reconnectSocket = new WebSocket(`ws://127.0.0.1:${server.port}/ws`, {
        headers: {
          Cookie: createSessionCookie(reconnectSessionId),
        },
      });
      await waitForOpen(reconnectSocket);

      reconnectSocket.send(
        JSON.stringify({
          type: RealtimeTableCommandType.ACT,
          requestId: "11111111-1111-4111-8111-111111111154",
          sentAt: new Date().toISOString(),
          payload: {
            tableId,
            action: TableCommandAction.FOLD,
          },
        }),
      );

      const reconnectMessages = (await collectMessagesForDuration(
        reconnectSocket,
        300,
      )) as Array<{
        type?: string;
        code?: string;
        eventName?: string;
        payload?: {
          isAuto?: boolean;
        };
      }>;

      expect(
        reconnectMessages.some(
          (message) =>
            message.type === "table.error" &&
            message.code === RealtimeErrorCode.INVALID_ACTION,
        ),
      ).toBe(true);
      expect(
        reconnectMessages.some(
          (message) =>
            message.type === "table.event" &&
            message.eventName === TableEventName.FoldEvent &&
            message.payload?.isAuto === false,
        ),
      ).toBe(false);
    } finally {
      reconnectSocket?.terminate();
      socket1.terminate();
      socket2.terminate();
      await server.close();
    }
  });
});
