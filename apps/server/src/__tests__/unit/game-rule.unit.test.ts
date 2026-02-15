import { CardRank, CardSuit, GameType, Street } from "@mix-online/shared";
import { describe, expect, it } from "vitest";
import { resolveGameRule } from "../../realtime/game-rule";

describe("GameRule", () => {
  it("ED-01 StudHi/Stud8 の Bring-in スートタイブレークを判定できる", () => {
    const studRule = resolveGameRule(GameType.STUD_HI);

    const bringInSeatNo = studRule.determineBringIn([
      {
        seatNo: 1,
        upCards: [{ rank: CardRank.A, suit: CardSuit.H }],
        hasPairOnBoard: false,
      },
      {
        seatNo: 2,
        upCards: [{ rank: CardRank.A, suit: CardSuit.S }],
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
        upCards: [{ rank: CardRank.A, suit: CardSuit.S }],
        hasPairOnBoard: false,
      },
      {
        seatNo: 2,
        upCards: [{ rank: CardRank.A, suit: CardSuit.H }],
        hasPairOnBoard: false,
      },
    ]);

    expect(bringInSeatNo).toBe(1);
  });

  it("4th以降の先手判定をゲーム種ごとに返す", () => {
    const studRule = resolveGameRule(GameType.STUD_HI);
    const razzRule = resolveGameRule(GameType.RAZZ);

    const studFirst = studRule.determineFirstToAct(Street.FOURTH, [
      {
        seatNo: 1,
        upCards: [
          { rank: CardRank.N2, suit: CardSuit.S },
          { rank: CardRank.N9, suit: CardSuit.C },
        ],
      },
      {
        seatNo: 2,
        upCards: [
          { rank: CardRank.N3, suit: CardSuit.H },
          { rank: CardRank.T, suit: CardSuit.D },
        ],
      },
    ]);

    const razzFirst = razzRule.determineFirstToAct(Street.FOURTH, [
      {
        seatNo: 1,
        upCards: [
          { rank: CardRank.N2, suit: CardSuit.S },
          { rank: CardRank.N9, suit: CardSuit.C },
        ],
      },
      {
        seatNo: 2,
        upCards: [
          { rank: CardRank.N3, suit: CardSuit.H },
          { rank: CardRank.T, suit: CardSuit.D },
        ],
      },
    ]);

    expect(studFirst).toBe(2);
    expect(razzFirst).toBe(1);
  });

  it("5th以降のStudは最新1枚ではなく公開ボード全体で先手を判定する", () => {
    const studRule = resolveGameRule(GameType.STUD_HI);

    const firstToAct = studRule.determineFirstToAct(Street.FIFTH, [
      {
        seatNo: 1,
        upCards: [
          { rank: CardRank.A, suit: CardSuit.S },
          { rank: CardRank.K, suit: CardSuit.H },
          { rank: CardRank.Q, suit: CardSuit.D },
        ],
      },
      {
        seatNo: 2,
        upCards: [
          { rank: CardRank.J, suit: CardSuit.C },
          { rank: CardRank.J, suit: CardSuit.S },
          { rank: CardRank.N2, suit: CardSuit.H },
        ],
      },
    ]);

    expect(firstToAct).toBe(2);
  });

  it("5th以降のRazzは最新1枚ではなく公開ボード全体で先手を判定する", () => {
    const razzRule = resolveGameRule(GameType.RAZZ);

    const firstToAct = razzRule.determineFirstToAct(Street.SIXTH, [
      {
        seatNo: 1,
        upCards: [
          { rank: CardRank.K, suit: CardSuit.S },
          { rank: CardRank.A, suit: CardSuit.H },
          { rank: CardRank.N2, suit: CardSuit.D },
        ],
      },
      {
        seatNo: 2,
        upCards: [
          { rank: CardRank.Q, suit: CardSuit.C },
          { rank: CardRank.J, suit: CardSuit.D },
          { rank: CardRank.N3, suit: CardSuit.H },
        ],
      },
    ]);

    expect(firstToAct).toBe(2);
  });
});
