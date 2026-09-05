import {
  MAX_COUNT,
  cardValue,
  fullDeck,
  sameCard,
  scoreShow,
  tallyForPlay,
  type Action,
  type Card,
  type Draw,
  type Rng,
  type View,
} from '../engine';
import type { Opponent } from './opponent';

/**
 * A rough worth of a two-card Discard to whoever owns the Crib. Plain data
 * so it can be tuned; a Dealer adds it, a Pone subtracts it.
 */
export function cribValue(pair: readonly Card[]): number {
  const [a, b] = pair;
  if (a === undefined || b === undefined) return 0;
  let value = 0;
  if (a.rank === b.rank) value += 2;
  if (cardValue(a) + cardValue(b) === 15) value += 2;
  if (a.rank === 5) value += 1;
  if (b.rank === 5) value += 1;
  if (Math.abs(a.rank - b.rank) === 1) value += 1;
  return value;
}

/**
 * Keeps the four cards with the best average Show Tally over every card
 * the Starter could still be, adjusted for what the Discard is worth in
 * the Crib.
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
  if (best === null) throw new Error('nothing to discard');
  return best.discard;
}

type Play = {
  card: Card;
  count: number;
  tally: ReturnType<typeof tallyForPlay>;
};

/** The card to peg, by an ordered list of preferences, ties to the higher card. */
export function choosePlay(view: View): Card {
  const pegging = view.pegging;
  if (pegging === null) throw new Error('not pegging');
  const before = pegging.sequence.map((p) => p.card);
  const leading = before.length === 0;
  const plays: Play[] = pegging.legal.map((card) => ({
    card,
    count: pegging.count + cardValue(card),
    tally: tallyForPlay(before, card),
  }));
  const has = (play: Play, kind: string) =>
    play.tally.combinations.some((c) => c.kind === kind);
  const preferences: ((play: Play) => boolean)[] = [
    (p) => p.count === MAX_COUNT,
    (p) => p.count === 15,
    (p) =>
      has(p, 'pair') ||
      has(p, 'pair-royal') ||
      has(p, 'double-pair-royal') ||
      has(p, 'run'),
    // A Count of 5 or 21 hands the other Seat a Fifteen or Thirty-One, and a
    // led five is fifteened by any ten-card.
    (p) => p.count !== 5 && p.count !== 21 && !(leading && p.card.rank === 5),
    (p) => !leading || p.card.rank <= 4,
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
