import {
  RealtimeErrorCode,
  type RealtimeTableCommand,
  RealtimeTableCommandType,
  type RealtimeTableEventMessage,
  type RealtimeTableServiceError,
  type RealtimeTableServiceFailure,
  type RealtimeTableServiceResult,
  type RealtimeTableServiceSuccess,
  type RealtimeTableState,
  SeatStateChangeAppliesFrom,
  SeatStateChangeReason,
  SeatStatus,
  TableBuyIn,
  TableEventName,
  TableStatus,
} from "@mix-online/shared";
import type { SessionUser } from "../auth-session";
import {
  type TableActorRegistry,
  createTableActorRegistry,
} from "./table-actor";

type RealtimeTableServiceOptions = {
  actorRegistry?: TableActorRegistry;
};

type ApplyCommandSuccess = {
  ok: true;
  eventPayload: RealtimeTableEventMessage["payload"];
  nextWalletBalance: number;
};

type ApplyCommandFailure = {
  ok: false;
  error: RealtimeTableServiceError;
};

type ApplyCommandResult = ApplyCommandSuccess | ApplyCommandFailure;

const createDefaultTableState = (tableId: string): RealtimeTableState => ({
  tableId,
  status: TableStatus.WAITING,
  seats: Array.from({ length: 6 }, (_, index) => ({
    seatNo: index + 1,
    status: SeatStatus.EMPTY,
    userId: null,
    displayName: null,
    stack: 0,
    disconnectStreak: 0,
    joinedAt: null,
  })),
});

export class RealtimeTableService {
  private readonly actorRegistry: TableActorRegistry;
  private readonly tables = new Map<string, RealtimeTableState>();
  private readonly walletByUserId = new Map<string, number>();

  constructor(options: RealtimeTableServiceOptions = {}) {
    this.actorRegistry = options.actorRegistry ?? createTableActorRegistry();
  }

  async executeCommand(params: {
    command: RealtimeTableCommand;
    user: SessionUser;
    occurredAt: Date;
  }): Promise<RealtimeTableServiceResult> {
    const tableId = this.resolveTableId(params.command.payload);

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
    return actor.enqueue(({ allocateTableSeq }) => {
      const table = this.getOrCreateTable(tableId);
      const currentBalance = this.resolveWalletBalance(params.user);

      const outcome = this.applyCommand({
        table,
        user: params.user,
        command: params.command,
        currentBalance,
        occurredAt: params.occurredAt,
      });

      if (outcome.ok === false) {
        return outcome;
      }

      this.walletByUserId.set(params.user.userId, outcome.nextWalletBalance);
      const success: RealtimeTableServiceSuccess = {
        ok: true,
        tableId,
        event: {
          type: "table.event",
          tableId,
          tableSeq: allocateTableSeq(),
          handId: null,
          handSeq: null,
          occurredAt: params.occurredAt.toISOString(),
          eventName: TableEventName.SeatStateChangedEvent,
          payload: outcome.eventPayload,
        },
      };
      return success;
    });
  }

  private resolveTableId(payload: Record<string, unknown>): string | null {
    const raw = payload.tableId;
    if (typeof raw !== "string" || raw.length === 0) {
      return null;
    }
    return raw;
  }

  private getOrCreateTable(tableId: string): RealtimeTableState {
    const existing = this.tables.get(tableId);
    if (existing) {
      return existing;
    }

    const created = createDefaultTableState(tableId);
    this.tables.set(tableId, created);
    return created;
  }

  private resolveWalletBalance(user: SessionUser): number {
    return this.walletByUserId.get(user.userId) ?? user.walletBalance;
  }

  private applyCommand(params: {
    table: RealtimeTableState;
    user: SessionUser;
    command: RealtimeTableCommand;
    currentBalance: number;
    occurredAt: Date;
  }): ApplyCommandResult {
    const seat = params.table.seats.find(
      (entry) => entry.userId === params.user.userId,
    );

    if (params.command.type === RealtimeTableCommandType.JOIN) {
      if (seat) {
        return this.fail(
          RealtimeErrorCode.ALREADY_SEATED,
          "同卓に重複着席はできません。",
          params.command.requestId,
          params.table.tableId,
        );
      }

      const buyIn = params.command.payload.buyIn;
      if (
        typeof buyIn !== "number" ||
        !Number.isInteger(buyIn) ||
        buyIn < TableBuyIn.MIN ||
        buyIn > TableBuyIn.MAX
      ) {
        return this.fail(
          RealtimeErrorCode.BUYIN_OUT_OF_RANGE,
          `buyIn は ${TableBuyIn.MIN}〜${TableBuyIn.MAX} の整数で指定してください。`,
          params.command.requestId,
          params.table.tableId,
        );
      }

      if (params.currentBalance < buyIn) {
        return this.fail(
          RealtimeErrorCode.INSUFFICIENT_CHIPS,
          "ウォレット残高が不足しています。",
          params.command.requestId,
          params.table.tableId,
        );
      }

      const emptySeat = params.table.seats.find(
        (entry) => entry.status === SeatStatus.EMPTY,
      );

      if (!emptySeat) {
        return this.fail(
          RealtimeErrorCode.TABLE_FULL,
          "空席がないため着席できません。",
          params.command.requestId,
          params.table.tableId,
        );
      }

      const nextStatus =
        params.table.status === TableStatus.WAITING
          ? SeatStatus.ACTIVE
          : SeatStatus.SEATED_WAIT_NEXT_HAND;
      emptySeat.status = nextStatus;
      emptySeat.userId = params.user.userId;
      emptySeat.displayName = params.user.displayName;
      emptySeat.stack = buyIn;
      emptySeat.disconnectStreak = 0;
      emptySeat.joinedAt = params.occurredAt.toISOString();

      return {
        ok: true,
        nextWalletBalance: params.currentBalance - buyIn,
        eventPayload: {
          seatNo: emptySeat.seatNo,
          previousStatus: SeatStatus.EMPTY,
          currentStatus: emptySeat.status,
          reason: SeatStateChangeReason.JOIN,
          user: {
            userId: params.user.userId,
            displayName: params.user.displayName,
          },
          stack: emptySeat.stack,
          appliesFrom:
            nextStatus === SeatStatus.ACTIVE
              ? SeatStateChangeAppliesFrom.IMMEDIATE
              : SeatStateChangeAppliesFrom.NEXT_HAND,
        },
      };
    }

    if (!seat) {
      return this.fail(
        RealtimeErrorCode.INVALID_ACTION,
        "卓に着席していないため操作できません。",
        params.command.requestId,
        params.table.tableId,
      );
    }

    if (params.command.type === RealtimeTableCommandType.SIT_OUT) {
      if (
        seat.status !== SeatStatus.ACTIVE &&
        seat.status !== SeatStatus.SEATED_WAIT_NEXT_HAND
      ) {
        return this.fail(
          RealtimeErrorCode.INVALID_ACTION,
          "現在の席状態では sitOut できません。",
          params.command.requestId,
          params.table.tableId,
        );
      }

      const previousStatus = seat.status;
      seat.status = SeatStatus.SIT_OUT;

      return {
        ok: true,
        nextWalletBalance: params.currentBalance,
        eventPayload: {
          seatNo: seat.seatNo,
          previousStatus,
          currentStatus: seat.status,
          reason: SeatStateChangeReason.SIT_OUT,
          user: {
            userId: params.user.userId,
            displayName: params.user.displayName,
          },
          stack: seat.stack,
          appliesFrom: SeatStateChangeAppliesFrom.IMMEDIATE,
        },
      };
    }

    if (params.command.type === RealtimeTableCommandType.RETURN) {
      if (seat.status !== SeatStatus.SIT_OUT) {
        return this.fail(
          RealtimeErrorCode.INVALID_ACTION,
          "SIT_OUT 状態以外では return できません。",
          params.command.requestId,
          params.table.tableId,
        );
      }

      const nextStatus =
        params.table.status === TableStatus.WAITING
          ? SeatStatus.ACTIVE
          : SeatStatus.SEATED_WAIT_NEXT_HAND;
      const previousStatus = seat.status;
      seat.status = nextStatus;

      return {
        ok: true,
        nextWalletBalance: params.currentBalance,
        eventPayload: {
          seatNo: seat.seatNo,
          previousStatus,
          currentStatus: seat.status,
          reason: SeatStateChangeReason.RETURN,
          user: {
            userId: params.user.userId,
            displayName: params.user.displayName,
          },
          stack: seat.stack,
          appliesFrom:
            nextStatus === SeatStatus.ACTIVE
              ? SeatStateChangeAppliesFrom.IMMEDIATE
              : SeatStateChangeAppliesFrom.NEXT_HAND,
        },
      };
    }

    if (params.command.type === RealtimeTableCommandType.LEAVE) {
      // M3-03 時点ではハンド未実装のため即時離席のみ扱う。
      const previousStatus = seat.status;
      const cashOut = seat.stack;
      seat.status = SeatStatus.EMPTY;
      seat.userId = null;
      seat.displayName = null;
      seat.stack = 0;
      seat.disconnectStreak = 0;
      seat.joinedAt = null;

      return {
        ok: true,
        nextWalletBalance: params.currentBalance + cashOut,
        eventPayload: {
          seatNo: seat.seatNo,
          previousStatus,
          currentStatus: SeatStatus.EMPTY,
          reason: SeatStateChangeReason.LEAVE,
          user: null,
          stack: 0,
          appliesFrom: SeatStateChangeAppliesFrom.IMMEDIATE,
        },
      };
    }

    return this.fail(
      RealtimeErrorCode.INVALID_ACTION,
      `${params.command.type} は未対応です。`,
      params.command.requestId,
      params.table.tableId,
    );
  }

  private fail(
    code: RealtimeErrorCode,
    message: string,
    requestId: string,
    tableId: string | null,
  ): ApplyCommandFailure {
    const failure: ApplyCommandFailure = {
      ok: false,
      error: {
        code,
        message,
        requestId,
        tableId,
      },
    };
    return failure;
  }
}

export const createRealtimeTableService = (
  options: RealtimeTableServiceOptions = {},
): RealtimeTableService => new RealtimeTableService(options);
