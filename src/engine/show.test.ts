import { describe, expect, it } from 'vitest';
import { parseCard, parseCards } from './cards';
import { scoreShow } from './show';
import type { CombinationKind } from './tally';

type KnownHand = {
  name: string;
  hand: string;
  starter: string;
  isCrib?: boolean;
  total: number;
  kinds?: Partial<Record<CombinationKind, number>>;
};

// Expected totals come from the standard rules of cribbage, worked by hand.
const knownHands: KnownHand[] = [
  {
    name: 'the 29 hand: three fives and the Jack, fourth five as Starter',
    hand: '5H 5D 5C JS',
    starter: '5S',
    total: 29,
    kinds: { fifteen: 8, 'double-pair-royal': 1, nobs: 1 },
  },
  {
    name: 'the 28 hand: four fives and a ten',
    hand: '5H 5D 5C 5S',
    starter: 'TD',
    total: 28,
    kinds: { fifteen: 8, 'double-pair-royal': 1 },
  },
  {
    name: 'a 24: double-double run 4 4 5 5 6',
    hand: '4H 4D 5C 5S',
    starter: '6D',
    total: 24,
    kinds: { fifteen: 4, pair: 2, run: 4 },
  },
  {
    name: 'a 24: double-double run 7 7 8 8 9',
    hand: '7H 7D 8C 8S',
    starter: '9D',
    total: 24,
    kinds: { fifteen: 4, pair: 2, run: 4 },
  },
  {
    name: 'a 24: double-double run 4 5 5 6 6',
    hand: '4H 5D 5C 6S',
    starter: '6D',
    total: 24,
    kinds: { fifteen: 4, pair: 2, run: 4 },
  },
  {
    name: 'a pair royal of sixes with a pair of threes',
    hand: '6H 6D 6C 3S',
    starter: '3D',
    total: 20,
    kinds: { fifteen: 6, 'pair-royal': 1, pair: 1 },
  },
  {
    name: 'a double run of three with a pair',
    hand: '3H 4D 5C 5S',
    starter: 'KD',
    total: 12,
    kinds: { fifteen: 2, pair: 1, run: 2 },
  },
  {
    name: 'a triple run with a pair royal',
    hand: '3H 4D 5C 5S',
    starter: '5D',
    total: 17,
    kinds: { fifteen: 1, 'pair-royal': 1, run: 3 },
  },
  {
    name: 'a run of five',
    hand: 'AH 2D 3C 4S',
    starter: '5D',
    total: 7,
    kinds: { fifteen: 1, run: 1 },
  },
  {
    name: 'a run of four scores once, not as two runs of three',
    hand: '6H 7D 8C 9S',
    starter: 'KD',
    total: 8,
    kinds: { fifteen: 2, run: 1 },
  },
  {
    name: 'a pair royal',
    hand: '7H 7D 7C 2S',
    starter: 'KD',
    total: 6,
    kinds: { 'pair-royal': 1 },
  },
  {
    name: 'a four-card Hand flush with a non-matching Starter',
    hand: '2H 4H 6H 9H',
    starter: 'KS',
    total: 8,
    kinds: { fifteen: 2, flush: 1 },
  },
  {
    name: 'a five-card Hand flush',
    hand: '2H 4H 6H 9H',
    starter: 'KH',
    total: 9,
    kinds: { fifteen: 2, flush: 1 },
  },
  {
    name: 'a four-card Crib flush scores nothing for the flush',
    hand: '2H 4H 6H 9H',
    starter: 'KS',
    isCrib: true,
    total: 4,
    kinds: { fifteen: 2 },
  },
  {
    name: 'a five-card Crib flush scores five',
    hand: '2H 4H 6H 9H',
    starter: 'KH',
    isCrib: true,
    total: 9,
    kinds: { fifteen: 2, flush: 1 },
  },
  {
    name: 'nobs: the Jack of the Starter suit in Hand',
    hand: 'JH 2C 4D 8S',
    starter: '6H',
    total: 1,
    kinds: { nobs: 1 },
  },
  {
    name: 'a Jack as the Starter is not nobs',
    hand: '2C 4D 8S 9H',
    starter: 'JS',
    total: 2,
    kinds: { fifteen: 1 },
  },
  {
    name: 'a zero hand with no fifteens, pairs, or runs',
    hand: 'KS TD 4C 2H',
    starter: '7S',
    total: 0,
  },
  {
    name: 'another zero hand',
    hand: 'AS 3D 8C QH',
    starter: 'KD',
    total: 0,
  },
];

function tallyOf(known: Pick<KnownHand, 'hand' | 'starter' | 'isCrib'>) {
  return scoreShow({
    cards: parseCards(known.hand),
    starter: parseCard(known.starter),
    isCrib: known.isCrib ?? false,
  });
}

function pointsByKind(known: Pick<KnownHand, 'hand' | 'starter' | 'isCrib'>) {
  return new Map(tallyOf(known).combinations.map((c) => [c.kind, c.points]));
}

describe('Show Tally', () => {
  for (const known of knownHands) {
    it(`scores ${known.name} for ${String(known.total)}`, () => {
      expect(tallyOf(known).total).toBe(known.total);
    });
  }

  for (const known of knownHands.filter((k) => k.kinds !== undefined)) {
    it(`lists the right Combinations for ${known.name}`, () => {
      const tally = tallyOf(known);
      const counts: Partial<Record<CombinationKind, number>> = {};
      for (const c of tally.combinations) {
        counts[c.kind] = (counts[c.kind] ?? 0) + 1;
      }
      expect(counts).toEqual(known.kinds);
    });
  }

  it('scores a Fifteen for two, a Double Pair Royal for twelve, and Nobs for one', () => {
    const points = pointsByKind({ hand: '5H 5D 5C JS', starter: '5S' });
    expect(points.get('fifteen')).toBe(2);
    expect(points.get('double-pair-royal')).toBe(12);
    expect(points.get('nobs')).toBe(1);
  });

  it('scores a Pair for two and a Pair Royal for six', () => {
    expect(
      pointsByKind({ hand: '3H 4D 5C 5S', starter: 'KD' }).get('pair'),
    ).toBe(2);
    expect(
      pointsByKind({ hand: '7H 7D 7C 2S', starter: 'KD' }).get('pair-royal'),
    ).toBe(6);
  });

  it('scores a Run one point per card', () => {
    expect(
      pointsByKind({ hand: '3H 4D 5C KS', starter: 'QD' }).get('run'),
    ).toBe(3);
    expect(
      pointsByKind({ hand: '6H 7D 8C 9S', starter: 'KD' }).get('run'),
    ).toBe(4);
    expect(
      pointsByKind({ hand: 'AH 2D 3C 4S', starter: '5D' }).get('run'),
    ).toBe(5);
  });

  it('scores a Flush four for the Hand alone and five with the Starter', () => {
    expect(
      pointsByKind({ hand: '2H 4H 6H 9H', starter: 'KS' }).get('flush'),
    ).toBe(4);
    expect(
      pointsByKind({ hand: '2H 4H 6H 9H', starter: 'KH' }).get('flush'),
    ).toBe(5);
  });

  it('names the cards that make up each Combination', () => {
    const tally = tallyOf({ hand: '6H 7D 8C 9S', starter: 'KD' });
    const run = tally.combinations.find((c) => c.kind === 'run');
    expect(run?.points).toBe(4);
    expect(run?.cards.map((c) => c.rank).sort((a, b) => a - b)).toEqual([
      6, 7, 8, 9,
    ]);
  });
});
