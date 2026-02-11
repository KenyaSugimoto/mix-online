import { describe, expect, it } from "vitest";
import {
  createFixedDeckHarness,
  createStandardDeck,
} from "../../testing/fixed-deck-harness";

describe("固定デッキハーネス", () => {
  it("固定順序でカードを取り出せる", () => {
    const deck = createFixedDeckHarness([
      { rank: "A", suit: "S" },
      { rank: "K", suit: "H" },
    ]);

    expect(deck.draw()).toEqual({ rank: "A", suit: "S" });
    expect(deck.draw()).toEqual({ rank: "K", suit: "H" });
  });

  it("reset で先頭から再利用できる", () => {
    const deck = createFixedDeckHarness([
      { rank: "A", suit: "S" },
      { rank: "K", suit: "H" },
    ]);

    deck.draw();
    deck.reset();
    expect(deck.draw()).toEqual({ rank: "A", suit: "S" });
  });

  it("標準デッキは52枚ユニークで生成される", () => {
    const deck = createStandardDeck();
    expect(deck).toHaveLength(52);

    const uniqueCards = new Set(deck.map((card) => `${card.rank}${card.suit}`));
    expect(uniqueCards.size).toBe(52);
  });

  it("重複カードを含む固定デッキを拒否する", () => {
    expect(() =>
      createFixedDeckHarness([
        { rank: "A", suit: "S" },
        { rank: "A", suit: "S" },
      ]),
    ).toThrowError("固定デッキに重複カードがあります: AS");
  });
});
