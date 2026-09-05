import {
  apply,
  createRng,
  newGame,
  seatsToAct,
  viewFor,
  type Action,
  type GameEvent,
  type GameState,
  type NewGameOptions,
  type PerSeat,
  type Rng,
  type Seat,
} from '../engine';
import type { Opponent } from './opponent';

export type Playout = {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  /** Every Action taken, in order: with the seed, enough to replay the Game. */
  readonly actions: readonly Action[];
};

/** Plays a whole Game headlessly with an opponent in each Seat. */
export function playout(
  seed: number,
  opponents: PerSeat<Opponent>,
  options: NewGameOptions = {},
): Playout {
  let { state } = newGame(seed, options);
  const events: GameEvent[] = [...newGame(seed, options).events];
  const actions: Action[] = [];
  // Each Seat draws from its own stream so one Seat's choices never shift
  // the other's.
  let rngs: PerSeat<Rng> = [createRng(seed * 2 + 1), createRng(seed * 2 + 2)];
  for (let guard = 0; guard < 10_000; guard++) {
    const seat: Seat | undefined = seatsToAct(viewFor(state, 0))[0];
    if (seat === undefined) break;
    const choice = opponents[seat](viewFor(state, seat), rngs[seat]);
    rngs = seat === 0 ? [choice.rng, rngs[1]] : [rngs[0], choice.rng];
    const result = apply(state, choice.value);
    if (!result.ok) {
      throw new Error(
        `Opponent in Seat ${String(seat)} chose an illegal Action: ${result.violation}`,
      );
    }
    state = result.state;
    events.push(...result.events);
    actions.push(choice.value);
  }
  return { state, events, actions };
}
