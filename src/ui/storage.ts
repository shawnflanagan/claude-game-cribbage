import {
  createRng,
  isCard,
  replay,
  type Action,
  type PerSeat,
  type Seat,
} from '../engine';
import { revealAll, type Session } from './session';

export const STORAGE_KEY = 'cribbage.game';

/**
 * A saved Game: the seed and the Actions, never engine state (ADR 0002),
 * plus the Seat the human sits in and the opponent's randomness so the
 * Computer picks up exactly where it left off.
 */
export type SavedGame = {
  readonly version: 1;
  readonly seed: number;
  readonly human: Seat;
  readonly opponentRng: number;
  readonly actions: readonly Action[];
  /** Where the scores started; absent in saves from before handicaps. */
  readonly scores?: PerSeat<number>;
};

export function serialize(session: Session): SavedGame {
  return {
    version: 1,
    seed: session.seed,
    human: session.human,
    opponentRng: session.opponentRng.state,
    actions: session.actions,
    scores: session.startingScores,
  };
}

/**
 * Rebuilds a Session from a save by replaying its Actions, with the
 * presentation caught up so nothing animates. A finished Game comes back
 * on its result screen. Returns null for anything that does not replay.
 */
export function restore(saved: unknown): Session | null {
  if (!isSavedGame(saved)) return null;
  const scores = saved.scores ?? [0, 0];
  const replayed = replay(saved.seed, saved.actions, { scores });
  if (!replayed.ok) return null;
  return revealAll({
    seed: saved.seed,
    human: saved.human,
    startingScores: scores,
    engine: replayed.state,
    events: replayed.events,
    actions: saved.actions,
    revealed: 0,
    counted: 0,
    opponentRng: createRng(saved.opponentRng),
  });
}

export function saveGame(storage: Storage, session: Session): void {
  writeItem(storage, STORAGE_KEY, serialize(session));
}

export function loadGame(storage: Storage): Session | null {
  const saved = readItem(storage, STORAGE_KEY);
  return saved === null ? null : restore(saved);
}

export function clearGame(storage: Storage): void {
  removeItem(storage, STORAGE_KEY);
}

/**
 * Browser storage as a place to keep JSON, where every failure (blocked
 * storage, a full quota, unreadable contents) means "nothing there".
 */
export function writeItem(storage: Storage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // A browser that blocks storage still gets to play.
  }
}

export function readItem(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function removeItem(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Nothing to do; there was nothing readable to clear either.
  }
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isScores(value: unknown): value is PerSeat<number> {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => Number.isInteger(n))
  );
}

function isSeat(value: unknown): value is Seat {
  return value === 0 || value === 1;
}

function isAction(value: unknown): value is Action {
  if (!isObject(value) || !isSeat(value.seat)) return false;
  if (value.type === 'play') return isCard(value.card);
  if (value.type === 'discard') {
    return Array.isArray(value.cards) && value.cards.every(isCard);
  }
  return false;
}

function isSavedGame(value: unknown): value is SavedGame {
  return (
    isObject(value) &&
    value.version === 1 &&
    Number.isInteger(value.seed) &&
    isSeat(value.human) &&
    Number.isInteger(value.opponentRng) &&
    Array.isArray(value.actions) &&
    value.actions.every(isAction) &&
    (value.scores === undefined || isScores(value.scores))
  );
}
