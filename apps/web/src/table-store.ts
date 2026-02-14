import {
  BettingStructure,
  GAME_TYPES,
  HAND_STATUSES,
  HandStatus,
  MVP_TABLE_ACT_ACTIONS,
  REALTIME_ERROR_CODES,
  type RealtimeErrorCode,
  RealtimeTableCommandType,
  SEAT_STATUSES,
  SNAPSHOT_REASONS,
  STREETS,
  SeatStatus,
  Street,
  TABLE_STATUSES,
  type TableCommandAction,
  TableEventName,
  TableStatus,
} from "@mix-online/shared";
import type { CurrentHandSummary, TableDetail, TableSeat } from "./table-api";
import type { SeatCommandType } from "./table-control";

const DEFAULT_RECONNECT_DELAY_MS = 1_000;
const DEFAULT_RESUME_ACK_TIMEOUT_MS = 1_500;
const OPEN_READY_STATE = 1;

export const TableStoreConnectionStatus = {
  IDLE: "idle",
  CONNECTING: "connecting",
  OPEN: "open",
  RECONNECTING: "reconnecting",
  CLOSED: "closed",
} as const;
export type TableStoreConnectionStatus =
  (typeof TableStoreConnectionStatus)[keyof typeof TableStoreConnectionStatus];

export const TableStoreSyncStatus = {
  IDLE: "idle",
  RESYNCING: "resyncing",
  IN_SYNC: "in_sync",
} as const;
export type TableStoreSyncStatus =
  (typeof TableStoreSyncStatus)[keyof typeof TableStoreSyncStatus];

export type TableStoreState = {
  table: TableDetail;
  tableSeq: number;
  connectionStatus: TableStoreConnectionStatus;
  syncStatus: TableStoreSyncStatus;
  lastErrorCode: RealtimeErrorCode | null;
  lastErrorMessage: string | null;
};

export type TableStoreSnapshot = TableStoreState;
type TableStoreListener = (state: TableStoreSnapshot) => void;

type WebSocketLike = {
  readyState: number;
  onopen: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  send: (body: string) => void;
  close: () => void;
};

type CreateWebSocket = (url: string) => WebSocketLike;

type TimerId = ReturnType<typeof setTimeout>;
type SetTimeoutLike = (callback: () => void, timeoutMs: number) => TimerId;
type ClearTimeoutLike = (timerId: TimerId) => void;

export type TableStoreOptions = {
  tableId: string;
  initialTable: TableDetail;
  currentUserId?: string;
  wsUrl?: string;
  reconnectDelayMs?: number;
  resumeAckTimeoutMs?: number;
  createWebSocket?: CreateWebSocket;
  randomUUID?: () => string;
  now?: () => Date;
  setTimeoutFn?: SetTimeoutLike;
  clearTimeoutFn?: ClearTimeoutLike;
};

type TableEventMessage = {
  type: "table.event";
  tableId: string;
  tableSeq: number;
  handId: string | null;
  handSeq: number | null;
  occurredAt: string;
  eventName: string;
  payload: Record<string, unknown>;
};

type TableSnapshotSeat = {
  seatNo: number;
  status: (typeof SEAT_STATUSES)[number];
  stack: number;
  disconnectStreak: number;
  user: {
    userId: string;
    displayName: string;
  } | null;
};

type TableSnapshotHand = {
  handId: string;
  handNo: number;
  status: (typeof HAND_STATUSES)[number];
  street: (typeof Street)[keyof typeof Street];
  potTotal: number;
  streetBetTo: number;
  raiseCount: number;
  toActSeatNo: number | null;
  actionDeadlineAt: string | null;
};

type TableSnapshotMessage = {
  type: "table.snapshot";
  tableId: string;
  tableSeq: number;
  occurredAt: string;
  payload: {
    reason: (typeof SNAPSHOT_REASONS)[number];
    table: {
      status: (typeof TABLE_STATUSES)[number];
      gameType: (typeof GAME_TYPES)[number];
      stakes: {
        smallBet: number;
        bigBet: number;
        ante: number;
        bringIn: number;
      };
      seats: TableSnapshotSeat[];
      currentHand: TableSnapshotHand | null;
      dealerSeatNo: number;
      mixIndex: number;
      handsSinceRotation: number;
    };
  };
};

type TableErrorMessage = {
  type: "table.error";
  requestId: string | null;
  tableId: string | null;
  code: RealtimeErrorCode;
  message: string;
  occurredAt: string;
};

type PongMessage = {
  type: "pong";
  requestId: string;
  occurredAt: string;
};

type WsMessage =
  | TableEventMessage
  | TableSnapshotMessage
  | TableErrorMessage
  | PongMessage;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value);

const isNonNegativeInteger = (value: unknown): value is number =>
  isInteger(value) && value >= 0;

const isString = (value: unknown): value is string => typeof value === "string";

const isNullableString = (value: unknown): value is string | null =>
  value === null || isString(value);

const isNullableInteger = (value: unknown): value is number | null =>
  value === null || isInteger(value);

const isEnumValue = <T extends readonly string[]>(
  value: unknown,
  values: T,
): value is T[number] => isString(value) && values.includes(value as T[number]);

const parseJsonMessage = (raw: string): WsMessage | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || !isString(parsed.type)) {
    return null;
  }

  if (parsed.type === "table.event") {
    if (
      isString(parsed.tableId) &&
      isNonNegativeInteger(parsed.tableSeq) &&
      isNullableString(parsed.handId) &&
      isNullableInteger(parsed.handSeq) &&
      isString(parsed.occurredAt) &&
      isString(parsed.eventName) &&
      isRecord(parsed.payload)
    ) {
      return parsed as TableEventMessage;
    }
    return null;
  }

  if (parsed.type === "table.snapshot") {
    const payload = parsed.payload;
    if (
      !isString(parsed.tableId) ||
      !isNonNegativeInteger(parsed.tableSeq) ||
      !isString(parsed.occurredAt) ||
      !isRecord(payload) ||
      !isEnumValue(payload.reason, SNAPSHOT_REASONS) ||
      !isRecord(payload.table)
    ) {
      return null;
    }

    const snapshotTable = payload.table;
    if (
      !isEnumValue(snapshotTable.status, TABLE_STATUSES) ||
      !isEnumValue(snapshotTable.gameType, GAME_TYPES) ||
      !isRecord(snapshotTable.stakes) ||
      !Array.isArray(snapshotTable.seats) ||
      !isInteger(snapshotTable.dealerSeatNo) ||
      !isInteger(snapshotTable.mixIndex) ||
      !isInteger(snapshotTable.handsSinceRotation)
    ) {
      return null;
    }

    if (
      !isInteger(snapshotTable.stakes.smallBet) ||
      !isInteger(snapshotTable.stakes.bigBet) ||
      !isInteger(snapshotTable.stakes.ante) ||
      !isInteger(snapshotTable.stakes.bringIn)
    ) {
      return null;
    }

    const hasValidSeats = snapshotTable.seats.every((seat) => {
      if (!isRecord(seat)) {
        return false;
      }
      if (
        !isInteger(seat.seatNo) ||
        !isEnumValue(seat.status, SEAT_STATUSES) ||
        !isInteger(seat.stack) ||
        !isNonNegativeInteger(seat.disconnectStreak)
      ) {
        return false;
      }
      if (seat.user === null) {
        return true;
      }
      return (
        isRecord(seat.user) &&
        isString(seat.user.userId) &&
        isString(seat.user.displayName)
      );
    });
    if (!hasValidSeats) {
      return null;
    }

    if (snapshotTable.currentHand === null) {
      return parsed as TableSnapshotMessage;
    }

    if (
      !isRecord(snapshotTable.currentHand) ||
      !isString(snapshotTable.currentHand.handId) ||
      !isInteger(snapshotTable.currentHand.handNo) ||
      !isEnumValue(snapshotTable.currentHand.status, HAND_STATUSES) ||
      !isEnumValue(snapshotTable.currentHand.street, STREETS) ||
      !isInteger(snapshotTable.currentHand.potTotal) ||
      !isInteger(snapshotTable.currentHand.streetBetTo) ||
      !isInteger(snapshotTable.currentHand.raiseCount) ||
      !isNullableInteger(snapshotTable.currentHand.toActSeatNo) ||
      !isNullableString(snapshotTable.currentHand.actionDeadlineAt)
    ) {
      return null;
    }

    return parsed as TableSnapshotMessage;
  }

  if (parsed.type === "table.error") {
    if (
      isNullableString(parsed.requestId) &&
      isNullableString(parsed.tableId) &&
      isEnumValue(parsed.code, REALTIME_ERROR_CODES) &&
      isString(parsed.message) &&
      isString(parsed.occurredAt)
    ) {
      return parsed as TableErrorMessage;
    }
    return null;
  }

  if (parsed.type === "pong") {
    if (isString(parsed.requestId) && isString(parsed.occurredAt)) {
      return parsed as PongMessage;
    }
    return null;
  }

  return null;
};

const resolveWsUrl = () => {
  const explicitWsUrl = import.meta.env.VITE_WS_URL;
  if (typeof explicitWsUrl === "string" && explicitWsUrl.length > 0) {
    return explicitWsUrl;
  }

  if (typeof window === "undefined") {
    return "ws://localhost:3000/ws";
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
};

const resolveMessageText = (data: unknown): string | null => {
  if (typeof data === "string") {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new TextDecoder().decode(data);
  }
  return null;
};

const resolveCurrentUserId = (table: TableDetail) =>
  table.seats.find((seat) => seat.isYou && seat.userId !== null)?.userId ??
  null;

const normalizeTableForCurrentUser = (
  table: TableDetail,
  currentUserId: string | null,
): TableDetail => ({
  ...table,
  seats: table.seats.map((seat) => ({
    ...seat,
    isYou:
      currentUserId !== null &&
      seat.userId !== null &&
      seat.userId === currentUserId,
  })),
});

const updateSeat = (
  table: TableDetail,
  seatNo: number,
  updater: (seat: TableSeat) => TableSeat,
): TableDetail => {
  const index = table.seats.findIndex((seat) => seat.seatNo === seatNo);
  if (index < 0) {
    return table;
  }
  const currentSeat = table.seats[index];
  if (!currentSeat) {
    return table;
  }

  const nextSeat = updater(currentSeat);
  if (nextSeat === currentSeat) {
    return table;
  }

  const nextSeats = [...table.seats];
  nextSeats[index] = nextSeat;
  return {
    ...table,
    seats: nextSeats,
  };
};

const formatStakesDisplay = (smallBet: number, bigBet: number) =>
  `$${smallBet}/$${bigBet} Fixed Limit`;

const mapSnapshotTable = (
  current: TableDetail,
  snapshot: TableSnapshotMessage,
  currentUserId: string | null,
) => {
  const nextSeats = snapshot.payload.table.seats.map((seat) => {
    const existing = current.seats.find(
      (candidate) => candidate.seatNo === seat.seatNo,
    );
    const userId = seat.user?.userId ?? null;
    const displayName = seat.user?.displayName ?? null;

    return {
      seatNo: seat.seatNo,
      status: seat.status,
      userId,
      displayName,
      stack: seat.stack,
      isYou:
        userId !== null && currentUserId !== null && userId === currentUserId,
      joinedAt:
        existing && existing.userId === userId && userId !== null
          ? existing.joinedAt
          : null,
      disconnectStreak: seat.disconnectStreak,
    };
  });

  return {
    ...current,
    status: snapshot.payload.table.status,
    gameType: snapshot.payload.table.gameType,
    mixIndex: snapshot.payload.table.mixIndex,
    handsSinceRotation: snapshot.payload.table.handsSinceRotation,
    dealerSeatNo: snapshot.payload.table.dealerSeatNo,
    stakes: {
      smallBet: snapshot.payload.table.stakes.smallBet,
      bigBet: snapshot.payload.table.stakes.bigBet,
      ante: snapshot.payload.table.stakes.ante,
      bringIn: snapshot.payload.table.stakes.bringIn,
      bettingStructure:
        current.stakes.bettingStructure ?? BettingStructure.FIXED_LIMIT,
      display: formatStakesDisplay(
        snapshot.payload.table.stakes.smallBet,
        snapshot.payload.table.stakes.bigBet,
      ),
    },
    seats: nextSeats,
    currentHand: snapshot.payload.table.currentHand
      ? {
          handId: snapshot.payload.table.currentHand.handId,
          handNo: snapshot.payload.table.currentHand.handNo,
          status: snapshot.payload.table.currentHand.status,
          street: snapshot.payload.table.currentHand.street,
          potTotal: snapshot.payload.table.currentHand.potTotal,
          streetBetTo: snapshot.payload.table.currentHand.streetBetTo,
          raiseCount: snapshot.payload.table.currentHand.raiseCount,
          toActSeatNo: snapshot.payload.table.currentHand.toActSeatNo,
          actionDeadlineAt: snapshot.payload.table.currentHand.actionDeadlineAt,
        }
      : null,
  } satisfies TableDetail;
};

const mergeCurrentHand = (
  table: TableDetail,
  patch: Partial<CurrentHandSummary>,
  fallbackHandId: string | null,
) => {
  if (table.currentHand === null) {
    if (!fallbackHandId) {
      return table;
    }
    return {
      ...table,
      currentHand: {
        handId: fallbackHandId,
        handNo: 0,
        status: HandStatus.IN_PROGRESS,
        street: Street.THIRD,
        potTotal: 0,
        streetBetTo: 0,
        raiseCount: 0,
        toActSeatNo: null,
        actionDeadlineAt: null,
        ...patch,
      },
    };
  }

  return {
    ...table,
    currentHand: {
      ...table.currentHand,
      ...patch,
    },
  };
};

type SeatStateChangedPayload = {
  seatNo: number;
  currentStatus: (typeof SEAT_STATUSES)[number];
  stack: number;
  user: { userId: string; displayName: string } | null;
};

type PlayerDisconnectedPayload = {
  seatNo: number;
  seatStatus: (typeof SEAT_STATUSES)[number];
  disconnectStreak: number;
};

type PlayerReconnectedPayload = {
  seatNo: number;
  restoredSeatStatus: (typeof SEAT_STATUSES)[number];
  disconnectStreakResetTo: number;
};

type DealInitPayload = {
  handNo: number;
  gameType: (typeof GAME_TYPES)[number];
  dealerSeatNo: number;
  mixIndex: number;
  handsSinceRotation: number;
  stakes: {
    smallBet: number;
    bigBet: number;
    ante: number;
    bringIn: number;
  };
  participants?: Array<{ seatNo: number; startStack: number }>;
};

type PostAntePayload = {
  street: (typeof STREETS)[number];
  potAfter: number;
  contributions?: Array<{ seatNo: number; stackAfter: number }>;
};

type DealCards3rdPayload = {
  bringInSeatNo: number;
};

type ActionPayload = {
  street: (typeof STREETS)[number];
  seatNo: number;
  potAfter: number;
  nextToActSeatNo: number | null;
};

type BringInPayload = ActionPayload & {
  amount: number;
  stackAfter: number;
};

type ChipActionPayload = ActionPayload & {
  stackAfter: number;
  streetBetTo: number;
  raiseCount: number;
};

const isSeatStateChangedPayload = (
  payload: Record<string, unknown>,
): payload is SeatStateChangedPayload =>
  isInteger(payload.seatNo) &&
  isEnumValue(payload.currentStatus, SEAT_STATUSES) &&
  isInteger(payload.stack) &&
  (payload.user === null ||
    (isRecord(payload.user) &&
      isString(payload.user.userId) &&
      isString(payload.user.displayName)));

const isPlayerDisconnectedPayload = (
  payload: Record<string, unknown>,
): payload is PlayerDisconnectedPayload =>
  isInteger(payload.seatNo) &&
  isEnumValue(payload.seatStatus, SEAT_STATUSES) &&
  isNonNegativeInteger(payload.disconnectStreak);

const isPlayerReconnectedPayload = (
  payload: Record<string, unknown>,
): payload is PlayerReconnectedPayload =>
  isInteger(payload.seatNo) &&
  isEnumValue(payload.restoredSeatStatus, SEAT_STATUSES) &&
  isNonNegativeInteger(payload.disconnectStreakResetTo);

const isDealInitPayload = (
  payload: Record<string, unknown>,
): payload is DealInitPayload => {
  const stakes = payload.stakes;
  return (
    isInteger(payload.handNo) &&
    isEnumValue(payload.gameType, GAME_TYPES) &&
    isInteger(payload.dealerSeatNo) &&
    isInteger(payload.mixIndex) &&
    isInteger(payload.handsSinceRotation) &&
    isRecord(stakes) &&
    isInteger(stakes.smallBet) &&
    isInteger(stakes.bigBet) &&
    isInteger(stakes.ante) &&
    isInteger(stakes.bringIn)
  );
};

const isPostAntePayload = (
  payload: Record<string, unknown>,
): payload is PostAntePayload =>
  isEnumValue(payload.street, STREETS) && isInteger(payload.potAfter);

const isDealCards3rdPayload = (
  payload: Record<string, unknown>,
): payload is DealCards3rdPayload => isInteger(payload.bringInSeatNo);

const isBringInPayload = (
  payload: Record<string, unknown>,
): payload is BringInPayload =>
  isEnumValue(payload.street, STREETS) &&
  isInteger(payload.seatNo) &&
  isInteger(payload.amount) &&
  isInteger(payload.potAfter) &&
  isNullableInteger(payload.nextToActSeatNo) &&
  isInteger(payload.stackAfter);

const isActionPayload = (
  payload: Record<string, unknown>,
): payload is ActionPayload =>
  isEnumValue(payload.street, STREETS) &&
  isInteger(payload.seatNo) &&
  isInteger(payload.potAfter) &&
  isNullableInteger(payload.nextToActSeatNo);

const isChipActionPayload = (
  payload: Record<string, unknown>,
): payload is ChipActionPayload => {
  const stackAfter = payload.stackAfter;
  const streetBetTo = payload.streetBetTo;
  const raiseCount = payload.raiseCount;
  return (
    isActionPayload(payload) &&
    isInteger(stackAfter) &&
    isInteger(streetBetTo) &&
    isInteger(raiseCount)
  );
};

const applyEventToTable = (
  table: TableDetail,
  event: TableEventMessage,
  currentUserId: string | null,
) => {
  const payload = event.payload;

  if (
    event.eventName === TableEventName.SeatStateChangedEvent &&
    isSeatStateChangedPayload(payload)
  ) {
    const user = payload.user;
    return updateSeat(table, payload.seatNo, (seat) => {
      const userId = user?.userId ?? null;
      const displayName = user?.displayName ?? null;
      return {
        ...seat,
        status: payload.currentStatus,
        userId,
        displayName,
        stack: payload.stack,
        isYou:
          userId !== null && currentUserId !== null && userId === currentUserId,
        joinedAt:
          payload.currentStatus === SeatStatus.EMPTY
            ? null
            : userId !== null && seat.userId === userId
              ? seat.joinedAt
              : event.occurredAt,
      };
    });
  }

  if (
    event.eventName === TableEventName.PlayerDisconnectedEvent &&
    isPlayerDisconnectedPayload(payload)
  ) {
    return updateSeat(table, payload.seatNo, (seat) => ({
      ...seat,
      status: payload.seatStatus,
      disconnectStreak: payload.disconnectStreak,
    }));
  }

  if (
    event.eventName === TableEventName.PlayerReconnectedEvent &&
    isPlayerReconnectedPayload(payload)
  ) {
    return updateSeat(table, payload.seatNo, (seat) => ({
      ...seat,
      status: payload.restoredSeatStatus,
      disconnectStreak: payload.disconnectStreakResetTo,
    }));
  }

  if (
    event.eventName === TableEventName.DealInitEvent &&
    isDealInitPayload(payload)
  ) {
    if (!event.handId) {
      return table;
    }

    let next: TableDetail = {
      ...table,
      status: TableStatus.DEALING,
      gameType: payload.gameType,
      dealerSeatNo: payload.dealerSeatNo,
      mixIndex: payload.mixIndex,
      handsSinceRotation: payload.handsSinceRotation,
      stakes: {
        ...table.stakes,
        smallBet: payload.stakes.smallBet,
        bigBet: payload.stakes.bigBet,
        ante: payload.stakes.ante,
        bringIn: payload.stakes.bringIn,
        display: formatStakesDisplay(
          payload.stakes.smallBet,
          payload.stakes.bigBet,
        ),
      },
      currentHand: {
        handId: event.handId,
        handNo: payload.handNo,
        status: HandStatus.IN_PROGRESS,
        street: Street.THIRD,
        potTotal: 0,
        streetBetTo: 0,
        raiseCount: 0,
        toActSeatNo: null,
        actionDeadlineAt: null,
      },
    };

    if (Array.isArray(payload.participants)) {
      for (const participant of payload.participants) {
        if (
          isRecord(participant) &&
          isInteger(participant.seatNo) &&
          isInteger(participant.startStack)
        ) {
          next = updateSeat(next, participant.seatNo, (seat) => ({
            ...seat,
            status: SeatStatus.ACTIVE,
            stack: participant.startStack,
          }));
        }
      }
    }

    return next;
  }

  if (
    event.eventName === TableEventName.PostAnteEvent &&
    isPostAntePayload(payload)
  ) {
    let next = mergeCurrentHand(
      {
        ...table,
        status: TableStatus.BETTING,
      },
      {
        street: payload.street,
        potTotal: payload.potAfter,
      },
      event.handId,
    );

    if (Array.isArray(payload.contributions)) {
      for (const contribution of payload.contributions) {
        if (
          isRecord(contribution) &&
          isInteger(contribution.seatNo) &&
          isInteger(contribution.stackAfter)
        ) {
          next = updateSeat(next, contribution.seatNo, (seat) => ({
            ...seat,
            stack: contribution.stackAfter,
          }));
        }
      }
    }

    return next;
  }

  if (
    event.eventName === TableEventName.DealCards3rdEvent &&
    isDealCards3rdPayload(payload)
  ) {
    return mergeCurrentHand(
      {
        ...table,
        status: TableStatus.BETTING,
      },
      {
        street: Street.THIRD,
        toActSeatNo: payload.bringInSeatNo,
      },
      event.handId,
    );
  }

  if (
    event.eventName === TableEventName.BringInEvent &&
    isBringInPayload(payload)
  ) {
    return updateSeat(
      mergeCurrentHand(
        {
          ...table,
          status: TableStatus.BETTING,
        },
        {
          street: payload.street,
          potTotal: payload.potAfter,
          streetBetTo: payload.amount,
          raiseCount: 0,
          toActSeatNo: payload.nextToActSeatNo,
        },
        event.handId,
      ),
      payload.seatNo,
      (seat) => ({
        ...seat,
        stack: payload.stackAfter,
      }),
    );
  }

  if (
    event.eventName === TableEventName.CallEvent &&
    isChipActionPayload(payload)
  ) {
    return updateSeat(
      mergeCurrentHand(
        {
          ...table,
          status: TableStatus.BETTING,
        },
        {
          street: payload.street,
          potTotal: payload.potAfter,
          streetBetTo: payload.streetBetTo,
          raiseCount: payload.raiseCount,
          toActSeatNo: payload.nextToActSeatNo,
        },
        event.handId,
      ),
      payload.seatNo,
      (seat) => ({
        ...seat,
        stack: payload.stackAfter,
      }),
    );
  }

  if (
    event.eventName === TableEventName.BetEvent &&
    isChipActionPayload(payload)
  ) {
    return updateSeat(
      mergeCurrentHand(
        {
          ...table,
          status: TableStatus.BETTING,
        },
        {
          street: payload.street,
          potTotal: payload.potAfter,
          streetBetTo: payload.streetBetTo,
          raiseCount: payload.raiseCount,
          toActSeatNo: payload.nextToActSeatNo,
        },
        event.handId,
      ),
      payload.seatNo,
      (seat) => ({
        ...seat,
        stack: payload.stackAfter,
      }),
    );
  }

  if (
    event.eventName === TableEventName.CompleteEvent &&
    isChipActionPayload(payload)
  ) {
    return updateSeat(
      mergeCurrentHand(
        {
          ...table,
          status: TableStatus.BETTING,
        },
        {
          street: payload.street,
          potTotal: payload.potAfter,
          streetBetTo: payload.streetBetTo,
          raiseCount: payload.raiseCount,
          toActSeatNo: payload.nextToActSeatNo,
        },
        event.handId,
      ),
      payload.seatNo,
      (seat) => ({
        ...seat,
        stack: payload.stackAfter,
      }),
    );
  }

  if (
    event.eventName === TableEventName.RaiseEvent &&
    isChipActionPayload(payload)
  ) {
    return updateSeat(
      mergeCurrentHand(
        {
          ...table,
          status: TableStatus.BETTING,
        },
        {
          street: payload.street,
          potTotal: payload.potAfter,
          streetBetTo: payload.streetBetTo,
          raiseCount: payload.raiseCount,
          toActSeatNo: payload.nextToActSeatNo,
        },
        event.handId,
      ),
      payload.seatNo,
      (seat) => ({
        ...seat,
        stack: payload.stackAfter,
      }),
    );
  }

  if (
    event.eventName === TableEventName.CheckEvent &&
    isActionPayload(payload)
  ) {
    return mergeCurrentHand(
      {
        ...table,
        status: TableStatus.BETTING,
      },
      {
        street: payload.street,
        potTotal: payload.potAfter,
        toActSeatNo: payload.nextToActSeatNo,
      },
      event.handId,
    );
  }

  if (
    event.eventName === TableEventName.FoldEvent &&
    isActionPayload(payload)
  ) {
    return mergeCurrentHand(
      {
        ...table,
        status: TableStatus.BETTING,
      },
      {
        street: payload.street,
        potTotal: payload.potAfter,
        toActSeatNo: payload.nextToActSeatNo,
      },
      event.handId,
    );
  }

  return table;
};

const cloneSnapshot = (state: TableStoreState): TableStoreSnapshot => ({
  ...state,
  table: {
    ...state.table,
    stakes: { ...state.table.stakes },
    seats: state.table.seats.map((seat) => ({ ...seat })),
    currentHand: state.table.currentHand
      ? { ...state.table.currentHand }
      : null,
  },
});

export type TableStore = {
  start: () => void;
  stop: () => void;
  getSnapshot: () => TableStoreSnapshot;
  subscribe: (listener: TableStoreListener) => () => void;
  replaceTable: (table: TableDetail) => void;
  sendSeatCommand: (
    commandType: SeatCommandType,
    params?: { buyIn?: number },
  ) => boolean;
  sendActionCommand: (action: TableCommandAction) => boolean;
  requestResume: () => boolean;
};

const shouldLogDealEvents = import.meta.env.MODE === "development";

export const createTableStore = (options: TableStoreOptions): TableStore => {
  const reconnectDelayMs =
    options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
  const resumeAckTimeoutMs =
    options.resumeAckTimeoutMs ?? DEFAULT_RESUME_ACK_TIMEOUT_MS;
  const wsUrl = options.wsUrl ?? resolveWsUrl();
  const createWebSocket =
    options.createWebSocket ??
    ((url) => new WebSocket(url) as unknown as WebSocketLike);
  const randomUUID = options.randomUUID ?? (() => crypto.randomUUID());
  const now = options.now ?? (() => new Date());
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
  const explicitCurrentUserId = options.currentUserId ?? null;
  let inferredCurrentUserId =
    explicitCurrentUserId ?? resolveCurrentUserId(options.initialTable);

  let state: TableStoreState = {
    table: normalizeTableForCurrentUser(
      options.initialTable,
      inferredCurrentUserId,
    ),
    tableSeq: 0,
    connectionStatus: TableStoreConnectionStatus.IDLE,
    syncStatus: TableStoreSyncStatus.IDLE,
    lastErrorCode: null,
    lastErrorMessage: null,
  };

  const listeners = new Set<TableStoreListener>();
  let socket: WebSocketLike | null = null;
  let reconnectTimerId: TimerId | null = null;
  let resumeTimerId: TimerId | null = null;
  let stopped = true;
  let resumeInFlight = false;

  const notify = () => {
    const snapshot = cloneSnapshot(state);
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  const patchState = (patch: Partial<TableStoreState>) => {
    state = {
      ...state,
      ...patch,
    };
    notify();
  };

  const clearReconnectTimer = () => {
    if (reconnectTimerId === null) {
      return;
    }
    clearTimeoutFn(reconnectTimerId);
    reconnectTimerId = null;
  };

  const clearResumeTimer = () => {
    if (resumeTimerId === null) {
      return;
    }
    clearTimeoutFn(resumeTimerId);
    resumeTimerId = null;
  };

  const markResumeInFlight = () => {
    resumeInFlight = true;
    clearResumeTimer();
    resumeTimerId = setTimeoutFn(() => {
      if (!resumeInFlight) {
        return;
      }
      resumeInFlight = false;
      patchState({
        syncStatus: TableStoreSyncStatus.IN_SYNC,
      });
    }, resumeAckTimeoutMs);
  };

  const clearResumeInFlight = () => {
    resumeInFlight = false;
    clearResumeTimer();
  };

  const sendCommand = (
    type: string,
    payload: Record<string, unknown>,
    options?: { markResync?: boolean },
  ) => {
    if (!socket || socket.readyState !== OPEN_READY_STATE) {
      patchState({
        lastErrorCode: null,
        lastErrorMessage: "WebSocket未接続のためコマンドを送信できません。",
      });
      return false;
    }

    socket.send(
      JSON.stringify({
        type,
        requestId: randomUUID(),
        sentAt: now().toISOString(),
        payload,
      }),
    );

    if (options?.markResync === true) {
      markResumeInFlight();
      patchState({
        syncStatus: TableStoreSyncStatus.RESYNCING,
      });
    }

    return true;
  };

  const requestResume = () =>
    sendCommand(
      RealtimeTableCommandType.RESUME,
      {
        tableId: options.tableId,
        lastTableSeq: state.tableSeq,
      },
      { markResync: true },
    );

  const scheduleReconnect = () => {
    if (stopped || reconnectTimerId !== null) {
      return;
    }
    reconnectTimerId = setTimeoutFn(() => {
      reconnectTimerId = null;
      connect();
    }, reconnectDelayMs);
  };

  const handleTableEvent = (message: TableEventMessage) => {
    if (message.tableId !== options.tableId) {
      return;
    }

    if (message.tableSeq <= state.tableSeq) {
      return;
    }

    const expectedSeq = state.tableSeq + 1;
    if (message.tableSeq !== expectedSeq) {
      patchState({
        syncStatus: TableStoreSyncStatus.RESYNCING,
      });
      if (!resumeInFlight) {
        void requestResume();
      }
      return;
    }

    clearResumeInFlight();

    if (
      shouldLogDealEvents &&
      (message.eventName === TableEventName.DealCards3rdEvent ||
        message.eventName === TableEventName.DealCardEvent)
    ) {
      console.info("[table-store] deal-event", {
        tableId: message.tableId,
        tableSeq: message.tableSeq,
        handId: message.handId,
        handSeq: message.handSeq,
        eventName: message.eventName,
        payload: message.payload,
      });
    }

    patchState({
      table: applyEventToTable(state.table, message, inferredCurrentUserId),
      tableSeq: message.tableSeq,
      syncStatus: TableStoreSyncStatus.IN_SYNC,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
  };

  const handleSnapshot = (message: TableSnapshotMessage) => {
    if (message.tableId !== options.tableId) {
      return;
    }

    clearResumeInFlight();
    patchState({
      table: mapSnapshotTable(state.table, message, inferredCurrentUserId),
      tableSeq: message.tableSeq,
      syncStatus: TableStoreSyncStatus.IN_SYNC,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
  };

  const handleError = (message: TableErrorMessage) => {
    patchState({
      lastErrorCode: message.code,
      lastErrorMessage: message.message,
    });
  };

  const handleMessage = (raw: string) => {
    const parsed = parseJsonMessage(raw);
    if (!parsed) {
      patchState({
        lastErrorCode: null,
        lastErrorMessage: "WebSocketメッセージの形式が不正です。",
      });
      return;
    }

    if (parsed.type === "table.event") {
      handleTableEvent(parsed);
      return;
    }
    if (parsed.type === "table.snapshot") {
      handleSnapshot(parsed);
      return;
    }
    if (parsed.type === "table.error") {
      handleError(parsed);
    }
  };

  const attachSocket = (nextSocket: WebSocketLike) => {
    socket = nextSocket;

    nextSocket.onopen = () => {
      if (socket !== nextSocket || stopped) {
        return;
      }
      patchState({
        connectionStatus: TableStoreConnectionStatus.OPEN,
      });
      void requestResume();
    };

    nextSocket.onmessage = (event) => {
      if (socket !== nextSocket || stopped) {
        return;
      }
      const text = resolveMessageText(event.data);
      if (text === null) {
        patchState({
          lastErrorCode: null,
          lastErrorMessage: "WebSocketメッセージを文字列として解釈できません。",
        });
        return;
      }
      handleMessage(text);
    };

    nextSocket.onerror = () => {
      if (socket !== nextSocket || stopped) {
        return;
      }
      patchState({
        lastErrorCode: null,
        lastErrorMessage: "WebSocket通信エラーが発生しました。",
      });
    };

    nextSocket.onclose = () => {
      if (socket !== nextSocket) {
        return;
      }
      socket = null;
      clearResumeInFlight();

      if (stopped) {
        patchState({
          connectionStatus: TableStoreConnectionStatus.CLOSED,
          syncStatus: TableStoreSyncStatus.IDLE,
        });
        return;
      }

      patchState({
        connectionStatus: TableStoreConnectionStatus.RECONNECTING,
      });
      scheduleReconnect();
    };
  };

  const connect = () => {
    clearReconnectTimer();
    if (stopped) {
      return;
    }
    patchState({
      connectionStatus:
        state.connectionStatus === TableStoreConnectionStatus.IDLE
          ? TableStoreConnectionStatus.CONNECTING
          : TableStoreConnectionStatus.RECONNECTING,
    });

    attachSocket(createWebSocket(wsUrl));
  };

  const start = () => {
    if (socket || !stopped) {
      return;
    }
    stopped = false;
    connect();
  };

  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    clearReconnectTimer();
    clearResumeInFlight();

    const current = socket;
    socket = null;
    if (current) {
      current.onopen = null;
      current.onclose = null;
      current.onerror = null;
      current.onmessage = null;
      current.close();
    }

    patchState({
      connectionStatus: TableStoreConnectionStatus.CLOSED,
      syncStatus: TableStoreSyncStatus.IDLE,
    });
  };

  const replaceTable = (table: TableDetail) => {
    if (explicitCurrentUserId === null) {
      inferredCurrentUserId = resolveCurrentUserId(table);
    }
    patchState({
      table: normalizeTableForCurrentUser(table, inferredCurrentUserId),
    });
  };

  const sendSeatCommand = (
    commandType: SeatCommandType,
    params?: { buyIn?: number },
  ) => {
    if (commandType === RealtimeTableCommandType.JOIN) {
      const buyIn = params?.buyIn;
      if (!isNonNegativeInteger(buyIn) || buyIn <= 0) {
        patchState({
          lastErrorCode: null,
          lastErrorMessage: "JOIN は buyIn を正の整数で指定してください。",
        });
        return false;
      }
      return sendCommand(commandType, {
        tableId: options.tableId,
        buyIn,
      });
    }

    return sendCommand(commandType, {
      tableId: options.tableId,
    });
  };

  const sendActionCommand = (action: TableCommandAction) => {
    if (!isEnumValue(action, MVP_TABLE_ACT_ACTIONS)) {
      patchState({
        lastErrorCode: null,
        lastErrorMessage:
          "MVP未対応のアクションです。FOLD/CHECK/CALL/BET/COMPLETE/RAISE/BRING_IN を選択してください。",
      });
      return false;
    }

    return sendCommand(RealtimeTableCommandType.ACT, {
      tableId: options.tableId,
      action,
    });
  };

  const getSnapshot = () => cloneSnapshot(state);

  const subscribe = (listener: TableStoreListener) => {
    listeners.add(listener);
    listener(getSnapshot());
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    start,
    stop,
    getSnapshot,
    subscribe,
    replaceTable,
    sendSeatCommand,
    sendActionCommand,
    requestResume,
  };
};
