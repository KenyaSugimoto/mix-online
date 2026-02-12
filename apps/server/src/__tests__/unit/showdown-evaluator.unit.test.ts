import { GameType, PotSide } from "@mix-online/shared";
import { describe, expect, it } from "vitest";
import {
  createShowdownOutcome,
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
});
