import { describe, expect, it } from 'vitest';
import { fullDeck, sameCard } from './cards';
import { createRng, nextInt, shuffle } from './random';

describe('seeded randomness', () => {
  it('produces the same sequence from the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const drawA = [nextInt(a, 52), nextInt(nextInt(a, 52).rng, 52)];
    const drawB = [nextInt(b, 52), nextInt(nextInt(b, 52).rng, 52)];
    expect(drawA.map((d) => d.value)).toEqual(drawB.map((d) => d.value));
  });

  it('produces different sequences from different seeds', () => {
    const fromA = shuffle(fullDeck(), createRng(1)).items;
    const fromB = shuffle(fullDeck(), createRng(2)).items;
    expect(fromA).not.toEqual(fromB);
  });

  it('never returns an int outside the requested bound', () => {
    let rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const draw = nextInt(rng, 13);
      expect(draw.value).toBeGreaterThanOrEqual(0);
      expect(draw.value).toBeLessThan(13);
      rng = draw.rng;
    }
  });

  it('shuffles into a permutation of the whole deck', () => {
    const deck = fullDeck();
    const shuffled = shuffle(deck, createRng(99)).items;
    expect(shuffled).toHaveLength(52);
    for (const card of deck) {
      expect(shuffled.some((c) => sameCard(c, card))).toBe(true);
    }
    expect(shuffled).not.toEqual(deck);
  });

  it('does not mutate the input when shuffling', () => {
    const deck = fullDeck();
    const before = [...deck];
    shuffle(deck, createRng(3));
    expect(deck).toEqual(before);
  });

  it('shuffling the same seed twice gives identical order', () => {
    expect(shuffle(fullDeck(), createRng(2024)).items).toEqual(
      shuffle(fullDeck(), createRng(2024)).items,
    );
  });
});
