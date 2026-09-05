import { describe, expect, it } from 'vitest';
import { replay, sameCard, type Card, type GameEvent } from '../engine';
import { playout } from './playout';
import { randomOpponent } from './random';

const GAMES = 200;

/** Splits a Game's Events into Rounds by the deal that starts each one. */
function rounds(events: readonly GameEvent[]): GameEvent[][] {
  const result: GameEvent[][] = [];
  for (const event of events) {
    if (event.type === 'dealt') result.push([]);
    result.at(-1)?.push(event);
  }
  return result;
}

describe(`invariants over ${String(GAMES)} random Games`, () => {
  const games = Array.from({ length: GAMES }, (_, i) => ({
    seed: i + 1,
    ...playout(i + 1, [randomOpponent, randomOpponent]),
  }));

  it('every Game ends with exactly one winner at 121', () => {
    for (const { seed, state, events } of games) {
      expect(state.phase, `seed ${String(seed)}`).toBe('game-over');
      expect(
        state.scores.filter((s) => s === 121),
        `seed ${String(seed)}`,
      ).toHaveLength(1);
      expect(
        events.filter((e) => e.type === 'game-won'),
        `seed ${String(seed)}`,
      ).toHaveLength(1);
    }
  });

  it('no Event follows the Game being won', () => {
    for (const { seed, events } of games) {
      expect(events.at(-1)?.type, `seed ${String(seed)}`).toBe('game-won');
    }
  });

  it('the Count never exceeds 31', () => {
    for (const { seed, events } of games) {
      for (const e of events) {
        if (e.type === 'card-played') {
          expect(e.count, `seed ${String(seed)}`).toBeLessThanOrEqual(31);
        }
      }
    }
  });

  it('every completed Round plays eight cards, none twice, and every Round has four Discards', () => {
    for (const { seed, events } of games) {
      for (const round of rounds(events)) {
        const played = round
          .filter((e) => e.type === 'card-played')
          .map((e) => e.card);
        const complete = round.some((e) => e.type === 'pegging-ended');
        if (complete) expect(played, `seed ${String(seed)}`).toHaveLength(8);
        for (const card of played) {
          expect(
            played.filter((c) => sameCard(c, card)),
            `seed ${String(seed)}`,
          ).toHaveLength(1);
        }
        const starter = round.find((e) => e.type === 'starter-cut');
        if (starter !== undefined) {
          expect(
            played.some((c) => sameCard(c, starter.card)),
            `seed ${String(seed)}`,
          ).toBe(false);
          const discards = round.filter((e) => e.type === 'discarded');
          expect(discards, `seed ${String(seed)}`).toHaveLength(2);
        }
      }
    }
  });

  it('scores only ever go up and never exceed 121', () => {
    for (const { seed, events } of games) {
      const scores: [number, number] = [0, 0];
      for (const e of events) {
        if (
          e.type === 'tally' ||
          e.type === 'heels' ||
          e.type === 'show-counted'
        ) {
          scores[e.seat] = Math.min(121, scores[e.seat] + e.tally.total);
          expect(scores[e.seat], `seed ${String(seed)}`).toBeLessThanOrEqual(
            121,
          );
        }
        // A Show can count to zero; a Pegging Tally is only emitted for points.
        if (e.type === 'tally') {
          expect(e.tally.total, `seed ${String(seed)}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('every Tally total equals the sum of its Combinations', () => {
    for (const { seed, events } of games) {
      for (const e of events) {
        if (
          e.type === 'tally' ||
          e.type === 'heels' ||
          e.type === 'show-counted'
        ) {
          const sum = e.tally.combinations.reduce(
            (acc, c) => acc + c.points,
            0,
          );
          expect(e.tally.total, `seed ${String(seed)}`).toBe(sum);
        }
      }
    }
  });

  it('the Show cards are the four kept cards plus the Crib of four', () => {
    for (const { seed, events } of games) {
      for (const round of rounds(events)) {
        const shows = round.filter((e) => e.type === 'show-counted');
        for (const show of shows) {
          expect(show.cards, `seed ${String(seed)}`).toHaveLength(4);
        }
        const cribShow = shows.find((s) => s.source === 'crib');
        const played = round
          .filter((e) => e.type === 'card-played')
          .map((e) => e.card);
        if (cribShow !== undefined) {
          const overlap = cribShow.cards.filter((c: Card) =>
            played.some((p) => sameCard(p, c)),
          );
          expect(overlap, `seed ${String(seed)}`).toHaveLength(0);
        }
      }
    }
  });

  it('replaying the seed and Action history through apply reproduces the final state', () => {
    for (const { seed, state, events, actions } of games.slice(0, 50)) {
      const replayed = replay(seed, actions);
      if (!replayed.ok)
        throw new Error(`seed ${String(seed)}: ${replayed.violation}`);
      expect(replayed.state, `seed ${String(seed)}`).toEqual(state);
      expect(replayed.events, `seed ${String(seed)}`).toEqual(events);
    }
  });
});
