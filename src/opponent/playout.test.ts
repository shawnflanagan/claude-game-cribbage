import { describe, expect, it } from 'vitest';
import { apply, newGame, type GameEvent } from '../engine';
import { playout } from './playout';
import { randomOpponent } from './random';

describe('headless playout', () => {
  it('plays a Game to a winner with two random opponents', () => {
    const { state, events, actions } = playout(1, [
      randomOpponent,
      randomOpponent,
    ]);
    expect(state.phase).toBe('game-over');
    expect(events.at(-1)?.type).toBe('game-won');
    expect(actions.length).toBeGreaterThan(0);
  });

  it('records the Action history so the Game replays exactly', () => {
    const played = playout(2, [randomOpponent, randomOpponent]);
    let { state } = newGame(2);
    const events: GameEvent[] = [...newGame(2).events];
    for (const action of played.actions) {
      const result = apply(state, action);
      if (!result.ok) throw new Error(result.violation);
      state = result.state;
      events.push(...result.events);
    }
    expect(state).toEqual(played.state);
    expect(events).toEqual(played.events);
  });
});
