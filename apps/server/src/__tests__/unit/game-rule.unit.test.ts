import { GameType, Street } from "@mix-online/shared";
import { describe, expect, it } from "vitest";
import { resolveGameRule } from "../../realtime/game-rule";

describe("GameRule", () => {
  it("ED-01 StudHi/Stud8 の Bring-in スートタイブレークを判定できる", () => {
    const studRule = resolveGameRule(GameType.STUD_HI);

    const bringInSeatNo = studRule.determineBringIn([
      {
        seatNo: 1,
        upCards: [{ rank: "A", suit: "H" }],
        hasPairOnBoard: false,
      },
      {
        seatNo: 2,
        upCards: [{ rank: "A", suit: "S" }],
        hasPairOnBoard: false,
      },
    ]);

    expect(bringInSeatNo).toBe(1);
  });

  it("ED-02 Razz の Bring-in スートタイブレークを判定できる", () => {
    const razzRule = resolveGameRule(GameType.RAZZ);

    const bringInSeatNo = razzRule.determineBringIn([
      {
        seatNo: 1,
        upCards: [{ rank: "A", suit: "S" }],
        hasPairOnBoard: false,
      },
      {
        seatNo: 2,
        upCards: [{ rank: "A", suit: "H" }],
        hasPairOnBoard: false,
      },
    ]);

    expect(bringInSeatNo).toBe(1);
  });

  it("4th以降の先手判定をゲーム種ごとに返す", () => {
    const studRule = resolveGameRule(GameType.STUD_HI);
    const razzRule = resolveGameRule(GameType.RAZZ);

    const studFirst = studRule.determineFirstToAct(Street.FOURTH, [
      { seatNo: 1, upCards: [{ rank: "9", suit: "C" }] },
      { seatNo: 2, upCards: [{ rank: "T", suit: "D" }] },
    ]);

    const razzFirst = razzRule.determineFirstToAct(Street.FOURTH, [
      { seatNo: 1, upCards: [{ rank: "9", suit: "C" }] },
      { seatNo: 2, upCards: [{ rank: "T", suit: "D" }] },
    ]);

    expect(studFirst).toBe(2);
    expect(razzFirst).toBe(1);
  });
});
