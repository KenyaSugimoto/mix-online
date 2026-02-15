import {
  RealtimeTableCommandType,
  SeatStatus,
  Street,
  TableCommandAction,
} from "@mix-online/shared";
import { describe, expect, it } from "vitest";
import {
  TABLE_ACT_ACTION_OPTIONS,
  resolveTableActActionOptions,
  resolveTableControlState,
} from "./table-control";

describe("table-control", () => {
  it("未着席時は JOIN のみ有効化する", () => {
    const state = resolveTableControlState({
      seatStatus: SeatStatus.EMPTY,
      isYourTurn: false,
    });

    expect(state.actionInputEnabled).toBe(false);
    expect(state.seatCommandAvailability).toEqual({
      [RealtimeTableCommandType.JOIN]: true,
      [RealtimeTableCommandType.SIT_OUT]: false,
      [RealtimeTableCommandType.RETURN]: false,
      [RealtimeTableCommandType.LEAVE]: false,
    });
  });

  it("SEATED_WAIT_NEXT_HAND は SIT_OUT / LEAVE のみ有効化する", () => {
    const state = resolveTableControlState({
      seatStatus: SeatStatus.SEATED_WAIT_NEXT_HAND,
      isYourTurn: false,
    });

    expect(state.actionInputEnabled).toBe(false);
    expect(state.seatCommandAvailability).toEqual({
      [RealtimeTableCommandType.JOIN]: false,
      [RealtimeTableCommandType.SIT_OUT]: true,
      [RealtimeTableCommandType.RETURN]: false,
      [RealtimeTableCommandType.LEAVE]: true,
    });
  });

  it("ACTIVE かつ手番中は table.act を有効化する", () => {
    const state = resolveTableControlState({
      seatStatus: SeatStatus.ACTIVE,
      isYourTurn: true,
    });

    expect(state.actionInputEnabled).toBe(true);
  });

  it("ACTIVE かつ非手番は table.act を無効化する", () => {
    const state = resolveTableControlState({
      seatStatus: SeatStatus.ACTIVE,
      isYourTurn: false,
    });

    expect(state.actionInputEnabled).toBe(false);
  });

  it("SIT_OUT は RETURN / LEAVE を有効化する", () => {
    const state = resolveTableControlState({
      seatStatus: SeatStatus.SIT_OUT,
      isYourTurn: false,
    });

    expect(state.actionInputEnabled).toBe(false);
    expect(state.seatCommandAvailability).toEqual({
      [RealtimeTableCommandType.JOIN]: false,
      [RealtimeTableCommandType.SIT_OUT]: false,
      [RealtimeTableCommandType.RETURN]: true,
      [RealtimeTableCommandType.LEAVE]: true,
    });
  });

  it("LEAVE_PENDING と DISCONNECTED はすべて無効化する", () => {
    const leavePending = resolveTableControlState({
      seatStatus: SeatStatus.LEAVE_PENDING,
      isYourTurn: false,
    });
    const disconnected = resolveTableControlState({
      seatStatus: SeatStatus.DISCONNECTED,
      isYourTurn: false,
    });

    expect(leavePending.actionInputEnabled).toBe(false);
    expect(disconnected.actionInputEnabled).toBe(false);
    expect(leavePending.seatCommandAvailability).toEqual({
      [RealtimeTableCommandType.JOIN]: false,
      [RealtimeTableCommandType.SIT_OUT]: false,
      [RealtimeTableCommandType.RETURN]: false,
      [RealtimeTableCommandType.LEAVE]: false,
    });
    expect(disconnected.seatCommandAvailability).toEqual({
      [RealtimeTableCommandType.JOIN]: false,
      [RealtimeTableCommandType.SIT_OUT]: false,
      [RealtimeTableCommandType.RETURN]: false,
      [RealtimeTableCommandType.LEAVE]: false,
    });
  });

  it("MVP受理アクション候補は BET/BRING_IN を含む", () => {
    expect(TABLE_ACT_ACTION_OPTIONS).toEqual([
      TableCommandAction.FOLD,
      TableCommandAction.CHECK,
      TableCommandAction.CALL,
      TableCommandAction.BET,
      TableCommandAction.COMPLETE,
      TableCommandAction.RAISE,
      TableCommandAction.BRING_IN,
    ]);
  });

  it("3rd の未アクション局面は BRING_IN/COMPLETE のみを返す", () => {
    expect(
      resolveTableActActionOptions({
        street: Street.THIRD,
        streetBetTo: 0,
        smallBet: 20,
        raiseCount: 0,
      }),
    ).toEqual([TableCommandAction.BRING_IN, TableCommandAction.COMPLETE]);
  });

  it("3rd の bring-in 済み局面は CALL/FOLD/COMPLETE のみを返す", () => {
    expect(
      resolveTableActActionOptions({
        street: Street.THIRD,
        streetBetTo: 10,
        smallBet: 20,
        raiseCount: 0,
      }),
    ).toEqual([
      TableCommandAction.FOLD,
      TableCommandAction.CALL,
      TableCommandAction.COMPLETE,
    ]);
  });

  it("4th以降の no-bet 局面は CHECK/BET のみを返す", () => {
    expect(
      resolveTableActActionOptions({
        street: Street.FOURTH,
        streetBetTo: 0,
        smallBet: 20,
        raiseCount: 0,
      }),
    ).toEqual([TableCommandAction.CHECK, TableCommandAction.BET]);
  });

  it("4th以降の bet 済み局面は CALL/FOLD/RAISE を返す", () => {
    expect(
      resolveTableActActionOptions({
        street: Street.FOURTH,
        streetBetTo: 20,
        smallBet: 20,
        raiseCount: 0,
      }),
    ).toEqual([
      TableCommandAction.FOLD,
      TableCommandAction.CALL,
      TableCommandAction.RAISE,
    ]);
  });

  it("raise上限到達時は RAISE を候補から除外する", () => {
    expect(
      resolveTableActActionOptions({
        street: Street.FOURTH,
        streetBetTo: 20,
        smallBet: 20,
        raiseCount: 4,
      }),
    ).toEqual([TableCommandAction.FOLD, TableCommandAction.CALL]);

    expect(
      resolveTableActActionOptions({
        street: Street.THIRD,
        streetBetTo: 20,
        smallBet: 20,
        raiseCount: 4,
      }),
    ).toEqual([TableCommandAction.FOLD, TableCommandAction.CALL]);
  });

  it("必要情報が不足する場合は候補を返さない", () => {
    expect(
      resolveTableActActionOptions({
        street: Street.FOURTH,
        streetBetTo: null,
        smallBet: 20,
        raiseCount: 0,
      }),
    ).toEqual([]);
    expect(
      resolveTableActActionOptions({
        street: null,
        streetBetTo: 0,
        smallBet: 20,
        raiseCount: 0,
      }),
    ).toEqual([]);
    expect(
      resolveTableActActionOptions({
        street: Street.FOURTH,
        streetBetTo: 0,
        smallBet: null,
        raiseCount: 0,
      }),
    ).toEqual([]);
    expect(
      resolveTableActActionOptions({
        street: Street.FOURTH,
        streetBetTo: 0,
        smallBet: 20,
        raiseCount: null,
      }),
    ).toEqual([]);
  });

  it("3rd の complete 済み局面は CALL/FOLD/RAISE を返す", () => {
    expect(
      resolveTableActActionOptions({
        street: Street.THIRD,
        streetBetTo: 20,
        smallBet: 20,
        raiseCount: 0,
      }),
    ).toEqual([
      TableCommandAction.FOLD,
      TableCommandAction.CALL,
      TableCommandAction.RAISE,
    ]);
  });
});
