import type { Card, Rank, Suit } from '../engine';

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
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

export function rankLabel(rank: Rank): string {
  return RANK_LABELS[rank - 1] ?? '?';
}

export function suitGlyph(suit: Suit): string {
  return SUIT_GLYPHS[suit];
}

/** The card as people write it: '7♠', '10♥', 'J♦'. */
export function formatCard(card: Card): string {
  return `${rankLabel(card.rank)}${suitGlyph(card.suit)}`;
}

/** A stable React key for a card. */
export function cardKey(card: Card): string {
  return `${String(card.rank)}-${card.suit}`;
}

export type PipColumn = 'left' | 'centre' | 'right';

/** One suit symbol on a card face; `row` runs 0 (top) to 1 (bottom). */
export type Pip = {
  readonly column: PipColumn;
  readonly row: number;
  /** Pips in the lower half are printed upside down, as on a real deck. */
  readonly inverted: boolean;
};

/** Jack, Queen, and King carry a picture (here, a letter) instead of pips. */
export function isCourt(rank: Rank): boolean {
  return rank > 10;
}

const CENTRE_ROWS: Partial<Record<Rank, readonly number[]>> = {
  1: [1 / 2],
  2: [0, 1],
  3: [0, 1 / 2, 1],
  5: [1 / 2],
  7: [1 / 4],
  8: [1 / 4, 3 / 4],
  9: [1 / 2],
  10: [1 / 6, 5 / 6],
};

// A five is a four with a centre pip, a seven and eight are a six with one
// or two, and a ten is a nine with the centre pip split in two.
const SIDE_ROWS: Partial<Record<Rank, readonly number[]>> = {
  4: [0, 1],
  5: [0, 1],
  6: [0, 1 / 2, 1],
  7: [0, 1 / 2, 1],
  8: [0, 1 / 2, 1],
  9: [0, 1 / 3, 2 / 3, 1],
  10: [0, 1 / 3, 2 / 3, 1],
};

function pip(column: PipColumn, row: number): Pip {
  return { column, row, inverted: row > 1 / 2 };
}

/** Where the pips sit on a number card's face; empty for court cards. */
export function pipLayout(rank: Rank): readonly Pip[] {
  const sides = SIDE_ROWS[rank] ?? [];
  const centre = CENTRE_ROWS[rank] ?? [];
  return [
    ...sides.map((row) => pip('left', row)),
    ...centre.map((row) => pip('centre', row)),
    ...sides.map((row) => pip('right', row)),
  ];
}
