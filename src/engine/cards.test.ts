import { describe, expect, it } from 'vitest';
import {
  cardValue,
  formatCard,
  fullDeck,
  parseCard,
  parseCards,
  sameCard,
} from './cards';

describe('cards', () => {
  it('parses rank and suit from short notation', () => {
    expect(parseCard('5H')).toEqual({ rank: 5, suit: 'hearts' });
    expect(parseCard('AC')).toEqual({ rank: 1, suit: 'clubs' });
    expect(parseCard('TD')).toEqual({ rank: 10, suit: 'diamonds' });
    expect(parseCard('JS')).toEqual({ rank: 11, suit: 'spades' });
    expect(parseCard('QH')).toEqual({ rank: 12, suit: 'hearts' });
    expect(parseCard('KC')).toEqual({ rank: 13, suit: 'clubs' });
  });

  it('parses a space-separated list of cards', () => {
    expect(parseCards('5H JS')).toEqual([
      { rank: 5, suit: 'hearts' },
      { rank: 11, suit: 'spades' },
    ]);
  });

  it('rejects malformed notation', () => {
    expect(() => parseCard('1H')).toThrow();
    expect(() => parseCard('5X')).toThrow();
    expect(() => parseCard('5')).toThrow();
  });

  it('counts face cards as ten and the ace as one', () => {
    expect(cardValue(parseCard('AS'))).toBe(1);
    expect(cardValue(parseCard('9S'))).toBe(9);
    expect(cardValue(parseCard('TS'))).toBe(10);
    expect(cardValue(parseCard('JS'))).toBe(10);
    expect(cardValue(parseCard('QS'))).toBe(10);
    expect(cardValue(parseCard('KS'))).toBe(10);
  });

  it('builds a full deck of 52 distinct cards', () => {
    const deck = fullDeck();
    expect(deck).toHaveLength(52);
    const distinct = new Set(deck.map((c) => `${String(c.rank)}${c.suit}`));
    expect(distinct.size).toBe(52);
  });

  it('formats a card the way people write it', () => {
    expect(formatCard(parseCard('7S'))).toBe('7\u2660');
    expect(formatCard(parseCard('TH'))).toBe('10\u2665');
    expect(formatCard(parseCard('AD'))).toBe('A\u2666');
    expect(formatCard(parseCard('KC'))).toBe('K\u2663');
  });

  it('compares cards by rank and suit, not identity', () => {
    expect(sameCard(parseCard('5H'), { rank: 5, suit: 'hearts' })).toBe(true);
    expect(sameCard(parseCard('5H'), parseCard('5S'))).toBe(false);
    expect(sameCard(parseCard('5H'), parseCard('6H'))).toBe(false);
  });
});
