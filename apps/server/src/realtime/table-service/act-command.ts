import {
  MVP_TABLE_ACT_ACTIONS,
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

const MAX_RAISES_PER_STREET = 4;

const resolveLegalActions = (params: {
  street: Street;
  streetBetTo: number;
  smallBet: number;
  raiseCount: number;
  toCall: number;
}): ReadonlyArray<(typeof MVP_TABLE_ACT_ACTIONS)[number]> => {
  if (params.street === Street.THIRD) {
    if (params.streetBetTo === 0) {
      return [TableCommandAction.BRING_IN, TableCommandAction.COMPLETE];
    }

    if (params.streetBetTo < params.smallBet) {
      if (params.toCall <= 0) {
        return [];
      }
      return [
        TableCommandAction.CALL,
        TableCommandAction.FOLD,
        TableCommandAction.COMPLETE,
      ];
    }

    if (params.toCall <= 0) {
      return [];
    }

    if (params.raiseCount >= MAX_RAISES_PER_STREET) {
      return [TableCommandAction.CALL, TableCommandAction.FOLD];
    }

    return [
      TableCommandAction.CALL,
      TableCommandAction.FOLD,
      TableCommandAction.RAISE,
    ];
  }

  if (params.toCall <= 0) {
    if (params.streetBetTo === 0) {
      return [TableCommandAction.CHECK, TableCommandAction.BET];
    }
    return [];
  }

  if (params.raiseCount >= MAX_RAISES_PER_STREET) {
    return [TableCommandAction.CALL, TableCommandAction.FOLD];
  }

  return [
    TableCommandAction.CALL,
    TableCommandAction.FOLD,
    TableCommandAction.RAISE,
  ];
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
  if (
    !MVP_TABLE_ACT_ACTIONS.includes(
      action as (typeof MVP_TABLE_ACT_ACTIONS)[number],
    )
  ) {
    return fail(
      RealtimeErrorCode.INVALID_ACTION,
      `${action} はMVPの table.act では受け付けていません。`,
      params.command.requestId,
      params.table.tableId,
    );
  }
  const supportedAction = action as (typeof MVP_TABLE_ACT_ACTIONS)[number];

  const toCall = Math.max(0, hand.streetBetTo - player.streetContribution);
  const legalActions = resolveLegalActions({
    street: hand.street,
    streetBetTo: hand.streetBetTo,
    smallBet: params.table.smallBet,
    raiseCount: hand.raiseCount,
    toCall,
  });
  if (!legalActions.includes(supportedAction)) {
    return fail(
      RealtimeErrorCode.INVALID_ACTION,
      legalActions.length > 0
        ? `現在の局面で許可されるアクション: ${legalActions.join(" / ")}`
        : "現在の局面ではアクションできません。",
      params.command.requestId,
      params.table.tableId,
    );
  }

  let amount = 0;
  let eventName:
    | typeof TableEventName.BringInEvent
    | typeof TableEventName.BetEvent
    | typeof TableEventName.CallEvent
    | typeof TableEventName.CheckEvent
    | typeof TableEventName.FoldEvent
    | typeof TableEventName.CompleteEvent
    | typeof TableEventName.RaiseEvent;

  if (supportedAction === TableCommandAction.CHECK) {
    player.actedThisRound = true;
    eventName = TableEventName.CheckEvent;
  } else if (supportedAction === TableCommandAction.FOLD) {
    player.inHand = false;
    player.actedThisRound = true;
    eventName = TableEventName.FoldEvent;
  } else if (supportedAction === TableCommandAction.BRING_IN) {
    const targetBet = params.table.bringIn;
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
    eventName = TableEventName.BringInEvent;
  } else if (supportedAction === TableCommandAction.BET) {
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
    eventName = TableEventName.BetEvent;
  } else if (supportedAction === TableCommandAction.CALL) {
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
  } else if (supportedAction === TableCommandAction.COMPLETE) {
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
  } else if (supportedAction === TableCommandAction.RAISE) {
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

  if (eventName === TableEventName.BringInEvent) {
    return buildSuccessResult({
      handId: hand.handId,
      eventName,
      payload: {
        ...payloadBase,
        street: Street.THIRD,
        amount,
        stackAfter: seat.stack,
        isAllIn: seat.stack === 0,
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
      raiseCount: hand.raiseCount,
      isAllIn: seat.stack === 0,
    },
  });
};
