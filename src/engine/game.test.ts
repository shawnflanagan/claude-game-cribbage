import { describe, expect, it } from 'vitest';
import { parseCard, sameCard, type Card } from './cards';
import {
  apply,
  gameResult,
  newGame,
  replay,
  seatsToAct,
  viewFor,
  type Action,
  type GameEvent,
  type GameState,
} from './game';
import { otherSeat, type Seat } from './seat';

/** The simplest legal policy: discard the first two, play the first legal card. */
function firstLegalAction(state: GameState): Action | null {
  if (state.phase === 'discard') {
    const seat = state.hands.findIndex((h) => h.length === 6) as Seat | -1;
    if (seat === -1) return null;
    return { type: 'discard', seat, cards: twoOf(state.hands[seat]) };
  }
  if (state.phase === 'pegging') {
    const seat = viewFor(state, 0).pegging?.turn;
    if (seat === undefined) return null;
    const card = viewFor(state, seat).pegging?.legal[0];
    if (card === undefined) return null;
    return { type: 'play', seat, card };
  }
  return null;
}

function twoOf(cards: readonly Card[]): [Card, Card] {
  const [a, b] = cards;
  if (a === undefined || b === undefined) throw new Error('short hand');
  return [a, b];
}

type Driven = { state: GameState; events: readonly GameEvent[] };

/** Applies first-legal Actions until `until` says stop or the Game is over. */
function drive(
  start: Driven,
  until: (events: readonly GameEvent[], state: GameState) => boolean = () =>
    false,
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

const untilRoundEnds = (events: readonly GameEvent[]) =>
  events.some((e) => e.type === 'round-ended');
const untilPegging = (_: unknown, state: GameState) =>
  state.phase !== 'discard';
const types = (events: readonly GameEvent[]) => events.map((e) => e.type);

function findSeed(predicate: (seed: number) => boolean, from = 1): number {
  for (let seed = from; seed < from + 5000; seed++) {
    if (predicate(seed)) return seed;
  }
  throw new Error('No seed satisfied the predicate');
}

/** Asserts the Action is refused with `violation` and the state is untouched. */
function expectRefused(
  state: GameState,
  action: Action,
  violation: string,
): void {
  const before = structuredClone(state);
  expect(apply(state, action)).toEqual({ ok: false, violation });
  expect(state).toEqual(before);
}

describe('Game: cut for deal and the deal', () => {
  it('gives the deal to the Seat that cut the lower card', () => {
    const { state, events } = newGame(1);
    const last = events.filter((e) => e.type === 'cut-for-deal').at(-1);
    if (last?.type !== 'cut-for-deal') throw new Error('no cut');
    expect(last.dealer).toBe(state.dealer);
    expect(last.cuts[state.dealer].rank).toBeLessThan(
      last.cuts[otherSeat(state.dealer)].rank,
    );
  });

  it('treats the Ace as the lowest cut', () => {
    const seed = findSeed((s) => {
      const first = newGame(s).events[0];
      return (
        first?.type === 'cut-for-deal' &&
        first.cuts.some((c) => c.rank === 1) &&
        first.cuts.some((c) => c.rank === 13)
      );
    });
    const { state, events } = newGame(seed);
    const first = events[0];
    if (first?.type !== 'cut-for-deal') throw new Error('no cut');
    expect(first.cuts[state.dealer].rank).toBe(1);
  });

  it('re-cuts on a tie until the cut decides', () => {
    const seed = findSeed(
      (s) =>
        newGame(s).events.filter((e) => e.type === 'cut-for-deal').length > 1,
    );
    const cuts = newGame(seed).events.filter((e) => e.type === 'cut-for-deal');
    const [first] = cuts;
    const last = cuts.at(-1);
    if (first?.type !== 'cut-for-deal' || last?.type !== 'cut-for-deal') {
      throw new Error('no cuts');
    }
    expect(first.dealer).toBeNull();
    expect(first.cuts[0].rank).toBe(first.cuts[1].rank);
    expect(last.dealer).not.toBeNull();
  });

  it('deals six distinct cards to each Seat and enters the Discard phase', () => {
    const { state, events } = newGame(7);
    expect(state.phase).toBe('discard');
    expect(state.round).toBe(1);
    expect(state.hands[0]).toHaveLength(6);
    expect(state.hands[1]).toHaveLength(6);
    expect(state.crib).toHaveLength(0);
    expect(state.starter).toBeNull();
    expect(types(events).at(-1)).toBe('dealt');
    const all = [...state.hands[0], ...state.hands[1]];
    for (const card of all) {
      expect(all.filter((c) => sameCard(c, card))).toHaveLength(1);
    }
  });

  it('starts from the given scores when asked, for tests and handicaps', () => {
    expect(newGame(3, { scores: [100, 50] }).state.scores).toEqual([100, 50]);
  });
});

describe('Game: Discard, Starter, and Heels', () => {
  it('moves the Discards to the Crib and lets either Seat discard first', () => {
    const { state } = newGame(5);
    const cards = twoOf(state.hands[1]);
    const result = apply(state, { type: 'discard', seat: 1, cards });
    if (!result.ok) throw new Error(result.violation);
    expect(result.state.phase).toBe('discard');
    expect(result.state.hands[1]).toHaveLength(4);
    expect(result.state.crib).toEqual(cards);
    expect(result.events).toEqual([{ type: 'discarded', seat: 1 }]);
  });

  it('cuts the Starter and starts Pegging once both have discarded', () => {
    const { state, events } = drive(newGame(5), untilPegging);
    expect(state.phase).toBe('pegging');
    expect(state.hands[0]).toHaveLength(4);
    expect(state.hands[1]).toHaveLength(4);
    expect(state.crib).toHaveLength(4);
    expect(state.starter).not.toBeNull();
    expect(state.deck).toHaveLength(52 - 12 - 1);
    expect(types(events).filter((t) => t === 'discarded')).toHaveLength(2);
    expect(types(events)).toContain('starter-cut');
  });

  it('has the Pone lead the first Pegging card', () => {
    const { state } = drive(newGame(5), untilPegging);
    expect(viewFor(state, 0).pegging?.turn).toBe(otherSeat(state.dealer));
  });

  it('scores Heels for the Dealer when the Starter is a Jack', () => {
    const seed = findSeed((s) => {
      const { state } = drive(newGame(s), untilPegging);
      return state.starter?.rank === 11;
    });
    const { state, events } = drive(newGame(seed), untilPegging);
    const heels = events.find((e) => e.type === 'heels');
    if (heels?.type !== 'heels') throw new Error('no heels');
    expect(heels.seat).toBe(state.dealer);
    expect(heels.tally.total).toBe(2);
    expect(state.scores[state.dealer]).toBe(2);
    expect(state.scores[otherSeat(state.dealer)]).toBe(0);
  });

  it('does not score Heels when the Starter is not a Jack', () => {
    const seed = findSeed((s) => {
      const { state } = drive(newGame(s), untilPegging);
      return state.starter?.rank !== 11;
    });
    const { state, events } = drive(newGame(seed), untilPegging);
    expect(types(events)).not.toContain('heels');
    expect(state.scores).toEqual([0, 0]);
  });
});

describe('Game: the Show and the next Round', () => {
  it('counts Pone, then Dealer, then the Crib', () => {
    const first = newGame(13);
    const dealer = first.state.dealer;
    const { events } = drive(first, untilRoundEnds);
    const shows = events.filter((e) => e.type === 'show-counted');
    expect(shows.map((e) => e.source)).toEqual(['hand', 'hand', 'crib']);
    expect(shows.map((e) => e.seat)).toEqual([
      otherSeat(dealer),
      dealer,
      dealer,
    ]);
    const crib = shows.find((e) => e.source === 'crib');
    expect(crib?.cards).toHaveLength(4);
  });

  it('adds every Tally, Heels, and Show count in the Round to the scores', () => {
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
    expect(expected[0] + expected[1]).toBeGreaterThan(0);
  });

  it('alternates the Dealer and deals the next Round automatically', () => {
    const first = newGame(13);
    const { state, events } = drive(first, untilRoundEnds);
    expect(state.round).toBe(2);
    expect(state.dealer).toBe(otherSeat(first.state.dealer));
    expect(state.phase).toBe('discard');
    expect(state.hands[0]).toHaveLength(6);
    expect(state.hands[1]).toHaveLength(6);
    expect(state.crib).toHaveLength(0);
    expect(state.starter).toBeNull();
    expect(types(events).slice(-2)).toEqual(['round-ended', 'dealt']);
  });
});

describe('Game: winning', () => {
  it('plays a complete Game from a fixed seed to a winner', () => {
    const { state, events } = drive(newGame(2026));
    expect(state.phase).toBe('game-over');
    expect(state.result?.winner).toBe(state.scores.indexOf(121));
    expect(Math.max(...state.scores)).toBe(121);
    expect(types(events).at(-1)).toBe('game-won');
    expect(types(events).filter((t) => t === 'game-won')).toHaveLength(1);
  });

  it('characterisation: seed 2026 always ends the same way', () => {
    const { state } = drive(newGame(2026));
    expect({
      round: state.round,
      result: state.result,
    }).toMatchInlineSnapshot(`
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
      }
    `);
  });

  it('is deterministic: the same seed and Actions give an identical final state', () => {
    const a = drive(newGame(77));
    const b = drive(newGame(77));
    expect(a.state).toEqual(b.state);
    expect(a.events).toEqual(b.events);
  });

  it('ends the Game the instant Heels reaches 121, before any Pegging', () => {
    const seed = findSeed((s) => {
      const { state } = drive(newGame(s), untilPegging);
      return state.starter?.rank === 11;
    });
    const dealer = newGame(seed).state.dealer;
    const scores: [number, number] = dealer === 0 ? [119, 0] : [0, 119];
    const { state, events } = drive(newGame(seed, { scores }));
    expect(state.phase).toBe('game-over');
    expect(state.result?.winner).toBe(dealer);
    expect(types(events)).not.toContain('card-played');
    expect(types(events).at(-1)).toBe('game-won');
  });

  it('ends the Game the instant a Pegging Tally reaches 121, with no Show', () => {
    const seed = findSeed((s) => {
      const { state } = drive(newGame(s), untilPegging);
      return state.starter?.rank !== 11;
    });
    const { state, events } = drive(newGame(seed, { scores: [120, 120] }));
    expect(state.phase).toBe('game-over');
    expect(types(events)).toContain('card-played');
    expect(types(events)).not.toContain('show-counted');
    expect(types(events).at(-1)).toBe('game-won');
  });

  it('ends after the Pone counts, so the Dealer never counts', () => {
    const scoresFor = (dealer: Seat): [number, number] =>
      dealer === 0 ? [0, 120] : [120, 0];
    const seed = findSeed((s) => {
      const dealer = newGame(s).state.dealer;
      const { events } = drive(newGame(s, { scores: scoresFor(dealer) }));
      return (
        events.filter((e) => e.type === 'show-counted').length === 1 &&
        events.at(-1)?.type === 'game-won'
      );
    });
    const dealer = newGame(seed).state.dealer;
    const { state, events } = drive(
      newGame(seed, { scores: scoresFor(dealer) }),
    );
    const shows = events.filter((e) => e.type === 'show-counted');
    expect(shows.map((e) => e.seat)).toEqual([otherSeat(dealer)]);
    expect(state.result?.winner).toBe(otherSeat(dealer));
  });

  it('never lets a score exceed 121', () => {
    const { state } = drive(newGame(5, { scores: [120, 120] }));
    expect(Math.max(...state.scores)).toBe(121);
  });

  it('records the final scores and winner in the result', () => {
    const { state } = drive(newGame(9, { scores: [120, 80] }));
    expect(state.result?.scores).toEqual(state.scores);
    expect(state.result?.winner).toBe(state.scores.indexOf(121));
  });

  it('records a Skunk under 91 and a Double Skunk under 61, inclusive of nothing', () => {
    expect(gameResult(0, [121, 60]).skunk).toBe('double-skunk');
    expect(gameResult(0, [121, 61]).skunk).toBe('skunk');
    expect(gameResult(0, [121, 90]).skunk).toBe('skunk');
    expect(gameResult(0, [121, 91]).skunk).toBe('none');
    expect(gameResult(1, [30, 121]).skunk).toBe('double-skunk');
  });

  it('refuses every Action once the Game is over', () => {
    const { state } = drive(newGame(2026));
    const card = parseCard('AS');
    expectRefused(state, { type: 'play', seat: 0, card }, 'wrong-phase');
    expectRefused(
      state,
      { type: 'discard', seat: 0, cards: [card, parseCard('2S')] },
      'wrong-phase',
    );
  });
});

describe('Game: Violations leave the state unchanged', () => {
  it('refuses a Play during the Discard phase', () => {
    const { state } = newGame(5);
    const [card] = twoOf(state.hands[0]);
    expectRefused(state, { type: 'play', seat: 0, card }, 'wrong-phase');
  });

  it('refuses a Discard during Pegging', () => {
    const { state } = drive(newGame(5), untilPegging);
    expectRefused(
      state,
      { type: 'discard', seat: 0, cards: twoOf(state.hands[0]) },
      'wrong-phase',
    );
  });

  it('refuses a second Discard from the same Seat', () => {
    const { state } = newGame(5);
    const first = apply(state, {
      type: 'discard',
      seat: 0,
      cards: twoOf(state.hands[0]),
    });
    if (!first.ok) throw new Error('first discard failed');
    expectRefused(
      first.state,
      { type: 'discard', seat: 0, cards: twoOf(first.state.hands[0]) },
      'not-your-turn',
    );
  });

  it('refuses a Discard of one card, three cards, or the same card twice', () => {
    const { state } = newGame(5);
    const [a, b, c] = state.hands[0];
    if (a === undefined || b === undefined || c === undefined)
      throw new Error();
    expectRefused(
      state,
      { type: 'discard', seat: 0, cards: [a] },
      'must-discard-two',
    );
    expectRefused(
      state,
      { type: 'discard', seat: 0, cards: [a, b, c] },
      'must-discard-two',
    );
    expectRefused(
      state,
      { type: 'discard', seat: 0, cards: [a, a] },
      'must-discard-two',
    );
  });

  it('refuses a Discard of a card the Seat does not hold', () => {
    const { state } = newGame(5);
    const [own] = twoOf(state.hands[0]);
    const [theirs] = twoOf(state.hands[1]);
    expectRefused(
      state,
      { type: 'discard', seat: 0, cards: [own, theirs] },
      'card-not-in-hand',
    );
  });

  it('refuses a Play out of turn and a Play of a card not held', () => {
    const { state } = drive(newGame(5), untilPegging);
    const turn = viewFor(state, 0).pegging?.turn;
    if (turn === undefined) throw new Error('not pegging');
    const idle = otherSeat(turn);
    const [idleCard] = twoOf(viewFor(state, idle).pegging?.hand ?? []);
    expectRefused(
      state,
      { type: 'play', seat: idle, card: idleCard },
      'not-your-turn',
    );
    expectRefused(
      state,
      { type: 'play', seat: turn, card: idleCard },
      'card-not-in-hand',
    );
  });

  it('refuses a Play that would take the Count past 31', () => {
    // Find a moment where the Seat on turn holds a card it may not play.
    const stuck = (state: GameState) => {
      const turn = viewFor(state, 0).pegging?.turn;
      if (turn === undefined) return false;
      const view = viewFor(state, turn).pegging;
      return view !== null && view.legal.length < view.hand.length;
    };
    const seed = findSeed((s) => {
      try {
        drive(newGame(s), (_, st) => st.phase === 'game-over' || stuck(st));
        return true;
      } catch {
        return false;
      }
    });
    const { state } = drive(newGame(seed), (_, st) => stuck(st));
    const turn = viewFor(state, 0).pegging?.turn;
    if (turn === undefined) throw new Error('not pegging');
    const view = viewFor(state, turn).pegging;
    const illegal = view?.hand.find(
      (c) => !view.legal.some((l) => sameCard(l, c)),
    );
    if (illegal === undefined) throw new Error('no illegal card');
    expectRefused(
      state,
      { type: 'play', seat: turn, card: illegal },
      'count-would-exceed-31',
    );
  });
});

describe('Game: the View', () => {
  it('shows a Seat its own Hand and hides the other Hand, the Crib, and the deck', () => {
    const { state } = drive(newGame(21), (_, s) => s.crib.length === 2);
    const seat = state.hands.findIndex((h) => h.length === 6) as Seat;
    const view = viewFor(state, seat);
    expect(view.seat).toBe(seat);
    expect(view.hand).toEqual(state.hands[seat]);
    expect(view.otherHandSize).toBe(4);
    expect(view.cribSize).toBe(2);
    expect(view.discarded[seat]).toBe(false);
    expect(view.discarded[otherSeat(seat)]).toBe(true);
    const leaked = JSON.stringify(view);
    for (const card of [...state.hands[otherSeat(seat)], ...state.crib]) {
      expect(leaked).not.toContain(JSON.stringify(card));
    }
    expect(leaked).not.toContain('"deck"');
    expect(leaked).not.toContain('"rng"');
  });

  it('shows scores, Dealer, Round, phase, Starter, Count, and the played cards', () => {
    const { state } = drive(newGame(21), untilPegging);
    const view = viewFor(state, 1);
    expect(view.scores).toEqual(state.scores);
    expect(view.dealer).toBe(state.dealer);
    expect(view.round).toBe(1);
    expect(view.phase).toBe('pegging');
    expect(view.starter).toEqual(state.starter);
    expect(view.cribSize).toBe(4);
    expect(view.result).toBeNull();
    expect(view.pegging?.count).toBe(0);
    expect(view.pegging?.sequence).toEqual([]);
    expect(view.pegging?.turn).toBe(otherSeat(state.dealer));
  });

  it('lists the Seat legal cards, all four at a Count of 0, and hides the other Seat cards in play', () => {
    const { state } = drive(newGame(21), untilPegging);
    const seat = otherSeat(state.dealer);
    const view = viewFor(state, seat);
    expect(view.pegging?.hand).toHaveLength(4);
    expect(view.pegging?.legal).toEqual(view.pegging?.hand);
    expect(view.pegging?.otherHandSize).toBe(4);
    const leaked = JSON.stringify(view.pegging);
    for (const card of viewFor(state, otherSeat(seat)).pegging?.hand ?? []) {
      expect(leaked).not.toContain(JSON.stringify(card));
    }
  });

  it('shows the played cards and the Count as Pegging proceeds', () => {
    const { state, events } = drive(
      newGame(21),
      (evs) => evs.filter((e) => e.type === 'card-played').length === 2,
    );
    const played = events.filter((e) => e.type === 'card-played');
    const view = viewFor(state, 0);
    expect(view.pegging?.sequence.map((p) => p.card)).toEqual(
      played.map((e) => e.card),
    );
    expect(view.pegging?.count).toBe(played.at(-1)?.count);
  });

  it('shows the result once the Game is over', () => {
    const { state } = drive(newGame(2026));
    expect(viewFor(state, 0).result).toEqual(state.result);
    expect(viewFor(state, 0).phase).toBe('game-over');
  });
});

describe('Game: replay and who is to act', () => {
  it('replays a seed and Action history to the same state and Events', () => {
    const actions: Action[] = [];
    let { state } = newGame(31);
    const events = [...newGame(31).events];
    for (let i = 0; i < 12; i++) {
      const action = firstLegalAction(state);
      if (action === null) break;
      const result = apply(state, action);
      if (!result.ok) throw new Error(result.violation);
      actions.push(action);
      state = result.state;
      events.push(...result.events);
    }
    const replayed = replay(31, actions);
    if (!replayed.ok) throw new Error(replayed.violation);
    expect(replayed.state).toEqual(state);
    expect(replayed.events).toEqual(events);
  });

  it('reports the first Violation when a history does not fit its seed', () => {
    const { state } = newGame(31);
    const [a, b] = twoOf(state.hands[0]);
    const foreign = twoOf(state.hands[1]);
    const result = replay(31, [
      { type: 'discard', seat: 0, cards: [a, b] },
      { type: 'discard', seat: 0, cards: foreign },
    ]);
    expect(result).toEqual({ ok: false, violation: 'not-your-turn' });
  });

  it('says both Seats may Discard, then only the one still holding six', () => {
    const { state } = newGame(31);
    expect(seatsToAct(viewFor(state, 0))).toEqual([0, 1]);
    const result = apply(state, {
      type: 'discard',
      seat: 1,
      cards: twoOf(state.hands[1]),
    });
    if (!result.ok) throw new Error(result.violation);
    expect(seatsToAct(viewFor(result.state, 0))).toEqual([0]);
  });

  it('says only the Seat on turn may act during Pegging, and nobody after the Game', () => {
    const pegging = drive(newGame(31), untilPegging).state;
    expect(seatsToAct(viewFor(pegging, 0))).toEqual([
      otherSeat(pegging.dealer),
    ]);
    const over = drive(newGame(2026)).state;
    expect(seatsToAct(viewFor(over, 0))).toEqual([]);
  });
});
