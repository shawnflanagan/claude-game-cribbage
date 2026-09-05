import { describe, expect, it } from 'vitest';
import { replay } from '../engine';
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
    const replayed = replay(2, played.actions);
    if (!replayed.ok) throw new Error(replayed.violation);
    expect(replayed.state).toEqual(played.state);
    expect(replayed.events).toEqual(played.events);
  });

  it('names the seed when an opponent chooses an illegal Action', () => {
    const cheat = (view: Parameters<typeof randomOpponent>[0]) => {
      const card = view.hand[0];
      if (card === undefined) throw new Error('empty hand');
      return {
        value: { type: 'play' as const, seat: view.seat, card },
        rng: { state: 0 },
      };
    };
    expect(() => playout(3, [cheat, cheat])).toThrow(/Seed 3/);
  });
});
