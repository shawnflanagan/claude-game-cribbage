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
} from '../engine';
import type { Opponent } from './opponent';

/**
 * A test harness, not part of the game: plays a whole Game headlessly with
 * an opponent in each Seat. Throws on an illegal Action because that is a
 * bug in an opponent, not a Violation a player can make.
 */
export type Playout = {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  /** Every Action taken, in order: with the seed, enough to replay the Game. */
  readonly actions: readonly Action[];
};

// A Game to 121 takes a few hundred Actions at most. Far more than that
// means the engine has stopped making progress, which is a bug to surface.
const MAX_ACTIONS = 10_000;

export function playout(
  seed: number,
  opponents: PerSeat<Opponent>,
  options: NewGameOptions = {},
): Playout {
  const start = newGame(seed, options);
  let state = start.state;
  const events: GameEvent[] = [...start.events];
  const actions: Action[] = [];
  // Each Seat draws from its own stream, derived from the Game seed, so one
  // Seat's choices never shift the other's.
  let rngs: PerSeat<Rng> = [createRng(seed * 2 + 1), createRng(seed * 2 + 2)];
  for (let taken = 0; taken < MAX_ACTIONS; taken++) {
    const seat = seatsToAct(viewFor(state, 0))[0];
    if (seat === undefined) return { state, events, actions };
    const choice = opponents[seat](viewFor(state, seat), rngs[seat]);
    rngs = seat === 0 ? [choice.rng, rngs[1]] : [rngs[0], choice.rng];
    const result = apply(state, choice.value);
    if (!result.ok) {
      throw new Error(
        `Seed ${String(seed)}: opponent in Seat ${String(seat)} chose an illegal Action (${result.violation}) after ${String(actions.length)} Actions`,
      );
    }
    state = result.state;
    events.push(...result.events);
    actions.push(choice.value);
  }
  throw new Error(
    `Seed ${String(seed)}: no winner after ${String(MAX_ACTIONS)} Actions`,
  );
}
