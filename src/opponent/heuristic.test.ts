import { describe, expect, it } from 'vitest';
import {
  createRng,
  otherSeat,
  parseCard,
  parseCards,
  sameCard,
  type Card,
  type Seat,
  type View,
} from '../engine';
import {
  chooseDiscard,
  choosePlay,
  cribValue,
  heuristicOpponent,
} from './heuristic';
import { playout } from './playout';
import { randomOpponent } from './random';

function discardView(hand: string, dealer: Seat, seat: Seat = 1): View {
  return {
    seat,
    phase: 'discard',
    scores: [0, 0],
    dealer,
    round: 1,
    result: null,
    hand: parseCards(hand),
    otherHandSize: 6,
    cribSize: 0,
    starter: null,
    discarded: [false, false],
    pegging: null,
  };
}

function peggingView(hand: string, played: string, seat: Seat = 1): View {
  const cards = parseCards(hand);
  const sequence = played.trim() === '' ? [] : parseCards(played);
  const count = sequence.reduce((sum, c) => sum + Math.min(c.rank, 10), 0);
  return {
    seat,
    phase: 'pegging',
    scores: [0, 0],
    dealer: otherSeat(seat),
    round: 1,
    result: null,
    hand: [],
    otherHandSize: 4,
    cribSize: 4,
    starter: parseCard('KD'),
    discarded: [true, true],
    pegging: {
      count,
      sequence: sequence.map((card, i) => ({ seat: (i % 2) as Seat, card })),
      turn: seat,
      done: false,
      hand: cards,
      otherHandSize: 4 - Math.ceil(sequence.length / 2),
      legal: cards.filter((c) => count + Math.min(c.rank, 10) <= 31),
    },
  };
}

const names = (cards: readonly Card[]) =>
  cards.map((c) => `${String(c.rank)}${c.suit[0] ?? ''}`).sort();

describe('heuristic Discard', () => {
  it('keeps the four cards worth most in the Show', () => {
    const view = discardView('5H 5S 5D JC 2H 7D', 1);
    const discard = chooseDiscard(view);
    expect(names(discard)).toEqual(names(parseCards('2H 7D')));
  });

  it('keeps a run-and-pair hand over scattered high cards', () => {
    const view = discardView('4H 5S 6D 6C KH QD', 1);
    expect(names(chooseDiscard(view))).toEqual(names(parseCards('KH QD')));
  });

  it('values a Crib Discard higher as Dealer than as Pone', () => {
    const pair = parseCards('5H TD');
    expect(cribValue(pair)).toBeGreaterThan(cribValue(parseCards('2H 9D')));
    expect(cribValue(parseCards('7H 7D'))).toBeGreaterThan(0);
    expect(cribValue(parseCards('7H 8D'))).toBeGreaterThan(0);
  });

  it('can keep a different four as Dealer than as Pone from the same six', () => {
    // Search a few hands for one where the Crib adjustment flips the choice.
    const hands = [
      '5H 6D 7C 8S TD JC',
      '4H 5S 6D KC 5C TS',
      '2H 3D 4C 5S TD QC',
      '5H 5S 9D TC JC KD',
      '3H 4D 5S 6C TD TS',
    ];
    const flipped = hands.find((hand) => {
      const asDealer = names(chooseDiscard(discardView(hand, 1, 1)));
      const asPone = names(chooseDiscard(discardView(hand, 0, 1)));
      return JSON.stringify(asDealer) !== JSON.stringify(asPone);
    });
    expect(flipped).toBeDefined();
    if (flipped === undefined) return;
    const dealerDiscard = chooseDiscard(discardView(flipped, 1, 1));
    const poneDiscard = chooseDiscard(discardView(flipped, 0, 1));
    expect(cribValue(dealerDiscard)).toBeGreaterThan(cribValue(poneDiscard));
  });

  it('always discards two distinct cards from its own Hand', () => {
    const view = discardView('AH 2S 3D 4C 5H 6D', 0);
    const [a, b] = chooseDiscard(view);
    expect(sameCard(a, b)).toBe(false);
    expect(view.hand.some((c) => sameCard(c, a))).toBe(true);
    expect(view.hand.some((c) => sameCard(c, b))).toBe(true);
  });

  it('decides quickly', () => {
    const view = discardView('5H 6D 7C 8S TD JC', 1);
    const start = performance.now();
    for (let i = 0; i < 10; i++) chooseDiscard(view);
    expect((performance.now() - start) / 10).toBeLessThan(50);
  });
});

describe('heuristic Pegging', () => {
  it('makes Thirty-One when it can', () => {
    // Count 26: the 5 makes 31, the 4 makes 30, the 2 makes 28.
    const view = peggingView('5H 4S 2D 9C', 'TH 8S 8D');
    expect(choosePlay(view)).toEqual(parseCard('5H'));
  });

  it('makes Fifteen when it can, ahead of a Pair', () => {
    // Count 7 after a 7: the 8 makes 15, the 7 makes a Pair.
    const view = peggingView('8H 7S 2D 3C', '7D');
    expect(choosePlay(view)).toEqual(parseCard('8H'));
  });

  it('makes Fifteen from a low Count', () => {
    const view = peggingView('TH 9S AD 2C', '3H 2S');
    expect(choosePlay(view)).toEqual(parseCard('TH'));
  });

  it('takes a Pair or a Run when no Fifteen or Thirty-One is on', () => {
    const pairView = peggingView('9H 2S 3D 4C', '9D');
    expect(choosePlay(pairView)).toEqual(parseCard('9H'));
    const runView = peggingView('6H 2S 3D KC', '4D 5S');
    expect(choosePlay(runView)).toEqual(parseCard('6H'));
  });

  it('avoids leaving the Count at 5 or 21', () => {
    // Count 2: the 3 would leave 5; play the 8 instead.
    const view = peggingView('3H 8S', '2D');
    expect(choosePlay(view)).toEqual(parseCard('8S'));
    // Count 17: the 4 would leave 21; play the 6 instead.
    const later = peggingView('4H 6S', 'TD 7C');
    expect(choosePlay(later)).toEqual(parseCard('6S'));
  });

  it('does not lead a five', () => {
    const view = peggingView('5H 8S', '');
    expect(choosePlay(view)).toEqual(parseCard('8S'));
  });

  it('leads a low card when it has one, so it cannot be fifteened', () => {
    const view = peggingView('4H 9S TD KC', '');
    expect(choosePlay(view)).toEqual(parseCard('4H'));
  });

  it('otherwise plays its highest legal card', () => {
    const view = peggingView('6H 9S 3D', '2C 8S');
    expect(choosePlay(view)).toEqual(parseCard('9S'));
  });

  it('only ever plays a legal card', () => {
    const view = peggingView('KH QS 2D', 'TH JS 8D');
    expect(choosePlay(view)).toEqual(parseCard('2D'));
  });
});

describe('heuristic opponent as a whole', () => {
  it('returns Actions for its own Seat and leaves the randomness untouched', () => {
    const rng = createRng(1);
    const discard = heuristicOpponent(discardView('5H 5S 5D JC 2H 7D', 1), rng);
    expect(discard.value.type).toBe('discard');
    expect(discard.value.seat).toBe(1);
    expect(discard.rng).toEqual(rng);
    const play = heuristicOpponent(peggingView('5H 4S', 'TH 8S 8D'), rng);
    expect(play.value).toEqual({
      type: 'play',
      seat: 1,
      card: parseCard('5H'),
    });
  });

  it('never chooses an illegal Action over many Games', () => {
    for (let seed = 1; seed <= 40; seed++) {
      expect(() =>
        playout(seed, [heuristicOpponent, heuristicOpponent]),
      ).not.toThrow();
    }
  });

  it('beats the random opponent at least 70% of the time, in either Seat', () => {
    let wins = 0;
    const games = 200;
    for (let seed = 1; seed <= games; seed++) {
      const seatOfHeuristic: Seat = seed % 2 === 0 ? 0 : 1;
      const opponents =
        seatOfHeuristic === 0
          ? ([heuristicOpponent, randomOpponent] as const)
          : ([randomOpponent, heuristicOpponent] as const);
      const { state } = playout(seed, opponents);
      if (state.result?.winner === seatOfHeuristic) wins++;
    }
    expect(wins / games).toBeGreaterThanOrEqual(0.7);
  }, 60_000);
});
