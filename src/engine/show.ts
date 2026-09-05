import { cardValue, JACK, type Card, type Rank } from './cards';
import { isRun, pairOf } from './combinations';
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
 * Combination in the order you would count them aloud: Fifteens,
 * Pairs, Runs, Flush, Nobs.
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

function subsets(cards: readonly Card[]): Card[][] {
  const result: Card[][] = [];
  for (let mask = 1; mask < 1 << cards.length; mask++) {
    result.push(cards.filter((_, i) => (mask & (1 << i)) !== 0));
  }
  return result;
}

/** Every distinct set of cards whose values sum to exactly 15. */
function fifteens(cards: readonly Card[]): Combination[] {
  return subsets(cards)
    .filter((s) => s.reduce((sum, c) => sum + cardValue(c), 0) === 15)
    .map((s) => ({ kind: 'fifteen', points: 2, cards: s }));
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

/**
 * Every maximal Run: a set of three or more consecutive ranks that is not
 * part of a longer Run. Duplicated ranks yield one Run per way of choosing
 * them, which is how a double run scores twice.
 */
function runs(cards: readonly Card[]): Combination[] {
  const candidates = subsets(cards).filter(isRun);
  return candidates
    .filter(
      (run) =>
        !candidates.some(
          (other) =>
            other.length > run.length &&
            run.every((card) => other.includes(card)),
        ),
    )
    .map((run) => ({ kind: 'run', points: run.length, cards: run }));
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
