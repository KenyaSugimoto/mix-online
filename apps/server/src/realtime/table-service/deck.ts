import { randomInt } from "node:crypto";
import { CARD_RANKS, CARD_SUITS } from "@mix-online/shared";
import type { CardValue } from "./types";

type DrawRandomIndex = (upperExclusive: number) => number;

const createStandardDeck = (): CardValue[] => {
  const cards: CardValue[] = [];
  for (const suit of CARD_SUITS) {
    for (const rank of CARD_RANKS) {
      cards.push({ rank, suit });
    }
  }
  return cards;
};

export const createShuffledDeck = (
  drawRandomIndex: DrawRandomIndex = randomInt,
): CardValue[] => {
  const deck = createStandardDeck();

  for (let cursor = deck.length - 1; cursor > 0; cursor -= 1) {
    const swapIndex = drawRandomIndex(cursor + 1);
    if (!Number.isInteger(swapIndex) || swapIndex < 0 || swapIndex > cursor) {
      throw new Error(
        `不正なランダムインデックスです: index=${swapIndex}, max=${cursor}`,
      );
    }

    const cursorCard = deck[cursor];
    const swapCard = deck[swapIndex];
    if (!cursorCard || !swapCard) {
      throw new Error("シャッフル対象カードの参照に失敗しました。");
    }
    deck[cursor] = swapCard;
    deck[swapIndex] = cursorCard;
  }

  return deck;
};
