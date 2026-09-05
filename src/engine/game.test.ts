import { describe, expect, it } from 'vitest';
import { parseCard, sameCard, type Card } from './cards';
import {
  apply,
  newGame,
  viewFor,
  type Action,
  type GameEvent,
  type GameState,
} from './game';
import { legalCards } from './pegging';
import type { Seat } from './seat';

/** The simplest legal policy: discard the first two, play the first legal card. */
function firstLegalAction(state: GameState): Action | null {
  if (state.phase === 'discard') {
    const seat = state.hands.findIndex((h) => h.length === 6);
    if (seat === -1) return null;
    const [a, b] = state.hands[seat as Seat];
    if (a === undefined || b === undefined) return null;
    return { type: 'discard', seat: seat as Seat, cards: [a, b] };
  }
  if (state.phase === 'pegging' && state.pegging !== null) {
    const seat = state.pegging.turn;
    const card = legalCards(state.pegging, seat)[0];
    if (card === undefined) return null;
    return { type: 'play', seat, card };
  }
  return null;
}

type Driven = { state: GameState; events: readonly GameEvent[] };

/** Applies first-legal Actions until `until` says stop or the Game is over. */
function drive(
  start: Driven,
  until: (events: GameEvent[], state: GameState) => boolean = () => false,
): Driven {
  let { state } = start;
  const events = [...start.events];
  for (let step = 0; step < 2000; step++) {
    if (state.phase === 'game-over' || until(events, state)) break;
    const action = firstLegalAction(state);
    if (action === null) throw new Error(`No action in phase ${state.phase}`);
    const result = apply(state, action);
    if (!result.ok) {
      throw new Error(`Unexpected Violation ${result.violation}`);
    }
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

const untilRoundEnds = (events: GameEvent[]) =>
  events.some((e) => e.type === 'round-ended');

const types = (events: readonly GameEvent[]) => events.map((e) => e.type);

function findSeed(predicate: (seed: number) => boolean, from = 1): number {
  for (let seed = from; seed < from + 5000; seed++) {
    if (predicate(seed)) return seed;
  }
  throw new Error('No seed satisfied the predicate');
}

describe('Game: cut for deal and the deal', () => {
  it('cuts for deal and gives the deal to the lower card, Ace low', () => {
    const { state, events } = newGame(1);
    const cuts = events.filter((e) => e.type === 'cut-for-deal');
    const last = cuts.at(-1);
    expect(last?.type).toBe('cut-for-deal');
    if (last?.type !== 'cut-for-deal') return;
    expect(last.dealer).not.toBeNull();
    const [a, b] = last.cuts;
    expect(state.dealer).toBe(a.rank < b.rank ? 0 : 1);
  });

  it('re-cuts on a tie until the cut decides', () => {
    const seed = findSeed(
      (s) =>
        newGame(s).events.filter((e) => e.type === 'cut-for-deal').length > 1,
    );
    const { events } = newGame(seed);
    const cuts = events.filter((e) => e.type === 'cut-for-deal');
    const first = cuts[0];
    expect(first?.type === 'cut-for-deal' && first.dealer).toBeNull();
    expect(first?.type === 'cut-for-deal' && first.cuts[0].rank).toBe(
      first?.type === 'cut-for-deal' ? first.cuts[1].rank : -1,
    );
    const last = cuts.at(-1);
    expect(last?.type === 'cut-for-deal' && last.dealer).not.toBeNull();
  });

  it('deals six cards to each Seat and enters the Discard phase', () => {
    const { state, events } = newGame(7);
    expect(state.phase).toBe('discard');
    expect(state.round).toBe(1);
    expect(state.hands[0]).toHaveLength(6);
    expect(state.hands[1]).toHaveLength(6);
    expect(state.crib).toHaveLength(0);
    expect(state.starter).toBeNull();
    expect(types(events).at(-1)).toBe('dealt');
  });

  it('deals distinct cards', () => {
    const { state } = newGame(11);
    const all = [...state.hands[0], ...state.hands[1]];
    for (const card of all) {
      expect(all.filter((c) => sameCard(c, card))).toHaveLength(1);
    }
  });

  it('starts from the given scores when asked, for tests and handicaps', () => {
    const { state } = newGame(3, { scores: [100, 50] });
    expect(state.scores).toEqual([100, 50]);
  });
});

describe('Game: Discard, Starter, and Heels', () => {
  it('moves both Discards to the Crib and cuts the Starter once both have discarded', () => {
    const { state, events } = drive(
      newGame(5),
      (_, s) => s.phase !== 'discard',
    );
    expect(state.phase).toBe('pegging');
    expect(state.hands[0]).toHaveLength(4);
    expect(state.hands[1]).toHaveLength(4);
    expect(state.crib).toHaveLength(4);
    expect(state.starter).not.toBeNull();
    expect(types(events)).toContain('discarded');
    expect(types(events)).toContain('starter-cut');
  });

  it('lets either Seat discard first', () => {
    const { state } = newGame(5);
    const other = state.hands[1];
    const [a, b] = other;
    if (a === undefined || b === undefined) throw new Error('short hand');
    const result = apply(state, { type: 'discard', seat: 1, cards: [a, b] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('discard');
    expect(result.state.hands[1]).toHaveLength(4);
    expect(result.state.crib).toHaveLength(2);
  });

  it('the Pone leads the first Pegging card', () => {
    const { state } = drive(newGame(5), (_, s) => s.phase !== 'discard');
    expect(state.pegging?.turn).toBe(state.dealer === 0 ? 1 : 0);
  });

  it('scores Heels for the Dealer when the Starter is a Jack', () => {
    const seed = findSeed((s) => {
      const { state, events } = drive(
        newGame(s),
        (_, st) => st.phase !== 'discard',
      );
      return (
        state.starter?.rank === 11 && events.some((e) => e.type === 'heels')
      );
    });
    const { state, events } = drive(
      newGame(seed),
      (_, s) => s.phase !== 'discard',
    );
    const heels = events.find((e) => e.type === 'heels');
    expect(heels?.type === 'heels' && heels.seat).toBe(state.dealer);
    expect(heels?.type === 'heels' && heels.tally.total).toBe(2);
    expect(state.scores[state.dealer]).toBe(2);
  });

  it('does not score Heels when the Starter is not a Jack', () => {
    const seed = findSeed((s) => {
      const { state } = drive(newGame(s), (_, st) => st.phase !== 'discard');
      return state.starter?.rank !== 11;
    });
    const { state, events } = drive(
      newGame(seed),
      (_, s) => s.phase !== 'discard',
    );
    expect(events.some((e) => e.type === 'heels')).toBe(false);
    expect(state.scores).toEqual([0, 0]);
  });
});

describe('Game: the Show and the next Round', () => {
  it('counts Pone, then Dealer, then the Crib, and adds each Tally to the score', () => {
    const { state, events } = drive(newGame(13), untilRoundEnds);
    const shows = events.filter((e) => e.type === 'show-counted');
    expect(shows.map((e) => e.source)).toEqual(['hand', 'hand', 'crib']);
    const dealerBefore = state.dealer === 0 ? 1 : 0; // dealer flipped for round 2
    const pone = dealerBefore === 0 ? 1 : 0;
    expect(shows.map((e) => e.seat)).toEqual([
      pone,
      dealerBefore,
      dealerBefore,
    ]);
  });

  it('scores reflect every Tally in the Round', () => {
    const { state, events } = drive(newGame(13), untilRoundEnds);
    const expected: [number, number] = [0, 0];
    for (const e of events) {
      if (
        e.type === 'tally' ||
        e.type === 'heels' ||
        e.type === 'show-counted'
      ) {
        expected[e.seat] += e.tally.total;
      }
    }
    expect(state.scores).toEqual(expected);
  });

  it('alternates the Dealer and deals the next Round automatically', () => {
    const first = newGame(13);
    const { state } = drive(first, untilRoundEnds);
    expect(state.round).toBe(2);
    expect(state.dealer).toBe(first.state.dealer === 0 ? 1 : 0);
    expect(state.phase).toBe('discard');
    expect(state.hands[0]).toHaveLength(6);
    expect(state.hands[1]).toHaveLength(6);
    expect(state.crib).toHaveLength(0);
    expect(state.starter).toBeNull();
  });

  it('shows the Crib to the Dealer in the Show event', () => {
    const { events } = drive(newGame(13), untilRoundEnds);
    const crib = events.find(
      (e) => e.type === 'show-counted' && e.source === 'crib',
    );
    expect(crib?.type === 'show-counted' && crib.cards).toHaveLength(4);
  });
});

describe('Game: winning', () => {
  it('plays a complete Game from a fixed seed to a winner', () => {
    const { state, events } = drive(newGame(2026));
    expect(state.phase).toBe('game-over');
    expect(state.result).not.toBeNull();
    expect(Math.max(...state.scores)).toBe(121);
    expect(types(events).at(-1)).toBe('game-won');
    // Characterisation of this seed; change deliberately if the rules change.
    expect({ round: state.round, scores: state.scores, result: state.result })
      .toMatchInlineSnapshot(`
        {
          "result": {
            "scores": [
              121,
              109,
            ],
            "skunk": "none",
            "winner": 0,
          },
          "round": 12,
          "scores": [
            121,
            109,
          ],
        }
      `);
  });

  it('is deterministic: the same seed and Actions give an identical final state', () => {
    const a = drive(newGame(77));
    const b = drive(newGame(77));
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);
  });

  it('ends the Game the instant Heels reaches 121', () => {
    const seed = findSeed((s) => {
      const { events } = drive(newGame(s), (_, st) => st.phase !== 'discard');
      return events.some((e) => e.type === 'heels');
    });
    const dealer = newGame(seed).state.dealer;
    const scores: [number, number] = dealer === 0 ? [119, 0] : [0, 119];
    const { state, events } = drive(newGame(seed, { scores }));
    expect(state.phase).toBe('game-over');
    expect(state.result?.winner).toBe(dealer);
    expect(types(events).filter((t) => t === 'card-played')).toHaveLength(0);
    expect(types(events).at(-1)).toBe('game-won');
  });

  it('ends the Game the instant a Pegging Tally reaches 121, with no Show', () => {
    const seed = findSeed((s) => {
      const { state } = drive(newGame(s), (_, st) => st.phase !== 'discard');
      return state.starter?.rank !== 11;
    });
    const { state, events } = drive(newGame(seed, { scores: [120, 120] }));
    expect(state.phase).toBe('game-over');
    expect(types(events)).toContain('card-played');
    expect(types(events)).not.toContain('show-counted');
    expect(types(events).at(-1)).toBe('game-won');
    expect(Math.max(...state.scores)).toBe(121);
  });

  it('ends after the Pone counts, so the Dealer never counts', () => {
    const seed = findSeed((s) => {
      const dealer = newGame(s).state.dealer;
      const scores: [number, number] = dealer === 0 ? [0, 120] : [120, 0];
      const { events } = drive(newGame(s, { scores }));
      const shows = events.filter((e) => e.type === 'show-counted');
      return shows.length === 1 && events.at(-1)?.type === 'game-won';
    });
    const dealer = newGame(seed).state.dealer;
    const pone = dealer === 0 ? 1 : 0;
    const scores: [number, number] = dealer === 0 ? [0, 120] : [120, 0];
    const { state, events } = drive(newGame(seed, { scores }));
    const shows = events.filter((e) => e.type === 'show-counted');
    expect(shows.map((e) => e.seat)).toEqual([pone]);
    expect(state.result?.winner).toBe(pone);
  });

  it('never lets a score pass 121', () => {
    const { state } = drive(newGame(5, { scores: [120, 120] }));
    expect(Math.max(...state.scores)).toBe(121);
  });

  it('records a Skunk when the loser is under 91', () => {
    const { state } = drive(newGame(9, { scores: [120, 80] }));
    expect(state.result?.skunk).toBe('skunk');
  });

  it('records a Double Skunk when the loser is under 61', () => {
    const { state } = drive(newGame(9, { scores: [120, 30] }));
    expect(state.result?.skunk).toBe('double-skunk');
  });

  it('records no Skunk when the loser has 91 or more', () => {
    const { state } = drive(newGame(9, { scores: [120, 100] }));
    expect(state.result?.skunk).toBe('none');
  });

  it('refuses every Action once the Game is over', () => {
    const { state } = drive(newGame(2026));
    const card = parseCard('AS');
    expect(apply(state, { type: 'play', seat: 0, card })).toEqual({
      ok: false,
      violation: 'wrong-phase',
    });
    expect(
      apply(state, { type: 'discard', seat: 0, cards: [card, card] }),
    ).toEqual({
      ok: false,
      violation: 'wrong-phase',
    });
  });
});

describe('Game: Violations leave the state unchanged', () => {
  const twoOf = (cards: readonly Card[]): [Card, Card] => {
    const [a, b] = cards;
    if (a === undefined || b === undefined) throw new Error('short hand');
    return [a, b];
  };

  it('refuses a Play during the Discard phase', () => {
    const { state } = newGame(5);
    const card = state.hands[0][0];
    if (card === undefined) throw new Error('empty hand');
    expect(apply(state, { type: 'play', seat: 0, card })).toEqual({
      ok: false,
      violation: 'wrong-phase',
    });
  });

  it('refuses a Discard during Pegging', () => {
    const { state } = drive(newGame(5), (_, s) => s.phase !== 'discard');
    const result = apply(state, {
      type: 'discard',
      seat: 0,
      cards: twoOf(state.hands[0]),
    });
    expect(result).toEqual({ ok: false, violation: 'wrong-phase' });
  });

  it('refuses a second Discard from the same Seat', () => {
    const { state } = newGame(5);
    const first = apply(state, {
      type: 'discard',
      seat: 0,
      cards: twoOf(state.hands[0]),
    });
    if (!first.ok) throw new Error('first discard failed');
    const again = apply(first.state, {
      type: 'discard',
      seat: 0,
      cards: twoOf(first.state.hands[0]),
    });
    expect(again).toEqual({ ok: false, violation: 'not-your-turn' });
  });

  it('refuses a Discard of one card, three cards, or the same card twice', () => {
    const { state } = newGame(5);
    const [a, b, c] = state.hands[0];
    if (a === undefined || b === undefined || c === undefined)
      throw new Error();
    const one = apply(state, { type: 'discard', seat: 0, cards: [a] });
    const three = apply(state, { type: 'discard', seat: 0, cards: [a, b, c] });
    const twice = apply(state, { type: 'discard', seat: 0, cards: [a, a] });
    expect(one).toEqual({ ok: false, violation: 'must-discard-two' });
    expect(three).toEqual({ ok: false, violation: 'must-discard-two' });
    expect(twice).toEqual({ ok: false, violation: 'must-discard-two' });
  });

  it('refuses a Discard of a card the Seat does not hold', () => {
    const { state } = newGame(5);
    const [own] = state.hands[0];
    const [theirs] = state.hands[1];
    if (own === undefined || theirs === undefined) throw new Error();
    expect(
      apply(state, { type: 'discard', seat: 0, cards: [own, theirs] }),
    ).toEqual({
      ok: false,
      violation: 'card-not-in-hand',
    });
  });

  it('passes Pegging Violations through unchanged', () => {
    const { state } = drive(newGame(5), (_, s) => s.phase !== 'discard');
    if (state.pegging === null) throw new Error('not pegging');
    const idle = state.pegging.turn === 0 ? 1 : 0;
    const card = state.pegging.hands[idle][0];
    if (card === undefined) throw new Error();
    expect(apply(state, { type: 'play', seat: idle, card })).toEqual({
      ok: false,
      violation: 'not-your-turn',
    });
    const other = state.pegging.hands[idle][0];
    if (other === undefined) throw new Error();
    expect(
      apply(state, { type: 'play', seat: state.pegging.turn, card: other }),
    ).toEqual({
      ok: false,
      violation: 'card-not-in-hand',
    });
  });

  it('returns the same state object for a refused Action', () => {
    const { state } = newGame(5);
    const card = state.hands[0][0];
    if (card === undefined) throw new Error();
    const result = apply(state, { type: 'play', seat: 0, card });
    expect(result.ok).toBe(false);
    expect(state.phase).toBe('discard');
    expect(state.hands[0]).toHaveLength(6);
  });
});

describe('Game: the View', () => {
  it('shows a Seat its own Hand and hides the other Hand and the deck', () => {
    const { state } = newGame(21);
    const view = viewFor(state, 0);
    expect(view.seat).toBe(0);
    expect(view.hand).toEqual(state.hands[0]);
    expect(view.otherHandCount).toBe(6);
    const leaked = JSON.stringify(view);
    for (const card of state.hands[1]) {
      expect(leaked).not.toContain(JSON.stringify(card));
    }
    expect(leaked).not.toContain('"deck"');
    expect(leaked).not.toContain('"rng"');
  });

  it('shows scores, Dealer, Round, phase, Starter, Count, and the played cards', () => {
    const { state } = drive(newGame(21), (_, s) => s.phase !== 'discard');
    const view = viewFor(state, 1);
    expect(view.scores).toEqual(state.scores);
    expect(view.dealer).toBe(state.dealer);
    expect(view.round).toBe(1);
    expect(view.phase).toBe('pegging');
    expect(view.starter).toEqual(state.starter);
    expect(view.cribCount).toBe(4);
    expect(view.pegging?.count).toBe(0);
    expect(view.pegging?.sequence).toEqual([]);
    expect(view.pegging?.turn).toBe(state.pegging?.turn);
  });

  it('lists the viewing Seat legal Pegging cards and hides the other Seat cards in play', () => {
    const { state } = drive(newGame(21), (_, s) => s.phase !== 'discard');
    if (state.pegging === null) throw new Error();
    const seat = state.pegging.turn;
    const view = viewFor(state, seat);
    expect(view.pegging?.legal).toEqual(legalCards(state.pegging, seat));
    expect(view.pegging?.hand).toEqual(state.pegging.hands[seat]);
    expect(view.pegging?.otherHandCount).toBe(4);
    const leaked = JSON.stringify(view.pegging);
    for (const card of state.pegging.hands[seat === 0 ? 1 : 0]) {
      expect(leaked).not.toContain(JSON.stringify(card));
    }
  });

  it('never shows the Crib cards before the Show', () => {
    const { state } = drive(newGame(21), (_, s) => s.phase !== 'discard');
    const leaked = JSON.stringify(viewFor(state, 0));
    for (const card of state.crib) {
      expect(leaked).not.toContain(JSON.stringify(card));
    }
  });
});
