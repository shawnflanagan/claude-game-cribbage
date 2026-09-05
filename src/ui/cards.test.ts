import { describe, expect, it } from 'vitest';
import { RANKS, parseCard } from '../engine';
import { formatCard, pipLayout } from './cards';

describe('card text', () => {
  it('formats a card the way people write it', () => {
    expect(formatCard(parseCard('7S'))).toBe('7♠');
    expect(formatCard(parseCard('TH'))).toBe('10♥');
    expect(formatCard(parseCard('AD'))).toBe('A♦');
    expect(formatCard(parseCard('KC'))).toBe('K♣');
  });
});

describe('pip layout', () => {
  it('places one pip per point for Ace through ten and none for court cards', () => {
    for (const rank of RANKS) {
      expect(pipLayout(rank)).toHaveLength(rank <= 10 ? rank : 0);
    }
  });

  it('mirrors the traditional layout top to bottom, bar the odd pip of a seven', () => {
    for (const rank of RANKS) {
      const pips = pipLayout(rank);
      const unmirrored = pips.filter(
        (pip) =>
          !pips.some(
            (p) =>
              p.column === pip.column && Math.abs(p.row + pip.row - 1) < 1e-9,
          ),
      );
      expect(unmirrored.length, `rank ${String(rank)}`).toBe(
        rank === 7 ? 1 : 0,
      );
      expect(unmirrored.every((p) => p.column === 'centre')).toBe(true);
    }
  });

  it('keeps every pip inside the face and never stacks two in one place', () => {
    for (const rank of RANKS) {
      const seen = new Set<string>();
      for (const pip of pipLayout(rank)) {
        expect(pip.row).toBeGreaterThanOrEqual(0);
        expect(pip.row).toBeLessThanOrEqual(1);
        const key = `${pip.column}:${pip.row.toFixed(6)}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });

  it('uses the middle column alone for Ace, two, and three', () => {
    for (const rank of [1, 2, 3] as const) {
      expect(pipLayout(rank).every((p) => p.column === 'centre')).toBe(true);
    }
  });

  it('turns the pips in the lower half upside down', () => {
    expect(pipLayout(2)).toEqual([
      { column: 'centre', row: 0, inverted: false },
      { column: 'centre', row: 1, inverted: true },
    ]);
  });
});
