import { describe, expect, it } from 'vitest';
import { createRng, newGame, sameCard, seatsToAct, viewFor } from '../engine';
import { randomOpponent } from './random';

describe('random opponent', () => {
  it('discards exactly two cards from its own Hand', () => {
    const { state } = newGame(4);
    const seat = seatsToAct(viewFor(state, 0))[0];
    if (seat === undefined) throw new Error('nobody to act');
    const view = viewFor(state, seat);
    const { value: action } = randomOpponent(view, createRng(1));
    expect(action.type).toBe('discard');
    if (action.type !== 'discard') return;
    expect(action.seat).toBe(seat);
    expect(action.cards).toHaveLength(2);
    const [a, b] = action.cards;
    if (a === undefined || b === undefined) throw new Error('short discard');
    expect(sameCard(a, b)).toBe(false);
    for (const card of action.cards) {
      expect(view.hand.some((c) => sameCard(c, card))).toBe(true);
    }
  });

  it('is deterministic for the same View and seed', () => {
    const view = viewFor(newGame(4).state, 0);
    const a = randomOpponent(view, createRng(9)).value;
    const b = randomOpponent(view, createRng(9)).value;
    expect(a).toEqual(b);
  });

  it('varies its choice with the seed', () => {
    const view = viewFor(newGame(4).state, 0);
    const choices = new Set(
      Array.from({ length: 20 }, (_, i) =>
        JSON.stringify(randomOpponent(view, createRng(i)).value),
      ),
    );
    expect(choices.size).toBeGreaterThan(1);
  });
});
