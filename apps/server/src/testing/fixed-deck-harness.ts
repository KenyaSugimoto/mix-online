import {
  CARD_RANKS,
  CARD_SUITS,
  type CardRank,
  type CardSuit,
} from "@mix-online/shared";

export type DeckCard = {
  rank: CardRank;
  suit: CardSuit;
};

const toCardKey = (card: DeckCard) => `${card.rank}${card.suit}`;

export const createStandardDeck = (): DeckCard[] => {
  const cards: DeckCard[] = [];

  for (const suit of CARD_SUITS) {
    for (const rank of CARD_RANKS) {
      cards.push({ rank, suit });
    }
  }

  return cards;
};

export class FixedDeckHarness {
  private readonly seedCards: DeckCard[];
  private cursor = 0;

  constructor(seedCards: DeckCard[]) {
    if (seedCards.length === 0) {
      throw new Error("固定デッキは1枚以上必要です。");
    }

    const duplicateCheck = new Set<string>();
    for (const card of seedCards) {
      const key = toCardKey(card);
      if (duplicateCheck.has(key)) {
        throw new Error(`固定デッキに重複カードがあります: ${key}`);
      }
      duplicateCheck.add(key);
    }

    this.seedCards = [...seedCards];
  }

  draw(): DeckCard {
    const card = this.seedCards[this.cursor];
    if (!card) {
      throw new Error("固定デッキが不足しています。");
    }

    this.cursor += 1;
    return card;
  }

  drawMany(count: number): DeckCard[] {
    if (count <= 0) {
      throw new Error("drawMany の count は1以上を指定してください。");
    }

    return Array.from({ length: count }, () => this.draw());
  }

  remainingCount(): number {
    return this.seedCards.length - this.cursor;
  }

  reset(): void {
    this.cursor = 0;
  }
}

export const createFixedDeckHarness = (seedCards: DeckCard[]) =>
  new FixedDeckHarness(seedCards);
