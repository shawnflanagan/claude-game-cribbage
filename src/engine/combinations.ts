import type { Card } from './cards';
import type { Combination } from './tally';

/** Three or more cards of consecutive rank, in any order, no duplicates. */
export function isRun(cards: readonly Card[]): boolean {
  if (cards.length < 3) return false;
  const ranks = cards.map((c) => c.rank).sort((a, b) => a - b);
  return ranks.every((rank, i) => i === 0 || rank === (ranks[i - 1] ?? 0) + 1);
}

/** Two of a rank is a Pair, three a Pair Royal, four a Double Pair Royal. */
export function pairOf(sameRank: readonly Card[]): Combination | undefined {
  switch (sameRank.length) {
    case 2:
      return { kind: 'pair', points: 2, cards: sameRank };
    case 3:
      return { kind: 'pair-royal', points: 6, cards: sameRank };
    case 4:
      return { kind: 'double-pair-royal', points: 12, cards: sameRank };
    default:
      return undefined;
  }
}
