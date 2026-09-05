import { describe, expect, it } from 'vitest';
import { seatsToAct, viewFor, type Action } from '../engine';
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
