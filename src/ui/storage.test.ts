import { describe, expect, it } from 'vitest';
import { viewFor, type Action } from '../engine';
import { heuristicOpponent } from '../opponent';
import { computerAct, humanAct, startSession, type Session } from './session';
import {
  clearSaved,
  loadSaved,
  restore,
  saveGame,
  serialize,
  type SavedGame,
} from './storage';

const HUMAN = 0;

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => {
      map.clear();
    },
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => {
      map.delete(k);
    },
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

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
      ['actions', 'human', 'opponentRng', 'seed', 'version'].sort(),
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

  it('does not restore a finished Game', () => {
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
    expect(restore(serialize(session))).toBeNull();
  });
});

describe('the browser store', () => {
  it('writes, reads back, and clears a save', () => {
    const storage = memoryStorage();
    const session = afterSomePlay(14);
    saveGame(storage, session);
    expect(loadSaved(storage)?.engine).toEqual(session.engine);
    clearSaved(storage);
    expect(loadSaved(storage)).toBeNull();
  });

  it('returns nothing for an unreadable save', () => {
    const storage = memoryStorage();
    storage.setItem('cribbage.game', '{not json');
    expect(loadSaved(storage)).toBeNull();
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
    expect(loadSaved(broken)).toBeNull();
    expect(() => {
      clearSaved(broken);
    }).not.toThrow();
  });
});

describe('the session records its Actions', () => {
  it('appends each accepted Action in order', () => {
    const start = startSession(16);
    expect(start.actions).toEqual([]);
    const view = viewFor(start.engine, HUMAN);
    const [a, b] = view.hand;
    if (a === undefined || b === undefined) throw new Error('short hand');
    const action: Action = { type: 'discard', seat: HUMAN, cards: [a, b] };
    const after = humanAct(start, action);
    expect(after.actions).toEqual([action]);
    const withComputer = computerAct(after, heuristicOpponent);
    expect(withComputer?.actions).toHaveLength(2);
    expect(withComputer?.actions[1]?.seat).toBe(1);
  });
});
