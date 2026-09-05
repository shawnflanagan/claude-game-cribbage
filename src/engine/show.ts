import { cardValue, JACK, type Card, type Rank } from './cards';
import { pairOf } from './combinations';
import { makeTally, type Combination, type Tally } from './tally';

export type ShowInput = {
  /** The four cards kept in a Hand, or the four in the Crib. */
  readonly cards: readonly Card[];
  readonly starter: Card;
  /** The Crib only scores a Flush when all five cards match. */
  readonly isCrib: boolean;
};

/**
 * Scores a Hand or the Crib together with the Starter, listing every
 * Combination in the order you would count them aloud: Fifteens, Pairs,
 * Runs, Flush, Nobs.
 *
 * Subsets of the five cards are bitmasks over their positions, which keeps
 * the hot loop free of allocation: an opponent weighing a Discard calls
 * this hundreds of times per decision.
 */
export function scoreShow(input: ShowInput): Tally {
  const all = [...input.cards, input.starter];
  return makeTally([
    ...fifteens(all),
    ...pairs(all),
    ...runs(all),
    ...flush(input),
    ...nobs(input),
  ]);
}

function select(cards: readonly Card[], mask: number): Card[] {
  return cards.filter((_, i) => (mask & (1 << i)) !== 0);
}

/** Every distinct set of cards whose values sum to exactly 15. */
function fifteens(cards: readonly Card[]): Combination[] {
  const values = cards.map(cardValue);
  const result: Combination[] = [];
  const masks = 1 << cards.length;
  for (let mask = 1; mask < masks; mask++) {
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      if ((mask & (1 << i)) !== 0) sum += values[i] ?? 0;
    }
    if (sum === 15) {
      result.push({ kind: 'fifteen', points: 2, cards: select(cards, mask) });
    }
  }
  return result;
}

function pairs(cards: readonly Card[]): Combination[] {
  const byRank = new Map<Rank, Card[]>();
  for (const card of cards) {
    byRank.set(card.rank, [...(byRank.get(card.rank) ?? []), card]);
  }
  return [...byRank.values()].flatMap((group) => {
    const pair = pairOf(group);
    return pair === undefined ? [] : [pair];
  });
}

/** Whether the cards selected by `mask` are three or more consecutive ranks. */
function isRunMask(ranks: readonly number[], mask: number): boolean {
  let seen = 0;
  let size = 0;
  for (let i = 0; i < ranks.length; i++) {
    if ((mask & (1 << i)) === 0) continue;
    const bit = 1 << (ranks[i] ?? 0);
    if ((seen & bit) !== 0) return false;
    seen |= bit;
    size++;
  }
  if (size < 3) return false;
  // Consecutive ranks make one unbroken block of bits.
  const lowest = seen & -seen;
  return seen / lowest + 1 === 1 << size;
}

/**
 * Every maximal Run: a set of three or more consecutive ranks that is not
 * part of a longer Run. Duplicated ranks yield one Run per way of choosing
 * them, which is how a double run scores twice.
 */
function runs(cards: readonly Card[]): Combination[] {
  const ranks = cards.map((c) => c.rank);
  const masks = 1 << cards.length;
  const runMasks: number[] = [];
  for (let mask = 1; mask < masks; mask++) {
    if (isRunMask(ranks, mask)) runMasks.push(mask);
  }
  return runMasks
    .filter(
      (mask) =>
        !runMasks.some((other) => other !== mask && (other & mask) === mask),
    )
    .map((mask) => {
      const run = select(cards, mask);
      return { kind: 'run', points: run.length, cards: run };
    });
}

function flush({ cards, starter, isCrib }: ShowInput): Combination[] {
  const first = cards[0];
  if (first === undefined || !cards.every((c) => c.suit === first.suit)) {
    return [];
  }
  if (starter.suit === first.suit) {
    return [{ kind: 'flush', points: 5, cards: [...cards, starter] }];
  }
  return isCrib ? [] : [{ kind: 'flush', points: 4, cards: [...cards] }];
}

/** One for holding the Jack of the Starter's suit. */
function nobs({ cards, starter }: ShowInput): Combination[] {
  const jack = cards.find((c) => c.rank === JACK && c.suit === starter.suit);
  return jack === undefined ? [] : [{ kind: 'nobs', points: 1, cards: [jack] }];
}
