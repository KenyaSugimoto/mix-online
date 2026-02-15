import { GameType, PotSide } from "@mix-online/shared";
import { describe, expect, it } from "vitest";
import {
  createShowdownOutcome,
  labelForHighScoreJa,
  labelForLowScore,
  splitAmountAcrossWinners,
} from "../../realtime/showdown-evaluator";

const emptyCards = { cardsUp: [] as never[], cardsDown: [] as never[] };

describe("ShowdownEvaluator", () => {
  it("ED-04 3人1サイドポット分配を計算できる", () => {
    // メインポット: U1(60) + U2(60) + U3(60) = 180 -> U1勝利
    // サイドポット: U2(80) + U3(80) = 160 -> U3勝利
    const outcome = createShowdownOutcome({
      gameType: GameType.STUD_HI,
      dealerSeatNo: 1,
      players: [
        {
          seatNo: 1,
          userId: "u1",
          displayName: "U1",
          contribution: 60,
          highScoreOverride: [100],
          ...emptyCards,
        },
        {
          seatNo: 2,
          userId: "u2",
          displayName: "U2",
          contribution: 140,
          highScoreOverride: [80],
          ...emptyCards,
        },
        {
          seatNo: 3,
          userId: "u3",
          displayName: "U3",
          contribution: 140,
          highScoreOverride: [90],
          ...emptyCards,
        },
      ],
    });

    expect(outcome.potResults).toHaveLength(2);
    expect(outcome.potResults[0]).toMatchObject({
      potNo: 1,
      side: PotSide.SCOOP,
      amount: 180,
      winners: [{ seatNo: 1, amount: 180 }],
    });
    expect(outcome.potResults[1]).toMatchObject({
      potNo: 2,
      side: PotSide.SCOOP,
      amount: 160,
      winners: [{ seatNo: 3, amount: 160 }],
    });
  });

  it("ED-05 4人多段サイドポット分配を計算できる", () => {
    // メインポット: U1(80) + U2(80) + U3(80) + U4(80) = 320 -> U1勝利
    // サイドポット1: U2(60) + U3(60) + U4(60) = 180 -> U2勝利
    // サイドポット2: U3(80) + U4(80) = 160 -> U4勝利
    const outcome = createShowdownOutcome({
      gameType: GameType.STUD_HI,
      dealerSeatNo: 1,
      players: [
        {
          seatNo: 1,
          userId: "u1",
          displayName: "U1",
          contribution: 80,
          highScoreOverride: [100],
          ...emptyCards,
        },
        {
          seatNo: 2,
          userId: "u2",
          displayName: "U2",
          contribution: 140,
          highScoreByPot: {
            1: [90],
            2: [95],
          },
          highScoreOverride: [90],
          ...emptyCards,
        },
        {
          seatNo: 3,
          userId: "u3",
          displayName: "U3",
          contribution: 220,
          highScoreOverride: [70],
          ...emptyCards,
        },
        {
          seatNo: 4,
          userId: "u4",
          displayName: "U4",
          contribution: 220,
          highScoreByPot: {
            1: [80],
            2: [85],
            3: [99],
          },
          highScoreOverride: [80],
          ...emptyCards,
        },
      ],
    });

    expect(outcome.potResults).toHaveLength(3);
    expect(outcome.potResults[0]?.winners[0]).toMatchObject({
      seatNo: 1,
      amount: 320,
    });
    expect(outcome.potResults[1]?.winners[0]).toMatchObject({
      seatNo: 2,
      amount: 180,
    });
    expect(outcome.potResults[2]?.winners[0]).toMatchObject({
      seatNo: 4,
      amount: 160,
    });
  });

  it("HP-06/HP-07 Stud8 のHi/Lo分配とLo資格なしを扱える", () => {
    // U1: Hi 100, Lo 9-8-7-6-5 (Not Qualify)
    // U2: Hi 90,  Lo 8-7-6-4-2
    // メインポット: U1(25) + U2(25) = 50 -> Hi: U1勝利, Lo: U2勝利
    const withLow = createShowdownOutcome({
      gameType: GameType.STUD_8,
      dealerSeatNo: 1,
      players: [
        {
          seatNo: 1,
          userId: "u1",
          displayName: "U1",
          contribution: 25,
          highScoreOverride: [100],
          lowScoreOverride: [9, 8, 7, 6, 5],
          ...emptyCards,
        },
        {
          seatNo: 2,
          userId: "u2",
          displayName: "U2",
          contribution: 25,
          highScoreOverride: [90],
          lowScoreOverride: [8, 7, 6, 4, 2],
          ...emptyCards,
        },
      ],
    });
    expect(withLow.potResults).toHaveLength(2);
    expect(withLow.potResults[0]).toMatchObject({
      side: PotSide.HI,
      amount: 25,
      winners: [{ seatNo: 1, amount: 25 }],
    });
    expect(withLow.potResults[1]).toMatchObject({
      side: PotSide.LO,
      amount: 25,
      winners: [{ seatNo: 2, amount: 25 }],
    });

    const withoutLow = createShowdownOutcome({
      gameType: GameType.STUD_8,
      dealerSeatNo: 1,
      players: [
        {
          seatNo: 1,
          userId: "u1",
          displayName: "U1",
          contribution: 25,
          highScoreOverride: [100],
          lowScoreOverride: null,
          ...emptyCards,
        },
        {
          seatNo: 2,
          userId: "u2",
          displayName: "U2",
          contribution: 25,
          highScoreOverride: [90],
          lowScoreOverride: null,
          ...emptyCards,
        },
      ],
    });
    expect(withoutLow.potResults).toHaveLength(1);
    expect(withoutLow.potResults[0]).toMatchObject({
      side: PotSide.SCOOP,
      amount: 50,
      winners: [{ seatNo: 1, amount: 50 }],
    });
  });

  it("ED-06 Pot単位の独立Hi/Lo評価を扱える", () => {
    // U1: Hi 70, Lo 8-7-6-5-4
    // U2: Hi 80, Lo N/A
    // U3: Hi 100, Lo N/A
    // ポット1: U1(80) + U2(80) + U3(80) = 240 -> Hi: U3勝利, Lo: U1勝利
    // ポット2: U2(80) + U3(80) = 160 -> Hi: U2勝利
    const outcome = createShowdownOutcome({
      gameType: GameType.STUD_8,
      dealerSeatNo: 1,
      players: [
        {
          seatNo: 1,
          userId: "u1",
          displayName: "U1",
          contribution: 80,
          highScoreByPot: { 1: [70] },
          lowScoreByPot: { 1: [8, 7, 6, 5, 4] },
          highScoreOverride: [70],
          lowScoreOverride: [8, 7, 6, 5, 4],
          ...emptyCards,
        },
        {
          seatNo: 2,
          userId: "u2",
          displayName: "U2",
          contribution: 160,
          highScoreByPot: { 1: [80], 2: [100] },
          lowScoreByPot: { 1: null, 2: null },
          highScoreOverride: [80],
          lowScoreOverride: null,
          ...emptyCards,
        },
        {
          seatNo: 3,
          userId: "u3",
          displayName: "U3",
          contribution: 160,
          highScoreByPot: { 1: [100], 2: [90] },
          lowScoreByPot: { 1: null, 2: null },
          highScoreOverride: [100],
          lowScoreOverride: null,
          ...emptyCards,
        },
      ],
    });

    expect(outcome.potResults).toMatchObject([
      {
        potNo: 1,
        side: PotSide.HI,
        amount: 120,
        winners: [{ seatNo: 3, amount: 120 }],
      },
      {
        potNo: 1,
        side: PotSide.LO,
        amount: 120,
        winners: [{ seatNo: 1, amount: 120 }],
      },
      {
        potNo: 2,
        side: PotSide.SCOOP,
        amount: 160,
        winners: [{ seatNo: 2, amount: 160 }],
      },
    ]);
  });

  it("ED-07/ED-08 オッドチップ配分を計算できる", () => {
    const hiLoSplit = {
      hi: Math.floor(55 / 2) + (55 % 2),
      lo: 55 - (Math.floor(55 / 2) + (55 % 2)),
    };
    expect(hiLoSplit).toEqual({ hi: 28, lo: 27 });

    const tie = splitAmountAcrossWinners({
      amount: 55,
      dealerSeatNo: 2,
      winners: [
        { seatNo: 1, userId: "u1", displayName: "U1" },
        { seatNo: 3, userId: "u3", displayName: "U3" },
      ],
    });

    expect(tie).toMatchObject([
      { seatNo: 3, amount: 28 },
      { seatNo: 1, amount: 27 },
    ]);
  });

  describe("labelForHighScoreJa", () => {
    it("正しい日本語役名を返す", () => {
      expect(labelForHighScoreJa([8])).toBe("ストレートフラッシュ");
      expect(labelForHighScoreJa([7])).toBe("フォーカード");
      expect(labelForHighScoreJa([6])).toBe("フルハウス");
      expect(labelForHighScoreJa([5])).toBe("フラッシュ");
      expect(labelForHighScoreJa([4])).toBe("ストレート");
      expect(labelForHighScoreJa([3])).toBe("スリーカード");
      expect(labelForHighScoreJa([2])).toBe("ツーペア");
      expect(labelForHighScoreJa([1])).toBe("ワンペア");
      expect(labelForHighScoreJa([0])).toBe("ハイカード");
    });

    it("不正な値でもハイカードを返す", () => {
      expect(labelForHighScoreJa([])).toBe("ハイカード");
    });
  });

  describe("labelForLowScore", () => {
    it("ローランクをハイフン区切りで返す", () => {
      expect(labelForLowScore([7, 5, 4, 3, 1])).toBe("7-5-4-3-A");
      expect(labelForLowScore([8, 6, 4, 2, 1])).toBe("8-6-4-2-A");
      expect(labelForLowScore([6, 4, 3, 2, 1])).toBe("6-4-3-2-A");
    });

    it("nullまたは空配列なら「ローなし」を返す", () => {
      expect(labelForLowScore(null)).toBe("ローなし");
      expect(labelForLowScore([])).toBe("ローなし");
    });
  });

  describe("Stud Hiショーダウン フォーマット", () => {
    it("役表示が H: [日本語役名] 形式である", () => {
      const outcome = createShowdownOutcome({
        gameType: GameType.STUD_HI,
        dealerSeatNo: 1,
        players: [
          {
            seatNo: 1,
            userId: "u1",
            displayName: "U1",
            contribution: 100,
            highScoreOverride: [1], // ワンペア
            ...emptyCards,
          },
        ],
      });

      expect(outcome.potResults[0]?.winners[0]?.handLabel).toBe("H: ワンペア");
    });
  });

  describe("Razzショーダウン フォーマット", () => {
    it("役表示が L: [ランク文字列] 形式である", () => {
      const outcome = createShowdownOutcome({
        gameType: GameType.RAZZ,
        dealerSeatNo: 1,
        players: [
          {
            seatNo: 1,
            userId: "u1",
            displayName: "U1",
            contribution: 100,
            lowScoreOverride: [7, 5, 4, 3, 1],
            ...emptyCards,
          },
        ],
      });

      expect(outcome.potResults[0]?.winners[0]?.handLabel).toBe("L: 7-5-4-3-A");
    });
  });

  describe("Stud8 Hi/Lo分割 フォーマット", () => {
    it("Hi側に H: [役名]、Lo側に L: [ランク] を付与する", () => {
      const outcome = createShowdownOutcome({
        gameType: GameType.STUD_8,
        dealerSeatNo: 1,
        players: [
          {
            seatNo: 1,
            userId: "u1",
            displayName: "U1",
            contribution: 100,
            highScoreOverride: [2], // ツーペア
            lowScoreOverride: [7, 5, 4, 3, 1],
            ...emptyCards,
          },
        ],
      });

      const hiPot = outcome.potResults.find((p) => p.side === PotSide.HI);
      const loPot = outcome.potResults.find((p) => p.side === PotSide.LO);

      expect(hiPot?.winners[0]?.handLabel).toBe("H: ツーペア");
      expect(loPot?.winners[0]?.handLabel).toBe("L: 7-5-4-3-A");
    });
  });
});
