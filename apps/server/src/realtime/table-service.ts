import { randomUUID } from "node:crypto";
import {
  RealtimeErrorCode,
  type RealtimeTableCommand,
  RealtimeTableCommandType,
  type RealtimeTableEventMessage,
  type RealtimeTableServiceFailure,
  type RealtimeTableServiceResult,
  type RealtimeTableServiceSuccess,
  SeatStateChangeAppliesFrom,
  SeatStateChangeReason,
  SeatStatus,
  SnapshotReason,
  Street,
  TableCommandAction,
  TableEventName,
  TableStatus,
} from "@mix-online/shared";
import type { SessionUser } from "../auth-session";
import {
  type TableActorRegistry,
  createTableActorRegistry,
} from "./table-actor";
import {
  applyActCommand,
  applyCommand,
  startNextHandAfterRevealWait,
  startThirdStreet,
} from "./table-service/gameplay";
import {
  createSnapshotMessage,
  getOrCreateTable,
  mapEvents,
  resolveTableIdFromPayload,
  resolveWalletBalance,
} from "./table-service/helpers";
import {
  TABLE_RESUME_RESULT_KIND,
  type TableResumeResult,
} from "./table-service/protocol";
import {
  cloneValue,
  createActorRegistrySeedFromHistory,
} from "./table-service/state";
import type {
  PendingEvent,
  RealtimeTableServiceRuntimeState,
  TableEventMessage,
  TableState,
} from "./table-service/types";

export type { RealtimeTableServiceRuntimeState, TableEventMessage };
export {
  TABLE_RESUME_RESULT_KIND,
  TABLE_SNAPSHOT_MESSAGE_TYPE,
} from "./table-service/protocol";
export type {
  TableResumeResult,
  TableSnapshotMessage,
} from "./table-service/protocol";

type RealtimeTableServiceOptions = {
  actorRegistry?: TableActorRegistry;
  retainedEventLimit?: number;
  initialState?: RealtimeTableServiceRuntimeState;
};

export class RealtimeTableService {
  private readonly actorRegistry: TableActorRegistry;
  private readonly retainedEventLimit: number;
  private readonly tables = new Map<string, TableState>();
  private readonly walletByUserId = new Map<string, number>();
  private readonly eventHistoryByTableId = new Map<
    string,
    RealtimeTableEventMessage[]
  >();

  constructor(options: RealtimeTableServiceOptions = {}) {
    const actorSeed = createActorRegistrySeedFromHistory(
      options.initialState?.eventHistoryByTableId ?? {},
    );
    this.actorRegistry =
      options.actorRegistry ?? createTableActorRegistry(actorSeed);
    this.retainedEventLimit = options.retainedEventLimit ?? 256;

    if (options.initialState) {
      this.restoreRuntimeState(options.initialState);
    }
  }

  async executeCommand(params: {
    command: RealtimeTableCommand;
    user: SessionUser;
    occurredAt: Date;
  }): Promise<RealtimeTableServiceResult> {
    const tableId = resolveTableIdFromPayload(params.command.payload);

    if (tableId === null) {
      const failure: RealtimeTableServiceFailure = {
        ok: false,
        error: {
          code: RealtimeErrorCode.INVALID_ACTION,
          message: "tableId は必須です。",
          tableId: null,
          requestId: params.command.requestId,
        },
      };
      return failure;
    }

    const actor = this.actorRegistry.getOrCreate(tableId);
    return actor.enqueue(({ allocateTableSeq, allocateHandSeq }) => {
      const table = getOrCreateTable(this.tables, tableId);
      const currentBalance = resolveWalletBalance(
        this.walletByUserId,
        params.user,
      );

      const outcome = applyCommand({
        table,
        user: params.user,
        command: params.command,
        currentBalance,
        occurredAt: params.occurredAt,
      });

      if (outcome.ok === false) {
        return outcome;
      }

      if (outcome.startHand) {
        outcome.events.push(...startThirdStreet(table));
      }

      this.walletByUserId.set(params.user.userId, outcome.nextWalletBalance);
      const success: RealtimeTableServiceSuccess = {
        ok: true,
        tableId,
        events: mapEvents({
          tableId,
          events: outcome.events,
          occurredAt: params.occurredAt,
          allocateTableSeq,
          allocateHandSeq,
          eventHistoryByTableId: this.eventHistoryByTableId,
          retainedEventLimit: this.retainedEventLimit,
        }),
      };
      return success;
    });
  }

  async handleDisconnect(params: {
    tableId: string;
    user: SessionUser;
    occurredAt: Date;
  }): Promise<RealtimeTableServiceResult> {
    const actor = this.actorRegistry.getOrCreate(params.tableId);
    return actor.enqueue(({ allocateTableSeq, allocateHandSeq }) => {
      const table = this.tables.get(params.tableId);
      if (!table) {
        return {
          ok: true,
          tableId: params.tableId,
          events: [],
        };
      }

      const seat = table.seats.find(
        (entry) => entry.userId === params.user.userId,
      );
      if (
        !seat ||
        seat.status === SeatStatus.EMPTY ||
        seat.status === SeatStatus.DISCONNECTED
      ) {
        return {
          ok: true,
          tableId: params.tableId,
          events: [],
        };
      }

      seat.statusBeforeDisconnect = seat.status;
      seat.status = SeatStatus.DISCONNECTED;
      seat.disconnectStreak += 1;

      const events: PendingEvent[] = [
        {
          handId: null,
          eventName: TableEventName.PlayerDisconnectedEvent,
          payload: {
            seatNo: seat.seatNo,
            userId: params.user.userId,
            displayName: seat.displayName ?? params.user.displayName,
            seatStatus: SeatStatus.DISCONNECTED,
            disconnectStreak: seat.disconnectStreak,
            willAutoLeave: seat.disconnectStreak >= 3,
          },
        },
      ];

      return {
        ok: true,
        tableId: params.tableId,
        events: mapEvents({
          tableId: params.tableId,
          events,
          occurredAt: params.occurredAt,
          allocateTableSeq,
          allocateHandSeq,
          eventHistoryByTableId: this.eventHistoryByTableId,
          retainedEventLimit: this.retainedEventLimit,
        }),
      };
    });
  }

  async handleReconnect(params: {
    tableId: string;
    user: SessionUser;
    occurredAt: Date;
  }): Promise<RealtimeTableServiceResult> {
    const actor = this.actorRegistry.getOrCreate(params.tableId);
    return actor.enqueue(({ allocateTableSeq, allocateHandSeq }) => {
      const table = this.tables.get(params.tableId);
      if (!table) {
        return {
          ok: true,
          tableId: params.tableId,
          events: [],
        };
      }

      const seat = table.seats.find(
        (entry) => entry.userId === params.user.userId,
      );
      if (!seat || seat.status !== SeatStatus.DISCONNECTED) {
        return {
          ok: true,
          tableId: params.tableId,
          events: [],
        };
      }

      const restoredSeatStatus =
        seat.statusBeforeDisconnect &&
        seat.statusBeforeDisconnect !== SeatStatus.EMPTY &&
        seat.statusBeforeDisconnect !== SeatStatus.DISCONNECTED
          ? seat.statusBeforeDisconnect
          : SeatStatus.ACTIVE;

      seat.status = restoredSeatStatus;
      seat.statusBeforeDisconnect = null;
      seat.disconnectStreak = 0;

      const events: PendingEvent[] = [
        {
          handId: null,
          eventName: TableEventName.PlayerReconnectedEvent,
          payload: {
            seatNo: seat.seatNo,
            userId: params.user.userId,
            displayName: seat.displayName ?? params.user.displayName,
            restoredSeatStatus,
            disconnectStreakResetTo: 0,
          },
        },
      ];

      return {
        ok: true,
        tableId: params.tableId,
        events: mapEvents({
          tableId: params.tableId,
          events,
          occurredAt: params.occurredAt,
          allocateTableSeq,
          allocateHandSeq,
          eventHistoryByTableId: this.eventHistoryByTableId,
          retainedEventLimit: this.retainedEventLimit,
        }),
      };
    });
  }

  async executeAutoAction(params: {
    tableId: string;
    seatNo: number;
    occurredAt: Date;
  }): Promise<RealtimeTableServiceResult> {
    const actor = this.actorRegistry.getOrCreate(params.tableId);
    return actor.enqueue(({ allocateTableSeq, allocateHandSeq }) => {
      const table = this.tables.get(params.tableId);
      if (
        !table ||
        !table.currentHand ||
        table.status !== TableStatus.BETTING
      ) {
        return {
          ok: true,
          tableId: params.tableId,
          events: [],
        };
      }

      const hand = table.currentHand;
      if (hand.toActSeatNo !== params.seatNo) {
        return {
          ok: true,
          tableId: params.tableId,
          events: [],
        };
      }

      const seat = table.seats.find((entry) => entry.seatNo === params.seatNo);
      const player = hand.players.find(
        (entry) => entry.seatNo === params.seatNo,
      );
      if (!seat || !seat.userId || !player) {
        return {
          ok: true,
          tableId: params.tableId,
          events: [],
        };
      }

      const autoUserId = seat.userId;
      const toCall = Math.max(0, hand.streetBetTo - player.streetContribution);
      const action: Extract<
        RealtimeTableCommand,
        { type: typeof RealtimeTableCommandType.ACT }
      >["payload"]["action"] =
        hand.street === Street.THIRD && hand.streetBetTo === 0
          ? TableCommandAction.BRING_IN
          : toCall > 0
            ? TableCommandAction.FOLD
            : TableCommandAction.CHECK;
      const autoCommand: Extract<
        RealtimeTableCommand,
        { type: typeof RealtimeTableCommandType.ACT }
      > = {
        type: RealtimeTableCommandType.ACT,
        requestId: randomUUID(),
        sentAt: params.occurredAt.toISOString(),
        payload: {
          tableId: params.tableId,
          action,
        },
      };

      const walletBalance = this.walletByUserId.get(seat.userId) ?? 0;
      const applied = applyActCommand({
        table,
        user: {
          userId: seat.userId,
          displayName: seat.displayName ?? "Disconnected",
          walletBalance,
        },
        command: autoCommand,
        currentBalance: walletBalance,
        isAuto: true,
      });
      if (applied.ok === false) {
        return {
          ok: true,
          tableId: params.tableId,
          events: [],
        };
      }

      const events = [...applied.events];
      let nextWalletBalance = walletBalance;
      if (
        seat.status === SeatStatus.DISCONNECTED &&
        seat.disconnectStreak >= 3
      ) {
        const previousStatus = seat.status;
        const cashOut = seat.stack;
        nextWalletBalance += cashOut;
        seat.status = SeatStatus.EMPTY;
        seat.statusBeforeDisconnect = null;
        seat.userId = null;
        seat.displayName = null;
        seat.stack = 0;
        seat.disconnectStreak = 0;
        seat.joinedAt = null;

        events.push({
          handId: null,
          eventName: TableEventName.SeatStateChangedEvent,
          payload: {
            seatNo: seat.seatNo,
            previousStatus,
            currentStatus: SeatStatus.EMPTY,
            reason: SeatStateChangeReason.LEAVE,
            user: null,
            stack: 0,
            appliesFrom: SeatStateChangeAppliesFrom.IMMEDIATE,
          },
        });
      }

      this.walletByUserId.set(autoUserId, nextWalletBalance);

      return {
        ok: true,
        tableId: params.tableId,
        events: mapEvents({
          tableId: params.tableId,
          events,
          occurredAt: params.occurredAt,
          allocateTableSeq,
          allocateHandSeq,
          eventHistoryByTableId: this.eventHistoryByTableId,
          retainedEventLimit: this.retainedEventLimit,
        }),
      };
    });
  }

  async executeRevealWaitTimeout(params: {
    tableId: string;
    occurredAt: Date;
  }): Promise<RealtimeTableServiceResult> {
    const actor = this.actorRegistry.getOrCreate(params.tableId);
    return actor.enqueue(({ allocateTableSeq, allocateHandSeq }) => {
      const table = this.tables.get(params.tableId);
      if (!table) {
        return {
          ok: true,
          tableId: params.tableId,
          events: [],
        };
      }

      const events = startNextHandAfterRevealWait(table);
      if (events.length === 0) {
        return {
          ok: true,
          tableId: params.tableId,
          events: [],
        };
      }

      return {
        ok: true,
        tableId: params.tableId,
        events: mapEvents({
          tableId: params.tableId,
          events,
          occurredAt: params.occurredAt,
          allocateTableSeq,
          allocateHandSeq,
          eventHistoryByTableId: this.eventHistoryByTableId,
          retainedEventLimit: this.retainedEventLimit,
        }),
      };
    });
  }

  getNextToActSeatNo(tableId: string): number | null {
    const table = this.tables.get(tableId);
    return table?.currentHand?.toActSeatNo ?? null;
  }

  hasPendingRevealWait(tableId: string): boolean {
    const table = this.tables.get(tableId);
    if (!table) {
      return false;
    }

    return (
      table.pendingNextHandStart &&
      table.status === TableStatus.HAND_END &&
      table.currentHand !== null
    );
  }

  getSeatNosForUser(tableId: string, userId: string): number[] {
    const table = this.tables.get(tableId);
    if (!table) {
      return [];
    }
    return table.seats
      .filter((seat) => seat.userId === userId)
      .map((seat) => seat.seatNo);
  }

  listPendingActionTableIds(): string[] {
    return [...this.tables.values()]
      .filter(
        (table) =>
          table.status === TableStatus.BETTING &&
          table.currentHand?.toActSeatNo !== null,
      )
      .map((table) => table.tableId);
  }

  listPendingRevealWaitTableIds(): string[] {
    return [...this.tables.values()]
      .filter(
        (table) =>
          table.pendingNextHandStart &&
          table.status === TableStatus.HAND_END &&
          table.currentHand !== null,
      )
      .map((table) => table.tableId);
  }

  exportRuntimeState(): RealtimeTableServiceRuntimeState {
    const tables = Object.fromEntries(
      [...this.tables.entries()].map(([tableId, table]) => [
        tableId,
        cloneValue(table),
      ]),
    );
    const walletByUserId = Object.fromEntries(this.walletByUserId.entries());
    const eventHistoryByTableId = Object.fromEntries(
      [...this.eventHistoryByTableId.entries()].map(([tableId, events]) => [
        tableId,
        cloneValue(events),
      ]),
    );

    return {
      tables,
      walletByUserId,
      eventHistoryByTableId,
    };
  }

  private restoreRuntimeState(state: RealtimeTableServiceRuntimeState): void {
    this.tables.clear();
    for (const [tableId, table] of Object.entries(state.tables)) {
      this.tables.set(tableId, cloneValue(table));
    }

    this.walletByUserId.clear();
    for (const [userId, balance] of Object.entries(state.walletByUserId)) {
      this.walletByUserId.set(userId, balance);
    }

    this.eventHistoryByTableId.clear();
    for (const [tableId, events] of Object.entries(
      state.eventHistoryByTableId,
    )) {
      this.eventHistoryByTableId.set(tableId, cloneValue(events));
    }
  }

  async resumeFrom(params: {
    tableId: string;
    lastTableSeq: number;
    occurredAt: Date;
  }): Promise<TableResumeResult> {
    const actor = this.actorRegistry.getOrCreate(params.tableId);
    return actor.enqueue(() => {
      const history = this.eventHistoryByTableId.get(params.tableId) ?? [];
      const latestSeq = history[history.length - 1]?.tableSeq ?? 0;
      const earliestSeq = history[0]?.tableSeq ?? latestSeq + 1;

      if (params.lastTableSeq >= latestSeq) {
        return {
          kind: TABLE_RESUME_RESULT_KIND.EVENTS,
          events: [],
        };
      }

      if (history.length === 0 || params.lastTableSeq < earliestSeq - 1) {
        return {
          kind: TABLE_RESUME_RESULT_KIND.SNAPSHOT,
          snapshot: createSnapshotMessage({
            tables: this.tables,
            tableId: params.tableId,
            tableSeq: latestSeq,
            occurredAt: params.occurredAt,
            reason: SnapshotReason.OUT_OF_RANGE,
          }),
        };
      }

      return {
        kind: TABLE_RESUME_RESULT_KIND.EVENTS,
        events: history.filter((event) => event.tableSeq > params.lastTableSeq),
      };
    });
  }
}

export const createRealtimeTableService = (
  options: RealtimeTableServiceOptions = {},
): RealtimeTableService => new RealtimeTableService(options);
