import { describe, expect, it } from 'vitest';
import {
  cardValue,
  createRng,
  otherSeat,
  parseCard,
  parseCards,
  sameCard,
  type Card,
  type PlayedCard,
  type Seat,
  type View,
} from '../engine';
import {
  CRIB_VALUES,
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

/**
 * A Pegging View for `seat` holding `remaining` with `played` on the table,
 * played alternately so that it is now `seat`'s turn.
 */
function peggingView(remaining: string, played: string, seat: Seat = 1): View {
  const cards = parseCards(remaining);
  const table = played.trim() === '' ? [] : parseCards(played);
  const other = otherSeat(seat);
  const first: Seat = table.length % 2 === 0 ? seat : other;
  const sequence: PlayedCard[] = table.map((card, i) => ({
    seat: i % 2 === 0 ? first : otherSeat(first),
    card,
  }));
  const count = table.reduce((sum, c) => sum + cardValue(c), 0);
  const mine = sequence.filter((p) => p.seat === seat).map((p) => p.card);
  const theirs = sequence.length - mine.length;
  return {
    seat,
    phase: 'pegging',
    scores: [0, 0],
    dealer: other,
    round: 1,
    result: null,
    hand: [...cards, ...mine],
    otherHandSize: 4,
    cribSize: 4,
    starter: parseCard('KD'),
    discarded: [true, true],
    pegging: {
      count,
      sequence,
      turn: seat,
      done: false,
      hand: cards,
      otherHandSize: 4 - theirs,
      legal: cards.filter((c) => count + cardValue(c) <= 31),
    },
  };
}

const names = (cards: readonly Card[]) =>
  cards.map((c) => `${String(c.rank)}${c.suit[0] ?? ''}`).sort();

describe('heuristic Discard', () => {
  it('keeps the four cards worth most in the Show', () => {
    const view = discardView('5H 5S 5D JC 2H 7D', 1);
    expect(names(chooseDiscard(view))).toEqual(names(parseCards('2H 7D')));
  });

  it('keeps a run-and-pair Hand over scattered high cards', () => {
    const view = discardView('4H 5S 6D 6C KH QD', 1);
    expect(names(chooseDiscard(view))).toEqual(names(parseCards('KH QD')));
  });

  it('rates a Discard for the Crib by pairs, fifteens, fives, and adjacent ranks', () => {
    expect(cribValue(parseCards('7H 7D'))).toBe(CRIB_VALUES.pair);
    expect(cribValue(parseCards('8H 7D'))).toBe(
      CRIB_VALUES.fifteen + CRIB_VALUES.adjacent,
    );
    expect(cribValue(parseCards('5H TD'))).toBe(
      CRIB_VALUES.fifteen + CRIB_VALUES.five,
    );
    expect(cribValue(parseCards('5H 5D'))).toBe(
      CRIB_VALUES.pair + CRIB_VALUES.five * 2,
    );
    expect(cribValue(parseCards('2H 9D'))).toBe(0);
  });

  it('keeps a different four as Dealer than as Pone from the same six', () => {
    // As Dealer the 5-10 goes to its own Crib; as Pone it keeps the fifteen
    // and throws the Computer's Crib the least useful pair.
    const hand = '2H 3D 4C 5S TD QC';
    expect(names(chooseDiscard(discardView(hand, 1, 1)))).toEqual(
      names(parseCards('5S TD')),
    );
    expect(names(chooseDiscard(discardView(hand, 0, 1)))).toEqual(
      names(parseCards('TD QC')),
    );
  });

  it('always discards two distinct cards from its own Hand', () => {
    const view = discardView('AH 2S 3D 4C 5H 6D', 0);
    const [a, b] = chooseDiscard(view);
    expect(sameCard(a, b)).toBe(false);
    expect(view.hand.some((c) => sameCard(c, a))).toBe(true);
    expect(view.hand.some((c) => sameCard(c, b))).toBe(true);
  });

  it('decides in a few milliseconds', () => {
    // Real cost is about a millisecond; the bound is loose for slow CI.
    const view = discardView('5H 6D 7C 8S TD JC', 1);
    const start = performance.now();
    for (let i = 0; i < 10; i++) chooseDiscard(view);
    expect((performance.now() - start) / 10).toBeLessThan(200);
  });
});

describe('heuristic Pegging', () => {
  it('makes Thirty-One when it can', () => {
    // Count 26: the 5 makes 31. (Making 31 is always the highest legal card.)
    const view = peggingView('5H 4S 2D 9C', 'TH 8S 8D');
    expect(choosePlay(view)).toEqual(parseCard('5H'));
  });

  it('makes Fifteen ahead of a higher card', () => {
    // Count 7: the 8 makes 15 although the 9 is higher.
    const view = peggingView('8H 9S 2D', '7D');
    expect(choosePlay(view)).toEqual(parseCard('8H'));
  });

  it('makes Fifteen ahead of a Pair', () => {
    const view = peggingView('8H 7S 2D 3C', '7D');
    expect(choosePlay(view)).toEqual(parseCard('8H'));
  });

  it('takes a Pair ahead of a higher card', () => {
    // Count 9: the 9 pairs for two although the King is higher.
    const view = peggingView('9H KS 2D', '9D');
    expect(choosePlay(view)).toEqual(parseCard('9H'));
  });

  it('takes a Run ahead of a higher card', () => {
    // Count 9 after 4 5: the 3 makes a Run although the King is higher.
    const view = peggingView('3H KS', '4D 5S');
    expect(choosePlay(view)).toEqual(parseCard('3H'));
  });

  it('takes a Pair even when it leaves the Count at 21', () => {
    const view = peggingView('9H 4C', '3S 9D');
    expect(choosePlay(view)).toEqual(parseCard('9H'));
  });

  it('avoids leaving the Count at 5 even for a lower card', () => {
    // Count 2: the 3 would leave 5, so the lower 2 goes instead.
    const view = peggingView('3H 2S', '2D');
    expect(choosePlay(view)).toEqual(parseCard('2S'));
  });

  it('avoids leaving the Count at 21 even for a lower card', () => {
    // Count 17: the 4 would leave 21, so the lower 3 goes instead.
    const view = peggingView('4H 3S', 'TD 7C');
    expect(choosePlay(view)).toEqual(parseCard('3S'));
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
