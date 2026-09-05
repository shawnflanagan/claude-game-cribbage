import {
  nextInt,
  type Action,
  type Card,
  type Draw,
  type Rng,
  type View,
} from '../engine';
import type { Opponent } from './opponent';

function pick<T>(items: readonly T[], rng: Rng): Draw<T> {
  const draw = nextInt(rng, items.length);
  const item = items[draw.value];
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
  const rest: Card[] = view.hand.filter((c) => c !== first.value);
  const second = pick(rest, first.rng);
  return {
    value: {
      type: 'discard',
      seat: view.seat,
      cards: [first.value, second.value],
    },
    rng: second.rng,
  };
};
