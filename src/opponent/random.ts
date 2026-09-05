import {
  nextInt,
  sameCard,
  type Action,
  type Draw,
  type Rng,
  type View,
} from '../engine';
import type { Opponent } from './opponent';

function pick<T>(items: readonly T[], rng: Rng): Draw<T> {
  const draw = nextInt(rng, items.length);
  const item = items[draw.value];
  // Unreachable while the engine only asks a Seat to act when it has a
  // legal card, and every Hand has six cards at Discard time.
  if (item === undefined) throw new Error('nothing to pick from');
  return { value: item, rng: draw.rng };
}

/** Discards two random cards and plays a random legal card. Never illegal. */
export const randomOpponent: Opponent = (
  view: View,
  rng: Rng,
): Draw<Action> => {
  if (view.phase === 'pegging' && view.pegging !== null) {
    const card = pick(view.pegging.legal, rng);
    return {
      value: { type: 'play', seat: view.seat, card: card.value },
      rng: card.rng,
    };
  }
  const first = pick(view.hand, rng);
  const second = pick(
    view.hand.filter((c) => !sameCard(c, first.value)),
    first.rng,
  );
  return {
    value: {
      type: 'discard',
      seat: view.seat,
      cards: [first.value, second.value],
    },
    rng: second.rng,
  };
};
