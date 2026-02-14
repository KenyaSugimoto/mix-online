import {
  BettingStructure,
  CardRank,
  CardSlot,
  CardSuit,
  CardVisibility,
  GameType,
  HandStatus,
  RealtimeTableCommandType,
  SeatStateChangeAppliesFrom,
  SeatStateChangeReason,
  SeatStatus,
  SnapshotReason,
  Street,
  StreetAdvanceReason,
  TableCommandAction,
  TableEventName,
  TableStatus,
  ThirdStreetCardPosition,
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
    streetBetTo: 10,
    raiseCount: 0,
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
              streetBetTo: 20,
              raiseCount: 1,
              toActSeatNo: 2,
              actionDeadlineAt: null,
              cards: [
                {
                  seatNo: 1,
                  cards: [
                    {
                      slot: CardSlot.HOLE_1,
                      visibility: CardVisibility.DOWN_SELF,
                      card: { rank: CardRank.A, suit: CardSuit.S },
                    },
                    {
                      slot: CardSlot.HOLE_2,
                      visibility: CardVisibility.DOWN_SELF,
                      card: { rank: CardRank.K, suit: CardSuit.H },
                    },
                    {
                      slot: CardSlot.UP_3,
                      visibility: CardVisibility.UP,
                      card: { rank: CardRank.N9, suit: CardSuit.D },
                    },
                    {
                      slot: CardSlot.UP_4,
                      visibility: CardVisibility.UP,
                      card: { rank: CardRank.N2, suit: CardSuit.C },
                    },
                  ],
                },
              ],
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
    expect(snapshot.cardsBySeatNo[1]?.length).toBe(4);
    expect(snapshot.cardsBySeatNo[1]?.[0]?.visibility).toBe(
      CardVisibility.DOWN_SELF,
    );
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
    expect(store.sendActionCommand(TableCommandAction.RAISE)).toBe(true);

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
    });
  });

  it("BRING_IN はMVP受理アクションとして送信できる", () => {
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

    expect(store.sendActionCommand(TableCommandAction.BRING_IN)).toBe(true);

    const bringInCommand = parseCommand(socket, 1);
    expect(bringInCommand.type).toBe(RealtimeTableCommandType.ACT);
    expect(bringInCommand.payload).toMatchObject({
      tableId: "22222222-2222-4222-8222-222222222222",
      action: TableCommandAction.BRING_IN,
    });
  });

  it("BET はMVP受理アクションとして送信できる", () => {
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

    expect(store.sendActionCommand(TableCommandAction.BET)).toBe(true);

    const betCommand = parseCommand(socket, 1);
    expect(betCommand.type).toBe(RealtimeTableCommandType.ACT);
    expect(betCommand.payload).toMatchObject({
      tableId: "22222222-2222-4222-8222-222222222222",
      action: TableCommandAction.BET,
    });
  });

  it("currentUserId 指定時はイベント適用で自席フラグを復元できる", () => {
    const sockets: FakeWebSocket[] = [];
    const initialTable = createInitialTable();
    initialTable.seats = initialTable.seats.map((seat) => ({
      ...seat,
      isYou: false,
    }));

    const store = createTableStore({
      tableId: "22222222-2222-4222-8222-222222222222",
      initialTable,
      currentUserId: "f1b2c3d4-9999-4999-8999-999999999999",
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
        handId: null,
        handSeq: null,
        occurredAt: BASE_TIME.toISOString(),
        eventName: TableEventName.SeatStateChangedEvent,
        payload: {
          seatNo: 3,
          previousStatus: SeatStatus.EMPTY,
          currentStatus: SeatStatus.ACTIVE,
          reason: SeatStateChangeReason.JOIN,
          user: {
            userId: "f1b2c3d4-9999-4999-8999-999999999999",
            displayName: "MVP User",
          },
          stack: 1000,
          appliesFrom: SeatStateChangeAppliesFrom.IMMEDIATE,
        },
      }),
    );

    const seat3 = store
      .getSnapshot()
      .table.seats.find((seat) => seat.seatNo === 3);
    expect(seat3?.isYou).toBe(true);
    expect(seat3?.userId).toBe("f1b2c3d4-9999-4999-8999-999999999999");
  });

  it("DealCards3rd / DealCard / DealEnd でカード投影を更新する", () => {
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
        eventName: TableEventName.DealCards3rdEvent,
        payload: {
          bringInSeatNo: 1,
          cards: [
            {
              seatNo: 1,
              cards: [
                {
                  position: ThirdStreetCardPosition.HOLE_1,
                  visibility: CardVisibility.DOWN_SELF,
                  card: { rank: CardRank.A, suit: CardSuit.S },
                },
                {
                  position: ThirdStreetCardPosition.HOLE_2,
                  visibility: CardVisibility.DOWN_SELF,
                  card: { rank: CardRank.K, suit: CardSuit.S },
                },
                {
                  position: ThirdStreetCardPosition.UP_3,
                  visibility: CardVisibility.UP,
                  card: { rank: CardRank.N9, suit: CardSuit.D },
                },
              ],
            },
          ],
        },
      }),
    );
    expect(store.getSnapshot().cardsBySeatNo[1]?.length).toBe(3);

    socket.emitMessage(
      JSON.stringify({
        type: "table.event",
        tableId: "22222222-2222-4222-8222-222222222222",
        tableSeq: 2,
        handId: "33333333-3333-4333-8333-333333333333",
        handSeq: 2,
        occurredAt: BASE_TIME.toISOString(),
        eventName: TableEventName.DealCardEvent,
        payload: {
          street: Street.FOURTH,
          cards: [
            {
              seatNo: 1,
              visibility: CardVisibility.UP,
              card: { rank: CardRank.N5, suit: CardSuit.C },
            },
          ],
          toActSeatNo: 1,
          potAfter: 20,
        },
      }),
    );
    expect(store.getSnapshot().cardsBySeatNo[1]?.length).toBe(4);
    expect(store.getSnapshot().cardsBySeatNo[1]?.[3]?.slot).toBe(CardSlot.UP_4);

    socket.emitMessage(
      JSON.stringify({
        type: "table.event",
        tableId: "22222222-2222-4222-8222-222222222222",
        tableSeq: 3,
        handId: "33333333-3333-4333-8333-333333333333",
        handSeq: 3,
        occurredAt: BASE_TIME.toISOString(),
        eventName: TableEventName.DealEndEvent,
        payload: {
          finalPot: 40,
          nextDealerSeatNo: 2,
          nextGameType: GameType.RAZZ,
          mixIndex: 1,
          handsSinceRotation: 2,
          results: [
            {
              seatNo: 1,
              stackAfter: 1020,
            },
          ],
        },
      }),
    );
    expect(Object.keys(store.getSnapshot().cardsBySeatNo)).toEqual([]);
  });

  it("SeatStateChanged と StreetAdvance のログを保持する", () => {
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
        handId: null,
        handSeq: null,
        occurredAt: BASE_TIME.toISOString(),
        eventName: TableEventName.SeatStateChangedEvent,
        payload: {
          seatNo: 3,
          previousStatus: SeatStatus.EMPTY,
          currentStatus: SeatStatus.SEATED_WAIT_NEXT_HAND,
          reason: SeatStateChangeReason.JOIN,
          user: {
            userId: "33333333-3333-4333-8333-333333333333",
            displayName: "U3",
          },
          stack: 800,
          appliesFrom: SeatStateChangeAppliesFrom.IMMEDIATE,
        },
      }),
    );

    socket.emitMessage(
      JSON.stringify({
        type: "table.event",
        tableId: "22222222-2222-4222-8222-222222222222",
        tableSeq: 2,
        handId: "33333333-3333-4333-8333-333333333333",
        handSeq: 2,
        occurredAt: BASE_TIME.toISOString(),
        eventName: TableEventName.StreetAdvanceEvent,
        payload: {
          fromStreet: Street.THIRD,
          toStreet: Street.FOURTH,
          potTotal: 80,
          activeSeatNos: [1, 2],
          nextToActSeatNo: 1,
          tableStatus: TableStatus.BETTING,
          reason: StreetAdvanceReason.BETTING_ROUND_COMPLETE,
        },
      }),
    );

    const logs = store.getSnapshot().eventLogs;
    expect(logs.length).toBe(2);
    expect(logs[0]?.kind).toBe("seat_state_changed");
    expect(logs[1]?.kind).toBe("street_advance");
  });
});
