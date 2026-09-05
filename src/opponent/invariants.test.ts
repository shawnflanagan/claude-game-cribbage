import { beforeAll, describe, expect, it } from 'vitest';
import { apply, newGame, sameCard, type Card, type GameEvent } from '../engine';
import { heuristicOpponent } from './heuristic';
import { playout, type Playout } from './playout';
import { randomOpponent } from './random';

// An integration test of the engine, driven from this layer because only
// the opponent layer may hold both the engine and a player.

const GAMES = 200;

type Game = Playout & { seed: number };

/** Splits a Game's Events into Rounds by the deal that starts each one. */
function rounds(events: readonly GameEvent[]): GameEvent[][] {
  const result: GameEvent[][] = [];
  for (const event of events) {
    if (event.type === 'dealt') result.push([]);
    result.at(-1)?.push(event);
  }
  return result;
}

const sameSet = (a: readonly Card[], b: readonly Card[]) =>
  a.length === b.length && a.every((c) => b.some((d) => sameCard(c, d)));

describe(`invariants over ${String(GAMES)} Games`, () => {
  let games: Game[] = [];
  beforeAll(() => {
    // The heuristic opponent takes a Seat in every other Game, so both
    // opponents are proven never to choose an illegal Action here.
    games = Array.from({ length: GAMES }, (_, i) => ({
      seed: i + 1,
      ...playout(
        i + 1,
        i % 2 === 0
          ? [randomOpponent, heuristicOpponent]
          : [heuristicOpponent, randomOpponent],
      ),
    }));
  });

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

  it('every completed Round plays exactly eight cards, none twice', () => {
    for (const { seed, events } of games) {
      for (const round of rounds(events)) {
        const played = round
          .filter((e) => e.type === 'card-played')
          .map((e) => e.card);
        if (round.some((e) => e.type === 'pegging-ended')) {
          expect(played, `seed ${String(seed)}`).toHaveLength(8);
        }
        for (const card of played) {
          expect(
            played.filter((c) => sameCard(c, card)),
            `seed ${String(seed)}`,
          ).toHaveLength(1);
        }
      }
    }
  });

  it('every Round that reaches the Starter has two Discards and a Crib of four', () => {
    for (const { seed, events } of games) {
      for (const round of rounds(events)) {
        if (!round.some((e) => e.type === 'starter-cut')) continue;
        const discards = round.filter((e) => e.type === 'discarded');
        expect(
          discards.map((d) => d.seat).sort(),
          `seed ${String(seed)}`,
        ).toEqual([0, 1]);
        const crib = round.find(
          (e) => e.type === 'show-counted' && e.source === 'crib',
        );
        if (crib?.type === 'show-counted') {
          expect(crib.cards, `seed ${String(seed)}`).toHaveLength(4);
        }
      }
    }
  });

  it('the Starter and Crib are never played, and each Show shows the cards that Seat pegged', () => {
    for (const { seed, events } of games) {
      for (const round of rounds(events)) {
        const played = round.filter((e) => e.type === 'card-played');
        const cards = played.map((e) => e.card);
        const starter = round.find((e) => e.type === 'starter-cut');
        if (starter?.type === 'starter-cut') {
          expect(
            cards.some((c) => sameCard(c, starter.card)),
            `seed ${String(seed)}`,
          ).toBe(false);
        }
        for (const show of round.filter((e) => e.type === 'show-counted')) {
          if (show.source === 'crib') {
            expect(
              show.cards.some((c) => cards.some((p) => sameCard(p, c))),
              `seed ${String(seed)}`,
            ).toBe(false);
          } else {
            const pegged = played
              .filter((e) => e.seat === show.seat)
              .map((e) => e.card);
            expect(sameSet(show.cards, pegged), `seed ${String(seed)}`).toBe(
              true,
            );
          }
        }
      }
    }
  });

  it('scores never go down, never exceed 121, and replay from seed and history reproduces every Game', () => {
    for (const { seed, state, events, actions } of games) {
      let current = newGame(seed).state;
      const replayed: GameEvent[] = [...newGame(seed).events];
      for (const action of actions) {
        const result = apply(current, action);
        if (!result.ok)
          throw new Error(`seed ${String(seed)}: ${result.violation}`);
        expect(
          result.state.scores[0],
          `seed ${String(seed)}`,
        ).toBeGreaterThanOrEqual(current.scores[0]);
        expect(
          result.state.scores[1],
          `seed ${String(seed)}`,
        ).toBeGreaterThanOrEqual(current.scores[1]);
        expect(
          Math.max(...result.state.scores),
          `seed ${String(seed)}`,
        ).toBeLessThanOrEqual(121);
        current = result.state;
        replayed.push(...result.events);
      }
      expect(current, `seed ${String(seed)}`).toEqual(state);
      expect(replayed, `seed ${String(seed)}`).toEqual(events);
    }
  });

  it('the scores equal the sum of every scoring Event, and every Combination is worth at least one point', () => {
    for (const { seed, state, events } of games) {
      const totals: [number, number] = [0, 0];
      for (const e of events) {
        if (
          e.type === 'tally' ||
          e.type === 'heels' ||
          e.type === 'show-counted'
        ) {
          totals[e.seat] += e.tally.total;
          for (const c of e.tally.combinations) {
            expect(c.points, `seed ${String(seed)}`).toBeGreaterThan(0);
          }
        }
        if (e.type === 'tally') {
          expect(e.tally.total, `seed ${String(seed)}`).toBeGreaterThan(0);
        }
      }
      // The winner's last Tally may overshoot 121; the score stops there.
      expect(Math.min(121, totals[0]), `seed ${String(seed)}`).toBe(
        state.scores[0],
      );
      expect(Math.min(121, totals[1]), `seed ${String(seed)}`).toBe(
        state.scores[1],
      );
    }
  });
});
