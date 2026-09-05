import type { Action, Draw, Rng, View } from '../engine';

/**
 * A computer opponent: a pure function from what its Seat can see to the
 * Action it takes, with randomness passed in so it stays deterministic.
 * Only ever called when `view.seat` is one of the Seats to act.
 */
export type Opponent = (view: View, rng: Rng) => Draw<Action>;
