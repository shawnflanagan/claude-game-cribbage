import { describe, expect, it } from 'vitest';
import { viewFor } from '../engine';
import { heuristicOpponent, randomOpponent } from '../opponent';
import { describeEvent } from './log';
import { memoryStorage } from './memoryStorage';
import { computerAct, humanAct, startSession, type Session } from './session';
import {
  clearGame,
  loadGame,
  restore,
  saveGame,
  serialize,
  type SavedGame,
} from './storage';

const HUMAN = 0;

function afterSomePlay(seed: number): Session {
  let session = startSession(seed);
  const view = viewFor(session.engine, HUMAN);
  const [a, b] = view.hand;
  if (a === undefined || b === undefined) throw new Error('short hand');
  session = humanAct(session, { type: 'discard', seat: HUMAN, cards: [a, b] });
  for (let i = 0; i < 3; i++) {
    session = computerAct(session, heuristicOpponent) ?? session;
    const turn = viewFor(session.engine, HUMAN).pegging?.turn;
    if (turn === HUMAN) {
      const card = viewFor(session.engine, HUMAN).pegging?.legal[0];
      if (card !== undefined) {
        session = humanAct(session, { type: 'play', seat: HUMAN, card });
      }
    }
  }
  return session;
}

describe('saving a Game', () => {
  it('serializes only the seed, the Seat, the randomness, and the Actions', () => {
    const session = afterSomePlay(11);
    const saved = serialize(session);
    expect(Object.keys(saved).sort()).toEqual(
      ['actions', 'human', 'opponentRng', 'scores', 'seed', 'version'].sort(),
    );
    expect(saved.seed).toBe(11);
    expect(saved.actions).toEqual(session.actions);
    expect(saved.actions.length).toBeGreaterThan(1);
  });

  it('restores to the same engine state, Events, and Log, fully revealed', () => {
    const session = afterSomePlay(11);
    const restored = restore(serialize(session));
    expect(restored).not.toBeNull();
    if (restored === null) return;
    expect(restored.engine).toEqual(session.engine);
    expect(restored.events).toEqual(session.events);
    expect(restored.actions).toEqual(session.actions);
    expect(restored.opponentRng).toEqual(session.opponentRng);
    expect(restored.revealed).toBe(session.events.length);
    const lines = (s: Session) =>
      s.events.map((e) => describeEvent(e, HUMAN)).filter((l) => l !== null);
    expect(lines(restored)).toEqual(lines(session));
  });

  it('resumes a random opponent exactly where its randomness left off', () => {
    let session = startSession(17);
    const [a, b] = viewFor(session.engine, HUMAN).hand;
    if (a === undefined || b === undefined) throw new Error('short hand');
    session = humanAct(session, {
      type: 'discard',
      seat: HUMAN,
      cards: [a, b],
    });
    session = computerAct(session, randomOpponent) ?? session;
    const restored = restore(JSON.parse(JSON.stringify(serialize(session))));
    if (restored === null) throw new Error('did not restore');
    // Drive both to the Computer's next decision and compare it.
    const next = (s: Session) => {
      let current = s;
      while (
        !viewFor(current.engine, 1).pegging ||
        current.engine.pegging?.turn !== 1
      ) {
        const view = viewFor(current.engine, HUMAN);
        const card = view.pegging?.legal[0];
        if (card === undefined) throw new Error('human cannot move');
        current = humanAct(current, { type: 'play', seat: HUMAN, card });
        if (current.engine.pegging?.turn === 1) break;
      }
      return computerAct(current, randomOpponent)?.actions.at(-1);
    };
    expect(next(restored)).toEqual(next(session));
  });

  it('survives a trip through JSON', () => {
    const session = afterSomePlay(12);
    const text = JSON.stringify(serialize(session));
    const restored = restore(JSON.parse(text));
    expect(restored?.engine).toEqual(session.engine);
  });

  it('ignores a save that does not fit its seed', () => {
    const session = afterSomePlay(13);
    const saved = serialize(session);
    const tampered: SavedGame = { ...saved, seed: saved.seed + 1 };
    expect(restore(tampered)).toBeNull();
  });

  it('ignores garbage, the wrong version, and missing fields', () => {
    expect(restore(null)).toBeNull();
    expect(restore('nonsense')).toBeNull();
    expect(restore({ version: 99, seed: 1, actions: [] })).toBeNull();
    expect(restore({ version: 1, seed: 'x', actions: [] })).toBeNull();
    expect(
      restore({
        version: 1,
        seed: 1,
        human: 0,
        opponentRng: 1,
        actions: [{ type: 'bogus' }],
      }),
    ).toBeNull();
  });

  it('restores a Game started from a handicap at the same scores', () => {
    const session = startSession(5, 0, { scores: [100, 90] });
    const restored = restore(serialize(session));
    expect(restored?.engine.scores).toEqual([100, 90]);
    expect(restored?.startingScores).toEqual([100, 90]);
  });

  it('reads a save from before handicaps as a Game from zero', () => {
    const { version, seed, human, opponentRng, actions } = serialize(
      startSession(5),
    );
    const older = { version, seed, human, opponentRng, actions };
    expect(restore(older)?.engine.scores).toEqual([0, 0]);
  });

  it('restores a finished Game onto its result screen', () => {
    let session = startSession(2026);
    for (
      let guard = 0;
      guard < 5000 && session.engine.phase !== 'game-over';
      guard++
    ) {
      const view = viewFor(session.engine, HUMAN);
      if (view.phase === 'discard' && !view.discarded[HUMAN]) {
        const [a, b] = view.hand;
        if (a === undefined || b === undefined) break;
        session = humanAct(session, {
          type: 'discard',
          seat: HUMAN,
          cards: [a, b],
        });
      } else if (view.phase === 'pegging' && view.pegging?.turn === HUMAN) {
        const card = view.pegging.legal[0];
        if (card === undefined) break;
        session = humanAct(session, { type: 'play', seat: HUMAN, card });
      } else {
        session = computerAct(session, heuristicOpponent) ?? session;
      }
    }
    expect(session.engine.phase).toBe('game-over');
    const restored = restore(serialize(session));
    expect(restored?.engine.phase).toBe('game-over');
    expect(restored?.revealed).toBe(session.events.length);
  });
});

describe('the browser store', () => {
  it('writes, reads back, and clears a save', () => {
    const storage = memoryStorage();
    const session = afterSomePlay(14);
    saveGame(storage, session);
    expect(loadGame(storage)?.engine).toEqual(session.engine);
    clearGame(storage);
    expect(loadGame(storage)).toBeNull();
  });

  it('returns nothing for an unreadable save', () => {
    const storage = memoryStorage();
    storage.setItem('cribbage.game', '{not json');
    expect(loadGame(storage)).toBeNull();
  });

  it('keeps playing when storage throws', () => {
    const broken: Storage = {
      length: 0,
      clear: () => {
        throw new Error('blocked');
      },
      getItem: () => {
        throw new Error('blocked');
      },
      key: () => null,
      removeItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => {
      saveGame(broken, afterSomePlay(15));
    }).not.toThrow();
    expect(loadGame(broken)).toBeNull();
    expect(() => {
      clearGame(broken);
    }).not.toThrow();
  });
});
