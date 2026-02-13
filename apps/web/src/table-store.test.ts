import {
  BettingStructure,
  GameType,
  HandStatus,
  RealtimeTableCommandType,
  SeatStatus,
  SnapshotReason,
  Street,
  TableCommandAction,
  TableEventName,
  TableStatus,
} from "@mix-online/shared";
import { describe, expect, it } from "vitest";
import type { TableDetail } from "./table-api";
import {
  TableStoreConnectionStatus,
  TableStoreSyncStatus,
  createTableStore,
} from "./table-store";

class FakeWebSocket {
  public readyState = 0;
  public onopen: ((event: unknown) => void) | null = null;
  public onclose: ((event: unknown) => void) | null = null;
  public onerror: ((event: unknown) => void) | null = null;
  public onmessage: ((event: { data: unknown }) => void) | null = null;
  public readonly sentBodies: string[] = [];

  send(body: string) {
    this.sentBodies.push(body);
  }

  close() {
    this.readyState = 3;
    this.onclose?.({});
  }

  emitOpen() {
    this.readyState = 1;
    this.onopen?.({});
  }

  emitMessage(data: unknown) {
    this.onmessage?.({ data });
  }
}

const BASE_TIME = new Date("2026-02-14T12:00:00.000Z");

const createInitialTable = (): TableDetail => ({
  tableId: "22222222-2222-4222-8222-222222222222",
  tableName: "Table 2",
  status: TableStatus.WAITING,
  gameType: GameType.STUD_HI,
  mixIndex: 0,
  handsSinceRotation: 0,
  dealerSeatNo: 1,
  stakes: {
    smallBet: 20,
    bigBet: 40,
    ante: 5,
    bringIn: 10,
    bettingStructure: BettingStructure.FIXED_LIMIT,
    display: "$20/$40 Fixed Limit",
  },
  minPlayers: 2,
  maxPlayers: 6,
  seats: [
    {
      seatNo: 1,
      status: SeatStatus.ACTIVE,
      userId: "00000000-0000-4000-8000-000000000001",
      displayName: "U1",
      stack: 1000,
      isYou: true,
      joinedAt: BASE_TIME.toISOString(),
      disconnectStreak: 0,
    },
    {
      seatNo: 2,
      status: SeatStatus.ACTIVE,
      userId: "00000000-0000-4000-8000-000000000002",
      displayName: "U2",
      stack: 1000,
      isYou: false,
      joinedAt: BASE_TIME.toISOString(),
      disconnectStreak: 0,
    },
    {
      seatNo: 3,
      status: SeatStatus.EMPTY,
      userId: null,
      displayName: null,
      stack: 0,
      isYou: false,
      joinedAt: null,
      disconnectStreak: 0,
    },
    {
      seatNo: 4,
      status: SeatStatus.EMPTY,
      userId: null,
      displayName: null,
      stack: 0,
      isYou: false,
      joinedAt: null,
      disconnectStreak: 0,
    },
    {
      seatNo: 5,
      status: SeatStatus.EMPTY,
      userId: null,
      displayName: null,
      stack: 0,
      isYou: false,
      joinedAt: null,
      disconnectStreak: 0,
    },
    {
      seatNo: 6,
      status: SeatStatus.EMPTY,
      userId: null,
      displayName: null,
      stack: 0,
      isYou: false,
      joinedAt: null,
      disconnectStreak: 0,
    },
  ],
  currentHand: {
    handId: "33333333-3333-4333-8333-333333333333",
    handNo: 42,
    status: HandStatus.IN_PROGRESS,
    street: Street.THIRD,
    potTotal: 10,
    toActSeatNo: 1,
    actionDeadlineAt: null,
  },
});

const parseCommand = (socket: FakeWebSocket, index: number) =>
  JSON.parse(socket.sentBodies[index] ?? "{}") as {
    type: string;
    payload: Record<string, unknown>;
  };

describe("table-store", () => {
  it("接続開始時に table.resume を送信する", () => {
    const sockets: FakeWebSocket[] = [];

    const store = createTableStore({
      tableId: "22222222-2222-4222-8222-222222222222",
      initialTable: createInitialTable(),
      createWebSocket: () => {
        const socket = new FakeWebSocket();
        sockets.push(socket);
        return socket;
      },
      now: () => BASE_TIME,
      randomUUID: () => "11111111-1111-4111-8111-111111111111",
      resumeAckTimeoutMs: 10_000,
    });

    store.start();
    const socket = sockets[0];
    expect(socket).toBeDefined();

    socket?.emitOpen();
    const resumeCommand = parseCommand(socket as FakeWebSocket, 0);

    expect(resumeCommand.type).toBe(RealtimeTableCommandType.RESUME);
    expect(resumeCommand.payload).toMatchObject({
      tableId: "22222222-2222-4222-8222-222222222222",
      lastTableSeq: 0,
    });

    const snapshot = store.getSnapshot();
    expect(snapshot.connectionStatus).toBe(TableStoreConnectionStatus.OPEN);
    expect(snapshot.syncStatus).toBe(TableStoreSyncStatus.RESYNCING);
  });

  it("欠番検知で resume し、再送イベントを受けて再収束する", () => {
    const sockets: FakeWebSocket[] = [];

    const store = createTableStore({
      tableId: "22222222-2222-4222-8222-222222222222",
      initialTable: createInitialTable(),
      createWebSocket: () => {
        const socket = new FakeWebSocket();
        sockets.push(socket);
        return socket;
      },
      now: () => BASE_TIME,
      randomUUID: () => "11111111-1111-4111-8111-111111111111",
      resumeAckTimeoutMs: 10_000,
    });

    store.start();
    const socket = sockets[0] as FakeWebSocket;
    socket.emitOpen();

    socket.emitMessage(
      JSON.stringify({
        type: "table.event",
        tableId: "22222222-2222-4222-8222-222222222222",
        tableSeq: 1,
        handId: "33333333-3333-4333-8333-333333333333",
        handSeq: 1,
        occurredAt: BASE_TIME.toISOString(),
        eventName: TableEventName.CheckEvent,
        payload: {
          street: Street.THIRD,
          seatNo: 1,
          potAfter: 10,
          nextToActSeatNo: 2,
          isAuto: false,
        },
      }),
    );

    expect(store.getSnapshot().tableSeq).toBe(1);
    expect(store.getSnapshot().syncStatus).toBe(TableStoreSyncStatus.IN_SYNC);

    socket.emitMessage(
      JSON.stringify({
        type: "table.event",
        tableId: "22222222-2222-4222-8222-222222222222",
        tableSeq: 3,
        handId: "33333333-3333-4333-8333-333333333333",
        handSeq: 3,
        occurredAt: BASE_TIME.toISOString(),
        eventName: TableEventName.CheckEvent,
        payload: {
          street: Street.THIRD,
          seatNo: 2,
          potAfter: 10,
          nextToActSeatNo: 1,
          isAuto: false,
        },
      }),
    );

    expect(store.getSnapshot().tableSeq).toBe(1);
    expect(store.getSnapshot().syncStatus).toBe(TableStoreSyncStatus.RESYNCING);

    const resumeCommand = parseCommand(socket, socket.sentBodies.length - 1);
    expect(resumeCommand.type).toBe(RealtimeTableCommandType.RESUME);
    expect(resumeCommand.payload.lastTableSeq).toBe(1);

    socket.emitMessage(
      JSON.stringify({
        type: "table.event",
        tableId: "22222222-2222-4222-8222-222222222222",
        tableSeq: 2,
        handId: "33333333-3333-4333-8333-333333333333",
        handSeq: 2,
        occurredAt: BASE_TIME.toISOString(),
        eventName: TableEventName.CheckEvent,
        payload: {
          street: Street.THIRD,
          seatNo: 2,
          potAfter: 10,
          nextToActSeatNo: 1,
          isAuto: false,
        },
      }),
    );
    socket.emitMessage(
      JSON.stringify({
        type: "table.event",
        tableId: "22222222-2222-4222-8222-222222222222",
        tableSeq: 3,
        handId: "33333333-3333-4333-8333-333333333333",
        handSeq: 3,
        occurredAt: BASE_TIME.toISOString(),
        eventName: TableEventName.CheckEvent,
        payload: {
          street: Street.THIRD,
          seatNo: 1,
          potAfter: 10,
          nextToActSeatNo: 2,
          isAuto: false,
        },
      }),
    );

    expect(store.getSnapshot().tableSeq).toBe(3);
    expect(store.getSnapshot().syncStatus).toBe(TableStoreSyncStatus.IN_SYNC);
  });

  it("table.snapshot を受けると状態を置換して tableSeq を更新する", () => {
    const sockets: FakeWebSocket[] = [];
    const store = createTableStore({
      tableId: "22222222-2222-4222-8222-222222222222",
      initialTable: createInitialTable(),
      createWebSocket: () => {
        const socket = new FakeWebSocket();
        sockets.push(socket);
        return socket;
      },
      now: () => BASE_TIME,
      randomUUID: () => "11111111-1111-4111-8111-111111111111",
      resumeAckTimeoutMs: 10_000,
    });

    store.start();
    const socket = sockets[0] as FakeWebSocket;
    socket.emitOpen();

    socket.emitMessage(
      JSON.stringify({
        type: "table.snapshot",
        tableId: "22222222-2222-4222-8222-222222222222",
        tableSeq: 12,
        occurredAt: BASE_TIME.toISOString(),
        payload: {
          reason: SnapshotReason.OUT_OF_RANGE,
          table: {
            status: TableStatus.BETTING,
            gameType: GameType.RAZZ,
            stakes: {
              smallBet: 20,
              bigBet: 40,
              ante: 5,
              bringIn: 10,
            },
            seats: [
              {
                seatNo: 1,
                status: SeatStatus.ACTIVE,
                stack: 820,
                disconnectStreak: 0,
                user: {
                  userId: "00000000-0000-4000-8000-000000000001",
                  displayName: "U1",
                },
              },
              {
                seatNo: 2,
                status: SeatStatus.ACTIVE,
                stack: 1180,
                disconnectStreak: 0,
                user: {
                  userId: "00000000-0000-4000-8000-000000000002",
                  displayName: "U2",
                },
              },
              {
                seatNo: 3,
                status: SeatStatus.EMPTY,
                stack: 0,
                disconnectStreak: 0,
                user: null,
              },
              {
                seatNo: 4,
                status: SeatStatus.EMPTY,
                stack: 0,
                disconnectStreak: 0,
                user: null,
              },
              {
                seatNo: 5,
                status: SeatStatus.EMPTY,
                stack: 0,
                disconnectStreak: 0,
                user: null,
              },
              {
                seatNo: 6,
                status: SeatStatus.EMPTY,
                stack: 0,
                disconnectStreak: 0,
                user: null,
              },
            ],
            currentHand: {
              handId: "33333333-3333-4333-8333-333333333333",
              handNo: 42,
              status: HandStatus.IN_PROGRESS,
              street: Street.FOURTH,
              potTotal: 180,
              toActSeatNo: 2,
              actionDeadlineAt: null,
            },
            dealerSeatNo: 2,
            mixIndex: 1,
            handsSinceRotation: 4,
          },
        },
      }),
    );

    const snapshot = store.getSnapshot();
    expect(snapshot.tableSeq).toBe(12);
    expect(snapshot.syncStatus).toBe(TableStoreSyncStatus.IN_SYNC);
    expect(snapshot.table.status).toBe(TableStatus.BETTING);
    expect(snapshot.table.gameType).toBe(GameType.RAZZ);
    expect(snapshot.table.currentHand?.street).toBe(Street.FOURTH);
  });

  it("JOIN と ACT コマンドを送信できる", () => {
    const sockets: FakeWebSocket[] = [];
    const store = createTableStore({
      tableId: "22222222-2222-4222-8222-222222222222",
      initialTable: createInitialTable(),
      createWebSocket: () => {
        const socket = new FakeWebSocket();
        sockets.push(socket);
        return socket;
      },
      now: () => BASE_TIME,
      randomUUID: () => "11111111-1111-4111-8111-111111111111",
      resumeAckTimeoutMs: 10_000,
    });

    store.start();
    const socket = sockets[0] as FakeWebSocket;
    socket.emitOpen();

    expect(
      store.sendSeatCommand(RealtimeTableCommandType.JOIN, { buyIn: 1000 }),
    ).toBe(true);
    expect(
      store.sendActionCommand(TableCommandAction.RAISE, { amount: 40 }),
    ).toBe(true);

    const joinCommand = parseCommand(socket, 1);
    expect(joinCommand.type).toBe(RealtimeTableCommandType.JOIN);
    expect(joinCommand.payload).toMatchObject({
      tableId: "22222222-2222-4222-8222-222222222222",
      buyIn: 1000,
    });

    const actCommand = parseCommand(socket, 2);
    expect(actCommand.type).toBe(RealtimeTableCommandType.ACT);
    expect(actCommand.payload).toMatchObject({
      tableId: "22222222-2222-4222-8222-222222222222",
      action: TableCommandAction.RAISE,
      amount: 40,
    });
  });
});
