import {
  MAX_COUNT,
  cardValue,
  fullDeck,
  sameCard,
  scoreShow,
  tallyForPlay,
  type Action,
  type Card,
  type CombinationKind,
  type Draw,
  type Rng,
  type Tally,
  type View,
} from '../engine';
import type { Opponent } from './opponent';

/**
 * What a two-card Discard is worth to whoever owns the Crib, in rough
 * expected points. Tune here.
 */
export const CRIB_VALUES = {
  /** A pair in the Crib scores 2 outright. */
  pair: 2,
  /** Two cards summing to fifteen score 2 outright. */
  fifteen: 2,
  /** Each five: it makes fifteen with any of the sixteen ten-cards. */
  five: 1,
  /** Adjacent ranks want only one more card for a Run. */
  adjacent: 1,
} as const;

export function cribValue(pair: readonly Card[]): number {
  const [a, b] = pair;
  if (a === undefined || b === undefined) return 0;
  let value = 0;
  if (a.rank === b.rank) value += CRIB_VALUES.pair;
  if (cardValue(a) + cardValue(b) === FIFTEEN) value += CRIB_VALUES.fifteen;
  if (a.rank === 5) value += CRIB_VALUES.five;
  if (b.rank === 5) value += CRIB_VALUES.five;
  if (Math.abs(a.rank - b.rank) === 1) value += CRIB_VALUES.adjacent;
  return value;
}

/**
 * Keeps the four cards with the best average Show Tally over every card
 * the Starter could still be, adjusted for what the Discard is worth in
 * the Crib: added when this Seat is the Dealer, subtracted when the Crib
 * is the other Seat's. Ties go to the first pair in Hand order.
 */
export function chooseDiscard(view: View): readonly [Card, Card] {
  const hand = view.hand;
  const unseen = fullDeck().filter((c) => !hand.some((h) => sameCard(h, c)));
  const owns = view.dealer === view.seat ? 1 : -1;
  let best: { discard: [Card, Card]; worth: number } | null = null;
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const a = hand[i];
      const b = hand[j];
      if (a === undefined || b === undefined) continue;
      const kept = hand.filter((_, k) => k !== i && k !== j);
      const total = unseen.reduce(
        (sum, starter) =>
          sum + scoreShow({ cards: kept, starter, isCrib: false }).total,
        0,
      );
      const worth = total / unseen.length + owns * cribValue([a, b]);
      if (best === null || worth > best.worth)
        best = { discard: [a, b], worth };
    }
  }
  // Unreachable: the engine only asks for a Discard from a six-card Hand.
  if (best === null) throw new Error('nothing to discard');
  return best.discard;
}

const FIFTEEN = 15;
/** No single card can bring a Count of four or less to fifteen. */
const SAFE_LEAD_RANK = 4;
/** A Count of 5 or 21 hands the other Seat a Fifteen or Thirty-One. */
const DANGEROUS_COUNTS: readonly number[] = [5, 21];

type Play = { card: Card; count: number; tally: Tally };

/**
 * The card to peg, by an ordered list of preferences. Each preference
 * narrows the candidates only if some card satisfies it, so lower
 * preferences break ties among higher ones. The final tie-break is the
 * highest card, then the higher rank, then Hand order.
 */
export function choosePlay(view: View): Card {
  const pegging = view.pegging;
  // Unreachable: the engine only asks for a Play while Pegging.
  if (pegging === null) throw new Error('not pegging');
  const before = pegging.sequence.map((p) => p.card);
  const leading = before.length === 0;
  const plays: Play[] = pegging.legal.map((card) => ({
    card,
    count: pegging.count + cardValue(card),
    tally: tallyForPlay(before, card),
  }));
  const makes = (play: Play, kinds: readonly CombinationKind[]) =>
    play.tally.combinations.some((c) => kinds.includes(c.kind));
  const preferences: ((play: Play) => boolean)[] = [
    (p) => p.count === MAX_COUNT,
    (p) => p.count === FIFTEEN,
    (p) => makes(p, ['pair', 'pair-royal', 'double-pair-royal', 'run']),
    // Leading a five is the same trap as leaving 5: any ten-card fifteens it.
    (p) =>
      !DANGEROUS_COUNTS.includes(p.count) && !(leading && p.card.rank === 5),
    (p) => !leading || p.card.rank <= SAFE_LEAD_RANK,
  ];
  let candidates = plays;
  for (const prefer of preferences) {
    const narrowed = candidates.filter(prefer);
    if (narrowed.length > 0) candidates = narrowed;
  }
  const chosen = [...candidates].sort(
    (x, y) =>
      cardValue(y.card) - cardValue(x.card) || y.card.rank - x.card.rank,
  )[0];
  // Unreachable: the engine only asks a Seat to play when it has a legal card.
  if (chosen === undefined) throw new Error('no legal card');
  return chosen.card;
}

/** Plays by heuristics alone; the randomness passes through untouched. */
export const heuristicOpponent: Opponent = (
  view: View,
  rng: Rng,
): Draw<Action> => {
  if (view.phase === 'pegging') {
    return {
      value: { type: 'play', seat: view.seat, card: choosePlay(view) },
      rng,
    };
  }
  return {
    value: { type: 'discard', seat: view.seat, cards: chooseDiscard(view) },
    rng,
  };
};
