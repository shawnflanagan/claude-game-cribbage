import { describe, expect, it } from 'vitest';
import { parseCard, parseCards, type Card } from './cards';
import {
  legalCards,
  playCard,
  startPegging,
  type PeggingEvent,
  type PeggingState,
} from './pegging';
import type { Seat } from './seat';

/** Plays a scripted list of [seat, card] moves, failing loudly on a Violation. */
function play(
  state: PeggingState,
  moves: readonly [Seat, string][],
): { state: PeggingState; events: PeggingEvent[] } {
  const events: PeggingEvent[] = [];
  let current = state;
  for (const [seat, text] of moves) {
    const result = playCard(current, seat, parseCard(text));
    if (!result.ok) {
      throw new Error(
        `Unexpected Violation ${result.violation} playing ${text} as Seat ${String(seat)}`,
      );
    }
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

function tallies(events: readonly PeggingEvent[], seat: Seat) {
  return events.flatMap((e) =>
    e.type === 'tally' && e.seat === seat ? e.tally.combinations : [],
  );
}

function kinds(events: readonly PeggingEvent[], seat: Seat): string[] {
  return tallies(events, seat).map((c) => c.kind);
}

function start(seat0: string, seat1: string, leader: Seat = 0): PeggingState {
  return startPegging([parseCards(seat0), parseCards(seat1)], leader);
}

const ranks = (cards: readonly Card[]) => cards.map((c) => c.rank);

describe('Pegging: legal plays and turns', () => {
  it('lets the leader play any card and sets the Count to its value', () => {
    const { state } = play(start('7H 8H 9H TH', 'AS 2S 3S 4S'), [[0, '7H']]);
    expect(state.count).toBe(7);
    expect(state.turn).toBe(1);
  });

  it('alternates turns while both Seats can play', () => {
    const { state } = play(start('7H 8H 9H TH', 'AS 2S 3S 4S'), [
      [0, '7H'],
      [1, '2S'],
      [0, '8H'],
    ]);
    expect(state.count).toBe(17);
    expect(state.turn).toBe(1);
  });

  it('refuses a play out of turn and leaves the state unchanged', () => {
    const before = start('7H 8H 9H TH', 'AS 2S 3S 4S');
    const result = playCard(before, 1, parseCard('AS'));
    expect(result).toEqual({ ok: false, violation: 'not-your-turn' });
  });

  it('refuses a card the Seat does not hold', () => {
    const result = playCard(
      start('7H 8H 9H TH', 'AS 2S 3S 4S'),
      0,
      parseCard('KD'),
    );
    expect(result).toEqual({ ok: false, violation: 'card-not-in-hand' });
  });

  it('refuses a card that would take the Count past 31', () => {
    const { state } = play(start('TH JH 5H 6H', 'KS QS AS 8S'), [
      [0, 'TH'],
      [1, 'KS'],
      [0, 'JH'],
    ]);
    const result = playCard(state, 1, parseCard('QS'));
    expect(result).toEqual({ ok: false, violation: 'count-would-exceed-31' });
    expect(state.count).toBe(30);
  });

  it('lists only the cards that keep the Count at or below 31', () => {
    const { state } = play(start('TH JH 5H 6H', 'KS QS AS 8S'), [
      [0, 'TH'],
      [1, 'KS'],
      [0, 'JH'],
    ]);
    expect(ranks(legalCards(state, 1))).toEqual([1]);
  });

  it('lists no legal cards for a Seat whose every card would pass 31', () => {
    const { state } = play(start('TH JH 5H 6H', 'KS QS AS 8S'), [
      [0, 'TH'],
      [1, 'KS'],
      [0, 'JH'],
    ]);
    expect(legalCards(state, 0)).toEqual([]);
  });
});

describe('Pegging: Combinations', () => {
  it('scores a Fifteen for two', () => {
    const { events } = play(start('7H 2H 3H 4H', '8S 2S 3S 4S'), [
      [0, '7H'],
      [1, '8S'],
    ]);
    expect(tallies(events, 1)).toEqual([
      expect.objectContaining({ kind: 'fifteen', points: 2 }),
    ]);
  });

  it('scores a Pair for two, a Pair Royal for six, and a Double Pair Royal for twelve', () => {
    const { events } = play(start('4H 4D AH 2H', '4S 4C AS 2S'), [
      [0, '4H'],
      [1, '4S'],
      [0, '4D'],
      [1, '4C'],
    ]);
    expect(kinds(events, 1)).toEqual(['pair', 'double-pair-royal']);
    expect(kinds(events, 0)).toEqual(['pair-royal']);
    expect(tallies(events, 1).map((c) => c.points)).toEqual([2, 12]);
    expect(tallies(events, 0).map((c) => c.points)).toEqual([6]);
  });

  it('scores a Run played out of order, one point per card', () => {
    const { events } = play(start('3H 4H KH QH', '5S KS QS JS'), [
      [0, '3H'],
      [1, '5S'],
      [0, '4H'],
    ]);
    expect(tallies(events, 0)).toEqual([
      expect.objectContaining({ kind: 'run', points: 3 }),
    ]);
  });

  it('scores only the longest Run ending in the played card', () => {
    const { events } = play(start('5H 7H AH 2H', '6S 8S 4S AS'), [
      [0, '5H'],
      [1, '6S'],
      [0, '7H'],
      [1, '8S'],
    ]);
    // 5 6 7 is a run of three; 5 6 7 8 is one run of four, not also 6 7 8.
    expect(tallies(events, 0).map((c) => c.points)).toEqual([3]);
    expect(tallies(events, 1).map((c) => c.points)).toEqual([4]);
    expect(kinds(events, 1)).toEqual(['run']);
  });

  it('scores a Run of five', () => {
    const { events } = play(start('2H 4H 6H 8H', '3S 5S 7S 9S'), [
      [0, '2H'],
      [1, '3S'],
      [0, '4H'],
      [1, '5S'],
      [0, '6H'],
    ]);
    expect(tallies(events, 0).map((c) => c.points)).toEqual([3, 5]);
    expect(tallies(events, 1).map((c) => c.points)).toEqual([4]);
  });

  it('does not let a Pair or Run reach back across a Count reset', () => {
    const { events } = play(start('TH JH AH 2H', 'KS AS 2S 3S'), [
      [0, 'TH'],
      [1, 'KS'],
      [0, 'JH'],
      [1, 'AS'],
      [0, 'AH'],
      [1, '2S'],
    ]);
    // AS made Thirty-One and reset the Count; AH and 2S start a new sequence.
    expect(kinds(events, 0)).toEqual([]);
    expect(kinds(events, 1)).toEqual(['thirty-one']);
  });

  it('names every card in the sequence for a Fifteen', () => {
    const { events } = play(start('7H 2H 3H 4H', '8S 2S 3S 4S'), [
      [0, '7H'],
      [1, '8S'],
    ]);
    expect(tallies(events, 1)[0]?.cards).toEqual(parseCards('7H 8S'));
  });

  it('does not score a Run broken by an intervening card', () => {
    const { events } = play(start('4H KH 2H 3H', '5S 6S QS JS'), [
      [0, '4H'],
      [1, '5S'],
      [0, 'KH'],
      [1, '6S'],
    ]);
    expect(kinds(events, 0)).toEqual([]);
    expect(kinds(events, 1)).toEqual([]);
  });

  it('scores a Fifteen and a Pair on the same play', () => {
    const { events } = play(start('3H 6D AH 2H', '6C AS 2S 4S'), [
      [0, '3H'],
      [1, '6C'],
      [0, '6D'],
    ]);
    expect(kinds(events, 0)).toEqual(['fifteen', 'pair']);
    expect(tallies(events, 0).map((c) => c.points)).toEqual([2, 2]);
  });

  it('scores Thirty-One for two and resets the Count without a Last Card point', () => {
    const { state, events } = play(start('TH JH 5H 6H', 'KS AS 9S 8S'), [
      [0, 'TH'],
      [1, 'KS'],
      [0, 'JH'],
      [1, 'AS'],
    ]);
    expect(kinds(events, 1)).toEqual(['thirty-one']);
    expect(kinds(events, 0)).toEqual([]);
    expect(state.count).toBe(0);
    expect(state.turn).toBe(0);
  });
});

describe('Pegging: Go and sequence ends', () => {
  it('after a Go, Last Card goes to the Seat that played last and the Seat that went leads next', () => {
    const { state, events } = play(start('TH JH', 'KS 9S 2S'), [
      [0, 'TH'],
      [1, 'KS'],
      [0, 'JH'],
    ]);
    expect(events.filter((e) => e.type === 'go')).toEqual([
      { type: 'go', seat: 1 },
    ]);
    expect(kinds(events, 0)).toEqual(['last-card']);
    expect(tallies(events, 0).map((c) => c.points)).toEqual([1]);
    expect(events.at(-1)).toEqual({ type: 'sequence-ended', leader: 1 });
    expect(state.count).toBe(0);
    expect(state.turn).toBe(1);
  });

  it('after a Go, the other Seat plays on while it can, and the Go is said only once', () => {
    const { state, events } = play(start('TH 9H JH AH', 'KS 8S 7S 6S'), [
      [0, 'TH'],
      [1, 'KS'],
      [0, '9H'],
      [0, 'AH'],
    ]);
    expect(events.filter((e) => e.type === 'go')).toEqual([
      { type: 'go', seat: 1 },
    ]);
    expect(kinds(events, 0)).toEqual(['last-card']);
    expect(state.count).toBe(0);
    expect(state.turn).toBe(1);
  });

  it('when neither Seat can play and both hold cards, only the first is asked to say Go', () => {
    const { state, events } = play(start('TH JH 9H', 'KS QS 8S'), [
      [0, 'TH'],
      [1, 'KS'],
      [0, 'JH'],
    ]);
    expect(events.filter((e) => e.type === 'go')).toEqual([
      { type: 'go', seat: 1 },
    ]);
    expect(kinds(events, 0)).toEqual(['last-card']);
    expect(state.count).toBe(0);
    expect(state.turn).toBe(1);
  });

  it('lets Seat 1 lead when it is the Pone', () => {
    const state = start('7H 8H 9H TH', 'AS 2S 3S 4S', 1);
    expect(state.turn).toBe(1);
    expect(playCard(state, 0, parseCard('7H'))).toEqual({
      ok: false,
      violation: 'not-your-turn',
    });
    expect(play(state, [[1, 'AS']]).state.count).toBe(1);
  });

  it('after a Go, the other Seat may keep playing until it reaches exactly 31', () => {
    const { state, events } = play(start('TH JH 5H', '8S AS 2S'), [
      [0, 'TH'],
      [1, '8S'],
      [0, 'JH'],
      [1, 'AS'],
      [1, '2S'],
    ]);
    expect(events.filter((e) => e.type === 'go')).toEqual([
      { type: 'go', seat: 0 },
    ]);
    expect(kinds(events, 1)).toEqual(['thirty-one']);
    expect(kinds(events, 0)).toEqual([]);
    expect(state.turn).toBe(0);
    expect(state.count).toBe(0);
  });

  it('when the last Seat to play is out of cards and the other is at Go, Last Card scores one and the other leads', () => {
    const { state, events } = play(start('TH JH', 'KS QS'), [
      [0, 'TH'],
      [1, 'KS'],
      [0, 'JH'],
    ]);
    expect(kinds(events, 0)).toEqual(['last-card']);
    expect(state.count).toBe(0);
    expect(state.turn).toBe(1);
    expect(state.done).toBe(false);
  });

  it('lets a Seat play out its cards alone once the other has none left', () => {
    const { state, events } = play(start('TH JH', 'KS 9S 2S'), [
      [0, 'TH'],
      [1, 'KS'],
      [0, 'JH'],
      [1, '9S'],
      [1, '2S'],
    ]);
    expect(state.done).toBe(true);
    expect(kinds(events, 1)).toEqual(['last-card']);
    expect(events.at(-1)).toEqual({ type: 'pegging-ended' });
  });

  it('a Seat with no cards left is never asked to say Go', () => {
    const { events } = play(start('TH JH', 'KS 9S 2S'), [
      [0, 'TH'],
      [1, 'KS'],
      [0, 'JH'],
      [1, '9S'],
    ]);
    expect(events.filter((e) => e.type === 'go')).toEqual([
      { type: 'go', seat: 1 },
    ]);
  });

  it('ends after all eight cards with Last Card for the final play', () => {
    const { state, events } = play(start('AH 2H 3H 4H', 'AS 2S 3S 4S'), [
      [0, 'AH'],
      [1, 'AS'],
      [0, '2H'],
      [1, '2S'],
      [0, '3H'],
      [1, '3S'],
      [0, '4H'],
      [1, '4S'],
    ]);
    expect(state.done).toBe(true);
    expect(state.count).toBe(0);
    expect(kinds(events, 1).at(-1)).toBe('last-card');
    expect(events.at(-1)).toEqual({ type: 'pegging-ended' });
  });

  it('reports each card played with the running Count', () => {
    const { events } = play(start('7H 8H 9H TH', 'AS 2S 3S 4S'), [
      [0, '7H'],
      [1, '2S'],
    ]);
    expect(events.filter((e) => e.type === 'card-played')).toEqual([
      { type: 'card-played', seat: 0, card: parseCard('7H'), count: 7 },
      { type: 'card-played', seat: 1, card: parseCard('2S'), count: 9 },
    ]);
  });

  it('refuses any play once Pegging is done', () => {
    const { state } = play(start('AH', 'AS'), [
      [0, 'AH'],
      [1, 'AS'],
    ]);
    expect(state.done).toBe(true);
    expect(playCard(state, 0, parseCard('AH'))).toEqual({
      ok: false,
      violation: 'wrong-phase',
    });
  });
});
