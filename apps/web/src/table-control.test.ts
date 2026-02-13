import { SeatStatus, TableCommandAction } from "@mix-online/shared";
import { describe, expect, it } from "vitest";
import {
  actionRequiresAmount,
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
      join: true,
      sitOut: false,
      returnToTable: false,
      leave: false,
    });
  });

  it("SEATED_WAIT_NEXT_HAND は SIT_OUT / LEAVE のみ有効化する", () => {
    const state = resolveTableControlState({
      seatStatus: SeatStatus.SEATED_WAIT_NEXT_HAND,
      isYourTurn: false,
    });

    expect(state.actionInputEnabled).toBe(false);
    expect(state.seatCommandAvailability).toEqual({
      join: false,
      sitOut: true,
      returnToTable: false,
      leave: true,
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
      join: false,
      sitOut: false,
      returnToTable: true,
      leave: true,
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
      join: false,
      sitOut: false,
      returnToTable: false,
      leave: false,
    });
    expect(disconnected.seatCommandAvailability).toEqual({
      join: false,
      sitOut: false,
      returnToTable: false,
      leave: false,
    });
  });

  it("amount 必須アクションを判定する", () => {
    expect(actionRequiresAmount(TableCommandAction.BET)).toBe(true);
    expect(actionRequiresAmount(TableCommandAction.RAISE)).toBe(true);
    expect(actionRequiresAmount(TableCommandAction.COMPLETE)).toBe(true);
    expect(actionRequiresAmount(TableCommandAction.BRING_IN)).toBe(true);
    expect(actionRequiresAmount(TableCommandAction.CALL)).toBe(false);
    expect(actionRequiresAmount(TableCommandAction.CHECK)).toBe(false);
    expect(actionRequiresAmount(TableCommandAction.FOLD)).toBe(false);
  });
});
