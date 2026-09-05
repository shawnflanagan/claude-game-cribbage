import { describe, expect, it } from 'vitest';
import {
  makeTally,
  parseCard,
  parseCards,
  seatsToAct,
  viewFor,
  type Action,
  type GameEvent,
} from '../engine';
import { heuristicOpponent, randomOpponent } from '../opponent';
import {
  caughtUp,
  computerAct,
  humanAct,
  nextPause,
  present,
  reveal,
  revealAll,
  startSession,
  type Session,
} from './session';

const HUMAN = 0;

function discardFirstTwo(session: Session): Session {
  const view = viewFor(session.engine, HUMAN);
  const [a, b] = view.hand;
  if (a === undefined || b === undefined) throw new Error('short hand');
  const action: Action = { type: 'discard', seat: HUMAN, cards: [a, b] };
  return humanAct(session, action);
}

function untilPegging(start: Session): Session {
  let session = discardFirstTwo(start);
  while (session.engine.phase === 'discard') {
    session = computerAct(session, randomOpponent) ?? session;
  }
  return revealAll(session);
}

/** Pegs the whole Round out, the human always playing their first legal card. */
function pegOut(start: Session): Session {
  let session = untilPegging(start);
  for (let i = 0; i < 40 && session.engine.phase === 'pegging'; i++) {
    const turn = viewFor(session.engine, 0).pegging?.turn;
    if (turn === undefined) break;
    if (turn === HUMAN) {
      const card = viewFor(session.engine, HUMAN).pegging?.legal[0];
      if (card === undefined) break;
      session = humanAct(session, { type: 'play', seat: HUMAN, card });
    } else {
      session = computerAct(session, randomOpponent) ?? session;
    }
  }
  return session;
}

describe('session: engine ahead, presentation behind', () => {
  it('starts with nothing revealed and the cut for deal pending', () => {
    const session = startSession(7);
    expect(session.revealed).toBe(0);
    expect(caughtUp(session)).toBe(false);
    expect(present(session).stage).toBe('cutting');
  });

  it('reveals one Event at a time up to the engine', () => {
    let session = startSession(7);
    const total = session.events.length;
    for (let i = 0; i < total; i++) session = reveal(session);
    expect(caughtUp(session)).toBe(true);
    expect(reveal(session).revealed).toBe(total);
    expect(present(session).stage).toBe('discarding');
  });

  it('presents the human Hand after the deal and hides nothing of their own', () => {
    const session = revealAll(startSession(7));
    const model = present(session);
    expect(model.hands[HUMAN]).toEqual(viewFor(session.engine, HUMAN).hand);
    expect(model.hands[1]).toHaveLength(6);
    expect(model.round).toBe(1);
    expect(model.scores).toEqual([0, 0]);
  });

  it('applies a human Action and appends its Events without revealing them', () => {
    const start = revealAll(startSession(7));
    const after = discardFirstTwo(start);
    expect(after.events.length).toBeGreaterThan(start.events.length);
    expect(after.revealed).toBe(start.revealed);
    expect(viewFor(after.engine, HUMAN).discarded[HUMAN]).toBe(true);
  });

  it('ignores an Action the engine refuses', () => {
    const start = revealAll(startSession(7));
    const bogus: Action = {
      type: 'play',
      seat: HUMAN,
      card: { rank: 1, suit: 'clubs' },
    };
    expect(humanAct(start, bogus)).toBe(start);
  });

  it('lets the Computer act when it is a Seat to act, threading its randomness', () => {
    const start = revealAll(startSession(7));
    const after = computerAct(start, randomOpponent);
    expect(after).not.toBeNull();
    if (after === null) return;
    expect(viewFor(after.engine, 1).discarded[1]).toBe(true);
    expect(after.opponentRng).not.toEqual(start.opponentRng);
    expect(seatsToAct(viewFor(after.engine, 0))).toEqual([HUMAN]);
  });

  it('returns null when the Computer has nothing to do', () => {
    const start = revealAll(startSession(7));
    const once = computerAct(start, randomOpponent);
    if (once === null) throw new Error('expected a discard');
    expect(computerAct(once, randomOpponent)).toBeNull();
  });

  it('presents the Discard leaving the Hand and growing the Crib', () => {
    const start = revealAll(startSession(7));
    const model = present(revealAll(discardFirstTwo(start)));
    expect(model.hands[HUMAN]).toHaveLength(4);
    expect(model.discarded[HUMAN]).toBe(true);
    expect(model.cribSize).toBe(2);
  });

  it('presents the Starter, the Count, and the played cards during Pegging', () => {
    const session = untilPegging(startSession(7));
    const model = present(session);
    expect(model.stage).toBe('pegging');
    expect(model.kept[HUMAN]).toEqual(viewFor(session.engine, HUMAN).hand);
    expect(model.kept[1]).toHaveLength(4);
    expect(model.starter).toEqual(session.engine.starter);
    expect(model.count).toBe(0);
    expect(model.sequence).toEqual([]);
    expect(model.cribSize).toBe(4);
  });

  it('presents the engine scores once caught up', () => {
    const session = pegOut(startSession(7));
    const model = present(revealAll(session));
    expect(model.scores).toEqual(session.engine.scores);
    expect(model.scores[0] + model.scores[1]).toBeGreaterThan(0);
  });

  it('needs one Continue after each Show count, revealing the score with it', () => {
    let session = untilPegging(startSession(7));
    for (let i = 0; i < 40; i++) {
      const view = viewFor(session.engine, 0);
      const turn = view.pegging?.turn;
      if (view.phase !== 'pegging' || turn === undefined) break;
      if (turn === HUMAN) {
        const card = viewFor(session.engine, HUMAN).pegging?.legal[0];
        if (card === undefined) break;
        session = humanAct(session, { type: 'play', seat: HUMAN, card });
      } else {
        session = computerAct(session, randomOpponent) ?? session;
      }
    }
    // Reveal automatically until the first Show count is on the table.
    while (session.events[session.revealed - 1]?.type !== 'show-counted') {
      expect(nextPause(session).kind).toBe('after');
      session = reveal(session);
    }
    expect(present(session).stage).toBe('show');
    expect(present(session).shows).toHaveLength(1);
    // It is counted out one Combination at a time before anything else.
    const combinations = present(session).shows[0]?.tally.combinations ?? [];
    for (let i = 0; i < combinations.length; i++) {
      expect(present(session).counted).toBe(i);
      expect(nextPause(session)).toEqual({ kind: 'after', ms: 700 });
      session = reveal(session);
    }
    expect(present(session).counted).toBe(combinations.length);
    // Its scored Event rides along without a press, then Continue is needed.
    if (session.events[session.revealed]?.type === 'scored') {
      expect(nextPause(session)).toEqual({ kind: 'after', ms: 0 });
      session = reveal(session);
    }
    expect(nextPause(session)).toEqual({ kind: 'continue' });
    expect(present(session).scores).toEqual(
      session.events
        .slice(0, session.revealed)
        .filter((e) => e.type === 'scored')
        .at(-1)?.scores ?? [0, 0],
    );
    // One press per remaining count; the deal after the Crib needs one more.
    let presses = 0;
    while (
      session.events[session.revealed]?.type !== 'dealt' &&
      !caughtUp(session)
    ) {
      const pause = nextPause(session);
      if (pause.kind === 'continue') presses++;
      session = reveal(session);
    }
    expect(presses).toBe(2);
    expect(nextPause(session)).toEqual({ kind: 'continue' });
  });

  it('paces Computer cards with a delay and the human own cards instantly', () => {
    const session = untilPegging(startSession(7));
    const cards = [
      {
        type: 'card-played' as const,
        seat: 1 as const,
        card: { rank: 5 as const, suit: 'hearts' as const },
        count: 5,
      },
      {
        type: 'card-played' as const,
        seat: 0 as const,
        card: { rank: 5 as const, suit: 'spades' as const },
        count: 10,
      },
    ];
    const staged: Session = {
      ...session,
      events: [...session.events, ...cards],
    };
    expect(nextPause(staged)).toEqual({ kind: 'after', ms: 600 });
    expect(nextPause({ ...staged, revealed: staged.revealed + 1 })).toEqual({
      kind: 'after',
      ms: 0,
    });
  });

  it('is idle once caught up', () => {
    const session = revealAll(startSession(7));
    expect(nextPause(session)).toEqual({ kind: 'idle' });
  });

  it('presents the result once the Game is won', () => {
    let session = startSession(7);
    for (let i = 0; i < 5000 && session.engine.phase !== 'game-over'; i++) {
      const seats = seatsToAct(viewFor(session.engine, 0));
      if (seats.includes(HUMAN)) {
        const view = viewFor(session.engine, HUMAN);
        if (view.phase === 'discard') session = discardFirstTwo(session);
        else {
          const card = view.pegging?.legal[0];
          if (card === undefined) break;
          session = humanAct(session, { type: 'play', seat: HUMAN, card });
        }
      } else {
        session = computerAct(session, randomOpponent) ?? session;
      }
    }
    const model = present(revealAll(session));
    expect(model.stage).toBe('over');
    expect(model.result).toEqual(session.engine.result);
  });

  it('records each accepted Action in order', () => {
    const start = startSession(16);
    expect(start.actions).toEqual([]);
    const [a, b] = viewFor(start.engine, HUMAN).hand;
    if (a === undefined || b === undefined) throw new Error('short hand');
    const action: Action = { type: 'discard', seat: HUMAN, cards: [a, b] };
    const after = humanAct(start, action);
    expect(after.actions).toEqual([action]);
    const withComputer = computerAct(after, heuristicOpponent);
    expect(withComputer?.actions).toHaveLength(2);
    expect(withComputer?.actions[1]?.seat).toBe(1);
  });
});

describe('session: back pegs', () => {
  it('remembers the scores before the latest Tally so the back peg can sit there', () => {
    let session = untilPegging(startSession(7));
    for (let i = 0; i < 40 && session.engine.round === 1; i++) {
      const turn = viewFor(session.engine, 0).pegging?.turn;
      if (turn === undefined) break;
      if (turn === HUMAN) {
        const card = viewFor(session.engine, HUMAN).pegging?.legal[0];
        if (card === undefined) break;
        session = humanAct(session, { type: 'play', seat: HUMAN, card });
      } else {
        session = computerAct(session, randomOpponent) ?? session;
      }
    }
    const scored = session.events.filter((e) => e.type === 'scored');
    const [first, second] = scored;
    if (first === undefined || second === undefined) {
      throw new Error('expected at least two scoring Events');
    }
    const upTo = session.events.indexOf(second) + 1;
    const model = present({ ...session, revealed: upTo });
    expect(model.scores).toEqual(second.scores);
    expect(model.previousScores).toEqual(first.scores);
  });

  it('starts both scores and previous scores at zero', () => {
    const model = present(revealAll(startSession(7)));
    expect(model.scores).toEqual([0, 0]);
    expect(model.previousScores).toEqual([0, 0]);
  });
});

describe('session: played piles', () => {
  const play = (seat: 0 | 1, card: string, count: number): GameEvent => ({
    type: 'card-played',
    seat,
    card: parseCard(card),
    count,
  });

  /** A Round with two Count resets before Pegging ends, then the next deal. */
  const round: readonly GameEvent[] = [
    {
      type: 'dealt',
      dealer: 1,
      round: 1,
      hands: [parseCards('5H 6H 7H 8H'), parseCards('5S 6S 7S 8S')],
    },
    { type: 'starter-cut', card: parseCard('KD') },
    play(0, '8H', 8),
    play(1, '8S', 16),
    play(0, '7H', 23),
    play(1, '7S', 30),
    { type: 'sequence-ended', leader: 0 },
    play(0, '6H', 6),
    play(1, '6S', 12),
    play(0, '5H', 17),
    { type: 'sequence-ended', leader: 1 },
    play(1, '5S', 5),
    { type: 'pegging-ended' },
    {
      type: 'dealt',
      dealer: 0,
      round: 2,
      hands: [parseCards('AH 2H 3H 4H'), parseCards('AS 2S 3S 4S')],
    },
  ];

  function presentEvents(events: readonly GameEvent[]) {
    return present({ ...startSession(1), events, revealed: events.length });
  }

  it('starts every Round with both piles empty and the sequence bare', () => {
    const model = presentEvents(round.slice(0, 2));
    expect(model.playedPile).toEqual([0, 0]);
    expect(model.sequence).toEqual([]);
  });

  it("sweeps each Seat's played cards into its pile at every Count reset", () => {
    const before = presentEvents(round.slice(0, 6));
    expect(before.sequence).toHaveLength(4);
    expect(before.playedPile).toEqual([0, 0]);

    const first = presentEvents(round.slice(0, 7));
    expect(first.sequence).toEqual([]);
    expect(first.count).toBe(0);
    expect(first.playedPile).toEqual([2, 2]);

    const second = presentEvents(round.slice(0, 11));
    expect(second.playedPile).toEqual([4, 3]);
  });

  it('holds all eight cards across the two piles once Pegging ends', () => {
    const model = presentEvents(round.slice(0, 13));
    expect(model.stage).toBe('show');
    expect(model.sequence).toEqual([]);
    expect(model.playedPile).toEqual([4, 4]);
  });

  it('empties both piles when the next Round deals', () => {
    expect(presentEvents(round).playedPile).toEqual([0, 0]);
  });

  it('matches what the engine actually plays', () => {
    const session = pegOut(startSession(7));
    const end = session.events.findIndex((e) => e.type === 'pegging-ended');
    expect(end).toBeGreaterThan(0);
    expect(present({ ...session, revealed: end + 1 }).playedPile).toEqual([
      4, 4,
    ]);
  });
});

describe('session: pacing inside and around Events', () => {
  const staged = (events: readonly GameEvent[], revealed: number): Session => ({
    ...startSession(1),
    events,
    revealed,
    counted: 0,
  });
  const cut: GameEvent = {
    type: 'cut-for-deal',
    cuts: [parseCard('4H'), parseCard('JS')],
    dealer: 0,
  };
  const dealt: GameEvent = {
    type: 'dealt',
    dealer: 0,
    round: 1,
    hands: [parseCards('5H 6H 7H 8H 9H TH'), parseCards('5S 6S 7S 8S 9S TS')],
  };
  const played: GameEvent = {
    type: 'card-played',
    seat: 1,
    card: parseCard('5S'),
    count: 15,
  };
  const tally: GameEvent = {
    type: 'tally',
    seat: 1,
    tally: makeTally([
      { kind: 'fifteen', points: 2, cards: parseCards('TH 5S') },
    ]),
  };
  const next: GameEvent = {
    type: 'card-played',
    seat: 0,
    card: parseCard('6H'),
    count: 21,
  };

  it('lets the cut cards linger with the Dealer announced before dealing', () => {
    expect(nextPause(staged([cut, dealt], 1))).toEqual({
      kind: 'after',
      ms: 2100,
    });
  });

  it('drops a Pegging Tally once the next card lands, so chips never move', () => {
    const withTally = present(staged([played, tally, next], 2));
    expect(withTally.lastTally?.source).toBe('pegging');
    const afterNext = present(staged([played, tally, next], 3));
    expect(afterNext.lastTally).toBeNull();
  });

  it('shows a Pegging Tally soon after its card and lets it linger', () => {
    expect(nextPause(staged([played, tally, next], 1))).toEqual({
      kind: 'after',
      ms: 300,
    });
    expect(nextPause(staged([played, tally, next], 2))).toEqual({
      kind: 'after',
      ms: 1000,
    });
  });

  it('counts a Show out one Combination per step, then scores, then waits', () => {
    const show: GameEvent = {
      type: 'show-counted',
      seat: 0,
      source: 'hand',
      cards: parseCards('5H 5S 6D JC'),
      tally: makeTally([
        { kind: 'fifteen', points: 2, cards: parseCards('5H JC') },
        { kind: 'pair', points: 2, cards: parseCards('5H 5S') },
      ]),
    };
    const scored: GameEvent = {
      type: 'scored',
      seat: 0,
      points: 4,
      scores: [4, 0],
    };
    const nextShow: GameEvent = {
      ...show,
      seat: 1,
      cards: parseCards('2H 4S 6D KC'),
    };
    let session = staged([show, scored, nextShow], 1);
    expect(present(session).counted).toBe(0);
    expect(nextPause(session)).toEqual({ kind: 'after', ms: 700 });
    session = reveal(session);
    expect(present(session).counted).toBe(1);
    expect(present(session).scores).toEqual([0, 0]);
    session = reveal(session);
    expect(present(session).counted).toBe(2);
    expect(nextPause(session)).toEqual({ kind: 'after', ms: 0 });
    session = reveal(session);
    expect(present(session).scores).toEqual([4, 0]);
    expect(nextPause(session)).toEqual({ kind: 'continue' });
  });

  it('needs no counting steps for a Hand worth nothing', () => {
    const show: GameEvent = {
      type: 'show-counted',
      seat: 0,
      source: 'hand',
      cards: parseCards('2H 4S 6D KC'),
      tally: makeTally([]),
    };
    const session = staged([show], 1);
    expect(nextPause(session)).toEqual({ kind: 'idle' });
    expect(present(session).counted).toBe(0);
  });

  it('is fully counted once everything is revealed at once', () => {
    const show: GameEvent = {
      type: 'show-counted',
      seat: 0,
      source: 'crib',
      cards: parseCards('5H 5S 6D JC'),
      tally: makeTally([
        { kind: 'fifteen', points: 2, cards: parseCards('5H JC') },
      ]),
    };
    expect(revealAll(staged([show], 0)).counted).toBe(1);
  });
});
