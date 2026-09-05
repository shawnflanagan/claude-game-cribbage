import { describe, expect, it } from 'vitest';
import { parseCard } from '../engine';
import { formatCard } from './cards';

describe('card text', () => {
  it('formats a card the way people write it', () => {
    expect(formatCard(parseCard('7S'))).toBe('7♠');
    expect(formatCard(parseCard('TH'))).toBe('10♥');
    expect(formatCard(parseCard('AD'))).toBe('A♦');
    expect(formatCard(parseCard('KC'))).toBe('K♣');
  });
});
