import { describe, expect, it } from "vitest";
import {
  ACTION_TYPES,
  BETTING_STRUCTURES,
  DEAL_END_REASONS,
  ERROR_CODES,
  GAME_TYPES,
  HAND_PLAYER_STATES,
  HAND_STATUSES,
  POT_SIDES,
  REALTIME_ERROR_CODES,
  SEAT_STATE_CHANGE_APPLIES_FROM,
  SEAT_STATE_CHANGE_REASONS,
  SEAT_STATUSES,
  SHOWDOWN_ACTIONS,
  SNAPSHOT_REASONS,
  STREETS,
  TABLE_COMMAND_ACTIONS,
  TABLE_EVENT_NAMES,
  TABLE_STATUSES,
  WALLET_TRANSACTION_TYPES,
} from "../index";

describe("Contract Enum Alignment", () => {
  it("should align with OpenAPI enums", () => {
    expect(GAME_TYPES).toEqual(["STUD_HI", "RAZZ", "STUD_8"]);
    expect(TABLE_STATUSES).toEqual([
      "WAITING",
      "DEALING",
      "BETTING",
      "SHOWDOWN",
      "HAND_END",
    ]);
    expect(SEAT_STATUSES).toEqual([
      "EMPTY",
      "SEATED_WAIT_NEXT_HAND",
      "ACTIVE",
      "SIT_OUT",
      "DISCONNECTED",
      "LEAVE_PENDING",
    ]);
    expect(HAND_STATUSES).toEqual(["IN_PROGRESS", "SHOWDOWN", "HAND_END"]);
    expect(STREETS).toEqual(["THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH"]);
    expect(ACTION_TYPES).toEqual([
      "ANTE",
      "BRING_IN",
      "COMPLETE",
      "BET",
      "RAISE",
      "CALL",
      "CHECK",
      "FOLD",
      "AUTO_CHECK",
      "AUTO_FOLD",
      "SHOW",
      "MUCK",
    ]);
    expect(ERROR_CODES).toEqual([
      "INVALID_ACTION",
      "INVALID_CURSOR",
      "NOT_YOUR_TURN",
      "INSUFFICIENT_CHIPS",
      "TABLE_FULL",
      "BUYIN_OUT_OF_RANGE",
      "ALREADY_SEATED",
      "AUTH_EXPIRED",
      "BAD_REQUEST",
      "NOT_FOUND",
      "INTERNAL_SERVER_ERROR",
    ]);
    expect(BETTING_STRUCTURES).toEqual(["FIXED_LIMIT"]);
  });

  it("should align with AsyncAPI enums", () => {
    expect(TABLE_COMMAND_ACTIONS).toEqual([
      "FOLD",
      "CHECK",
      "CALL",
      "BET",
      "RAISE",
      "COMPLETE",
      "BRING_IN",
    ]);
    expect(TABLE_EVENT_NAMES).toEqual([
      "DealInitEvent",
      "DealCards3rdEvent",
      "DealCardEvent",
      "PostAnteEvent",
      "BringInEvent",
      "CompleteEvent",
      "BetEvent",
      "RaiseEvent",
      "CallEvent",
      "CheckEvent",
      "FoldEvent",
      "StreetAdvanceEvent",
      "ShowdownEvent",
      "DealEndEvent",
      "SeatStateChangedEvent",
      "PlayerDisconnectedEvent",
      "PlayerReconnectedEvent",
    ]);
    expect(SHOWDOWN_ACTIONS).toEqual(["SHOW", "MUCK"]);
    expect(POT_SIDES).toEqual(["SINGLE", "HI", "LO"]);
    expect(DEAL_END_REASONS).toEqual(["SHOWDOWN", "UNCONTESTED", "AUTO_END"]);
    expect(SEAT_STATE_CHANGE_REASONS).toEqual([
      "JOIN",
      "SIT_OUT",
      "RETURN",
      "LEAVE_PENDING",
      "LEAVE",
      "AUTO_LEAVE_ZERO_STACK",
      "NEXT_HAND_ACTIVATE",
      "SYSTEM",
    ]);
    expect(SEAT_STATE_CHANGE_APPLIES_FROM).toEqual(["IMMEDIATE", "NEXT_HAND"]);
    expect(SNAPSHOT_REASONS).toEqual(["OUT_OF_RANGE", "RESYNC_REQUIRED"]);
    expect(REALTIME_ERROR_CODES).toEqual([
      "INVALID_ACTION",
      "NOT_YOUR_TURN",
      "INSUFFICIENT_CHIPS",
      "TABLE_FULL",
      "BUYIN_OUT_OF_RANGE",
      "ALREADY_SEATED",
      "AUTH_EXPIRED",
    ]);
  });

  it("should align with DDL CHECK enums", () => {
    expect(WALLET_TRANSACTION_TYPES).toEqual([
      "INIT_GRANT",
      "BUY_IN",
      "CASH_OUT",
      "HAND_RESULT",
    ]);
    expect(HAND_PLAYER_STATES).toEqual([
      "IN_HAND",
      "FOLDED",
      "ALL_IN",
      "AUTO_FOLDED",
    ]);
  });
});
