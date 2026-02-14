import {
  RealtimeErrorCode,
  type RealtimeTableCommand,
  type RealtimeTableCommandType,
  Street,
  TableCommandAction,
  TableEventName,
  TableStatus,
} from "@mix-online/shared";
import type { SessionUser } from "../../auth-session";
import { progressHandAfterAction } from "./hand";
import { resolveNextToAct } from "./turn";
import type {
  ApplyCommandFailure,
  ApplyCommandResult,
  PendingEvent,
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

export const applyActCommand = (params: {
  table: TableState;
  user: SessionUser;
  command: Extract<
    RealtimeTableCommand,
    { type: typeof RealtimeTableCommandType.ACT }
  >;
  currentBalance: number;
  isAuto: boolean;
}): ApplyCommandResult => {
  const hand = params.table.currentHand;
  if (!hand || params.table.status !== TableStatus.BETTING) {
    return fail(
      RealtimeErrorCode.INVALID_ACTION,
      "現在アクション可能なハンドはありません。",
      params.command.requestId,
      params.table.tableId,
    );
  }

  const seat = params.table.seats.find(
    (entry) => entry.userId === params.user.userId,
  );
  if (!seat) {
    return fail(
      RealtimeErrorCode.INVALID_ACTION,
      "卓に着席していないためアクションできません。",
      params.command.requestId,
      params.table.tableId,
    );
  }

  const player = hand.players.find((entry) => entry.seatNo === seat.seatNo);
  if (!player || !player.inHand || player.allIn) {
    return fail(
      RealtimeErrorCode.INVALID_ACTION,
      "現在の状態ではアクションできません。",
      params.command.requestId,
      params.table.tableId,
    );
  }

  if (hand.toActSeatNo !== seat.seatNo) {
    return fail(
      RealtimeErrorCode.NOT_YOUR_TURN,
      "現在あなたの手番ではありません。",
      params.command.requestId,
      params.table.tableId,
    );
  }

  const action = params.command.payload.action;
  if (typeof action !== "string") {
    return fail(
      RealtimeErrorCode.INVALID_ACTION,
      "action は必須です。",
      params.command.requestId,
      params.table.tableId,
    );
  }

  const toCall = Math.max(0, hand.streetBetTo - player.streetContribution);
  let amount = 0;
  let eventName:
    | typeof TableEventName.CallEvent
    | typeof TableEventName.CheckEvent
    | typeof TableEventName.FoldEvent
    | typeof TableEventName.CompleteEvent
    | typeof TableEventName.RaiseEvent;

  if (action === TableCommandAction.CHECK) {
    if (toCall > 0) {
      return fail(
        RealtimeErrorCode.INVALID_ACTION,
        "toCall がある状態では CHECK できません。",
        params.command.requestId,
        params.table.tableId,
      );
    }

    player.actedThisRound = true;
    eventName = TableEventName.CheckEvent;
  } else if (action === TableCommandAction.FOLD) {
    player.inHand = false;
    player.actedThisRound = true;
    eventName = TableEventName.FoldEvent;
  } else if (action === TableCommandAction.CALL) {
    amount = Math.min(toCall, seat.stack);
    seat.stack -= amount;
    player.totalContribution += amount;
    player.streetContribution += amount;
    if (seat.stack === 0) {
      player.allIn = true;
    }
    hand.potTotal += amount;
    player.actedThisRound = true;
    eventName = TableEventName.CallEvent;
  } else if (action === TableCommandAction.COMPLETE) {
    if (
      hand.streetBetTo >= params.table.smallBet ||
      hand.street !== Street.THIRD
    ) {
      return fail(
        RealtimeErrorCode.INVALID_ACTION,
        "現在の局面では COMPLETE できません。",
        params.command.requestId,
        params.table.tableId,
      );
    }

    const targetBet = params.table.smallBet;
    amount = Math.min(
      Math.max(0, targetBet - player.streetContribution),
      seat.stack,
    );
    seat.stack -= amount;
    player.totalContribution += amount;
    player.streetContribution += amount;
    if (seat.stack === 0) {
      player.allIn = true;
    }
    hand.potTotal += amount;
    hand.streetBetTo = Math.max(hand.streetBetTo, player.streetContribution);
    hand.raiseCount = 0;
    for (const candidate of hand.players) {
      candidate.actedThisRound = candidate.seatNo === player.seatNo;
    }
    eventName = TableEventName.CompleteEvent;
  } else if (action === TableCommandAction.RAISE) {
    if (hand.street !== Street.THIRD && hand.street !== Street.FOURTH) {
      // M3-05 時点では third/fourth 基本ベットのみサポートし、詳細街進行はM3-06以降で拡張する。
    }
    if (hand.streetBetTo < params.table.smallBet) {
      return fail(
        RealtimeErrorCode.INVALID_ACTION,
        "COMPLETE 前に RAISE はできません。",
        params.command.requestId,
        params.table.tableId,
      );
    }

    if (hand.raiseCount >= 4) {
      return fail(
        RealtimeErrorCode.INVALID_ACTION,
        "このストリートのRAISE上限に達しています。",
        params.command.requestId,
        params.table.tableId,
      );
    }

    const raiseSize = params.table.smallBet;
    const targetBet = hand.streetBetTo + raiseSize;
    amount = Math.min(
      Math.max(0, targetBet - player.streetContribution),
      seat.stack,
    );
    seat.stack -= amount;
    player.totalContribution += amount;
    player.streetContribution += amount;
    if (seat.stack === 0) {
      player.allIn = true;
    }
    hand.potTotal += amount;
    if (player.streetContribution > hand.streetBetTo) {
      hand.streetBetTo = player.streetContribution;
    }
    hand.raiseCount += 1;
    for (const candidate of hand.players) {
      candidate.actedThisRound = candidate.seatNo === player.seatNo;
    }
    eventName = TableEventName.RaiseEvent;
  } else {
    return fail(
      RealtimeErrorCode.INVALID_ACTION,
      `${action} は未対応のアクションです。`,
      params.command.requestId,
      params.table.tableId,
    );
  }

  const nextToActSeatNo = resolveNextToAct(hand, seat.seatNo);
  hand.toActSeatNo = nextToActSeatNo;

  const payloadBase = {
    street: hand.street,
    seatNo: seat.seatNo,
    potAfter: hand.potTotal,
    nextToActSeatNo,
  };

  const buildSuccessResult = (
    event: PendingEvent | null,
  ): ApplyCommandResult => {
    const events: PendingEvent[] = [];
    if (event) {
      events.push(event);
    }
    events.push(...progressHandAfterAction(params.table));

    return {
      ok: true,
      startHand: false,
      nextWalletBalance: params.currentBalance,
      events,
    };
  };

  if (eventName === TableEventName.CheckEvent) {
    return buildSuccessResult({
      handId: hand.handId,
      eventName,
      payload: {
        ...payloadBase,
        isAuto: params.isAuto,
      },
    });
  }

  if (eventName === TableEventName.FoldEvent) {
    return buildSuccessResult({
      handId: hand.handId,
      eventName,
      payload: {
        ...payloadBase,
        remainingPlayers: hand.players.filter((entry) => entry.inHand).length,
        isAuto: params.isAuto,
      },
    });
  }

  return buildSuccessResult({
    handId: hand.handId,
    eventName,
    payload: {
      ...payloadBase,
      amount,
      stackAfter: seat.stack,
      streetBetTo: hand.streetBetTo,
      isAllIn: seat.stack === 0,
    },
  });
};
