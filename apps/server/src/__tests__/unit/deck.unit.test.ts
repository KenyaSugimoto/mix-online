import { describe, expect, it } from "vitest";
import { createShuffledDeck } from "../../realtime/table-service/deck";
import { createStandardDeck } from "../../testing/fixed-deck-harness";

const cardKey = (card: { rank: string; suit: string }) =>
  `${card.rank}${card.suit}`;

describe("createShuffledDeck", () => {
  it("Fisher-Yates でカード順序をシャッフルできる", () => {
    const shuffled = createShuffledDeck((upperExclusive) =>
      Math.floor(upperExclusive / 3),
    );
    const standard = createStandardDeck();

    expect(shuffled).toHaveLength(52);
    expect(shuffled).not.toEqual(standard);

    const shuffledKeys = shuffled.map(cardKey);
    const standardKeys = standard.map(cardKey);
    expect(new Set(shuffledKeys).size).toBe(52);
    expect(shuffledKeys).toEqual(expect.arrayContaining(standardKeys));

    const first18SuitKinds = new Set(
      shuffled.slice(0, 18).map((card) => card.suit),
    );
    expect(first18SuitKinds.size).toBeGreaterThanOrEqual(3);
  });

  it("不正な乱数インデックスを拒否する", () => {
    expect(() => createShuffledDeck(() => -1)).toThrowError(
      "不正なランダムインデックスです",
    );
    expect(() => createShuffledDeck(() => 999)).toThrowError(
      "不正なランダムインデックスです",
    );
  });
});
