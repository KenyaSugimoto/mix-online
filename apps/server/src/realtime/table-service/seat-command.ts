import {
  RealtimeErrorCode,
  type RealtimeTableCommand,
  RealtimeTableCommandType,
  SeatStateChangeAppliesFrom,
  SeatStateChangeReason,
  SeatStatus,
  TableBuyIn,
  TableEventName,
  TableStatus,
} from "@mix-online/shared";
import type { SessionUser } from "../../auth-session";
import { applyActCommand } from "./act-command";
import { canStartHand } from "./turn";
import type {
  ApplyCommandFailure,
  ApplyCommandResult,
  TableState,
} from "./types";

const fail = (
  code: RealtimeErrorCode,
  message: string,
  requestId: string,
  tableId: string | null,
): ApplyCommandFailure => {
  return {
    ok: false,
    error: {
      code,
      message,
      requestId,
      tableId,
    },
  };
};

const isHandInProgress = (table: TableState) =>
  table.currentHand !== null &&
  (table.status === TableStatus.DEALING ||
    table.status === TableStatus.BETTING ||
    table.status === TableStatus.SHOWDOWN);

export const applyCommand = (params: {
  table: TableState;
  user: SessionUser;
  command: RealtimeTableCommand;
  currentBalance: number;
  occurredAt: Date;
}): ApplyCommandResult => {
  const seat = params.table.seats.find(
    (entry) => entry.userId === params.user.userId,
  );

  if (params.command.type === RealtimeTableCommandType.JOIN) {
    if (seat) {
      return fail(
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
      return fail(
        RealtimeErrorCode.BUYIN_OUT_OF_RANGE,
        `buyIn は ${TableBuyIn.MIN}〜${TableBuyIn.MAX} の整数で指定してください。`,
        params.command.requestId,
        params.table.tableId,
      );
    }

    if (params.currentBalance < buyIn) {
      return fail(
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
      return fail(
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
    emptySeat.statusBeforeDisconnect = null;
    emptySeat.userId = params.user.userId;
    emptySeat.displayName = params.user.displayName;
    emptySeat.stack = buyIn;
    emptySeat.disconnectStreak = 0;
    emptySeat.joinedAt = params.occurredAt.toISOString();

    return {
      ok: true,
      nextWalletBalance: params.currentBalance - buyIn,
      startHand: canStartHand(params.table),
      events: [
        {
          handId: null,
          eventName: TableEventName.SeatStateChangedEvent,
          payload: {
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
        },
      ],
    };
  }

  if (!seat) {
    return fail(
      RealtimeErrorCode.INVALID_ACTION,
      "卓に着席していないため操作できません。",
      params.command.requestId,
      params.table.tableId,
    );
  }

  if (params.command.type === RealtimeTableCommandType.SIT_OUT) {
    if (seat.status === SeatStatus.LEAVE_PENDING) {
      return {
        ok: true,
        nextWalletBalance: params.currentBalance,
        startHand: false,
        events: [],
      };
    }

    if (
      seat.status !== SeatStatus.ACTIVE &&
      seat.status !== SeatStatus.SEATED_WAIT_NEXT_HAND
    ) {
      return fail(
        RealtimeErrorCode.INVALID_ACTION,
        "現在の席状態では sitOut できません。",
        params.command.requestId,
        params.table.tableId,
      );
    }

    const previousStatus = seat.status;
    const nextStatus =
      seat.status === SeatStatus.ACTIVE && isHandInProgress(params.table)
        ? SeatStatus.LEAVE_PENDING
        : SeatStatus.SIT_OUT;
    seat.status = nextStatus;

    return {
      ok: true,
      nextWalletBalance: params.currentBalance,
      startHand: false,
      events: [
        {
          handId: null,
          eventName: TableEventName.SeatStateChangedEvent,
          payload: {
            seatNo: seat.seatNo,
            previousStatus,
            currentStatus: nextStatus,
            reason:
              nextStatus === SeatStatus.LEAVE_PENDING
                ? SeatStateChangeReason.LEAVE_PENDING
                : SeatStateChangeReason.SIT_OUT,
            user: {
              userId: params.user.userId,
              displayName: params.user.displayName,
            },
            stack: seat.stack,
            appliesFrom:
              nextStatus === SeatStatus.LEAVE_PENDING
                ? SeatStateChangeAppliesFrom.NEXT_HAND
                : SeatStateChangeAppliesFrom.IMMEDIATE,
          },
        },
      ],
    };
  }

  if (params.command.type === RealtimeTableCommandType.RETURN) {
    if (
      seat.status !== SeatStatus.SIT_OUT &&
      seat.status !== SeatStatus.LEAVE_PENDING
    ) {
      return fail(
        RealtimeErrorCode.INVALID_ACTION,
        "SIT_OUT / LEAVE_PENDING 状態以外では return できません。",
        params.command.requestId,
        params.table.tableId,
      );
    }

    const nextStatus =
      seat.status === SeatStatus.LEAVE_PENDING
        ? SeatStatus.ACTIVE
        : params.table.status === TableStatus.WAITING
          ? SeatStatus.ACTIVE
          : SeatStatus.SEATED_WAIT_NEXT_HAND;
    const previousStatus = seat.status;
    seat.status = nextStatus;
    const shouldStartHand =
      nextStatus === SeatStatus.ACTIVE && canStartHand(params.table);

    return {
      ok: true,
      nextWalletBalance: params.currentBalance,
      startHand: shouldStartHand,
      events: [
        {
          handId: null,
          eventName: TableEventName.SeatStateChangedEvent,
          payload: {
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
        },
      ],
    };
  }

  if (params.command.type === RealtimeTableCommandType.LEAVE) {
    const previousStatus = seat.status;
    const cashOut = seat.stack;
    seat.status = SeatStatus.EMPTY;
    seat.statusBeforeDisconnect = null;
    seat.userId = null;
    seat.displayName = null;
    seat.stack = 0;
    seat.disconnectStreak = 0;
    seat.joinedAt = null;

    return {
      ok: true,
      nextWalletBalance: params.currentBalance + cashOut,
      startHand: false,
      events: [
        {
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
        },
      ],
    };
  }

  if (params.command.type === RealtimeTableCommandType.ACT) {
    return applyActCommand({
      table: params.table,
      user: params.user,
      command: params.command,
      currentBalance: params.currentBalance,
      isAuto: false,
    });
  }

  return fail(
    RealtimeErrorCode.INVALID_ACTION,
    `${params.command.type} は未対応です。`,
    params.command.requestId,
    params.table.tableId,
  );
};
