export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const;
export type Suit = (typeof SUITS)[number];

// Ace is 1 and King is 13. Ranks compare by this order for Runs and Pairs;
// there is no wraparound, so King-Ace-Two is not a Run.
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;
export type Rank = (typeof RANKS)[number];

export const JACK: Rank = 11;

export type Card = {
  readonly rank: Rank;
  readonly suit: Suit;
};

/** Counting value for Fifteens and the Count: face cards are 10, Ace is 1. */
export function cardValue(card: Card): number {
  return Math.min(card.rank, 10);
}

export function sameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

/** The 52 cards in a fixed order. Shuffle before dealing. */
export function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

const RANK_CHARS = 'A23456789TJQK';
const SUIT_BY_CHAR: Readonly<Record<string, Suit>> = {
  C: 'clubs',
  D: 'diamonds',
  H: 'hearts',
  S: 'spades',
};

/**
 * Reads a card from two-character notation: rank A 2-9 T J Q K, then suit
 * C D H S. So '5H' is the five of hearts and 'TS' the ten of spades. Used by
 * tests and fixtures; malformed input is a programming error.
 */
export function parseCard(text: string): Card {
  const rankChar = text[0];
  const suitChar = text[1];
  if (text.length !== 2 || rankChar === undefined || suitChar === undefined) {
    throw new Error(`Not a card: '${text}'`);
  }
  const rank = RANKS[RANK_CHARS.indexOf(rankChar)];
  const suit = SUIT_BY_CHAR[suitChar];
  if (rank === undefined || suit === undefined) {
    throw new Error(`Not a card: '${text}'`);
  }
  return { rank, suit };
}

/** Reads a space-separated list of cards in `parseCard` notation. */
export function parseCards(text: string): Card[] {
  return text.trim().split(/\s+/).map(parseCard);
}

const RANK_LABELS = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];
const SUIT_GLYPHS: Readonly<Record<Suit, string>> = {
  clubs: '\u2663',
  diamonds: '\u2666',
  hearts: '\u2665',
  spades: '\u2660',
};

/** The card as people write it: '7\u2660', '10\u2665', 'J\u2666'. */
export function formatCard(card: Card): string {
  return `${RANK_LABELS[card.rank - 1] ?? '?'}${SUIT_GLYPHS[card.suit]}`;
}

export function suitGlyph(suit: Suit): string {
  return SUIT_GLYPHS[suit];
}

export function rankLabel(rank: Rank): string {
  return RANK_LABELS[rank - 1] ?? '?';
}
