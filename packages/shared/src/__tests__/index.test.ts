import { describe, expect, it } from "vitest";
import {
  ACTION_TYPES,
  ERROR_CODES,
  GAME_TYPES,
  REALTIME_ERROR_CODES,
  SEAT_STATUSES,
  TABLE_COMMAND_ACTIONS,
  TABLE_STATUSES,
} from "../index";
import type { GameType } from "../index";

describe("Shared Types", () => {
  it("GameType should be valid", () => {
    const gameType: GameType = "STUD_HI";
    expect(gameType).toBe("STUD_HI");
  });

  it("should expose base enums as constants", () => {
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
  });

  it("should keep command/error enums consistent with broader enums", () => {
    for (const action of TABLE_COMMAND_ACTIONS) {
      expect(ACTION_TYPES).toContain(action);
    }

    for (const errorCode of REALTIME_ERROR_CODES) {
      expect(ERROR_CODES).toContain(errorCode);
    }
  });
});
