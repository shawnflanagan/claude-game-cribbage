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
