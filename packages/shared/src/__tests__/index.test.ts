import { describe, expect, it } from "vitest";
import {
  ACTION_TYPES,
  ERROR_CODES,
  GAME_TYPES,
  GameType as GameTypeEnum,
  REALTIME_ERROR_CODES,
  SEAT_STATUSES,
  TABLE_COMMAND_ACTIONS,
  TABLE_STATUSES,
} from "../index";
import type { GameType } from "../index";

describe("Shared Types", () => {
  it("GameType が有効な値を受け入れる", () => {
    const gameType: GameType = GameTypeEnum.STUD_HI;
    expect(gameType).toBe("STUD_HI");
  });

  it("基礎 enum を定数として公開する", () => {
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

  it("コマンド系とエラー系 enum の包含関係を維持する", () => {
    for (const action of TABLE_COMMAND_ACTIONS) {
      expect(ACTION_TYPES).toContain(action);
    }

    for (const errorCode of REALTIME_ERROR_CODES) {
      expect(ERROR_CODES).toContain(errorCode);
    }
  });
});
