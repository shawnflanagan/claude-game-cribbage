import { replay, type Action, type Card, type Seat } from '../engine';
import type { Session } from './session';

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
};

export function serialize(session: Session): SavedGame {
  return {
    version: 1,
    seed: session.seed,
    human: session.human,
    opponentRng: session.opponentRng.state,
    actions: session.actions,
  };
}

/**
 * Rebuilds a Session from a save by replaying its Actions, with the
 * presentation caught up so nothing animates. Returns null for anything
 * that does not replay cleanly, and for a Game that is already over.
 */
export function restore(saved: unknown): Session | null {
  if (!isSavedGame(saved)) return null;
  const replayed = replay(saved.seed, saved.actions);
  if (!replayed.ok || replayed.state.phase === 'game-over') return null;
  return {
    seed: saved.seed,
    human: saved.human,
    engine: replayed.state,
    events: replayed.events,
    actions: saved.actions,
    revealed: replayed.events.length,
    opponentRng: { state: saved.opponentRng },
  };
}

export function saveGame(storage: Storage, session: Session): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(serialize(session)));
  } catch {
    // A browser that blocks storage still gets to play.
  }
}

export function loadSaved(storage: Storage): Session | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw === null ? null : restore(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearSaved(storage: Storage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do; there was nothing readable to clear either.
  }
}

const SUITS: readonly string[] = ['clubs', 'diamonds', 'hearts', 'spades'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSeat(value: unknown): value is Seat {
  return value === 0 || value === 1;
}

function isCard(value: unknown): value is Card {
  return (
    isRecord(value) &&
    typeof value.rank === 'number' &&
    Number.isInteger(value.rank) &&
    value.rank >= 1 &&
    value.rank <= 13 &&
    typeof value.suit === 'string' &&
    SUITS.includes(value.suit)
  );
}

function isAction(value: unknown): value is Action {
  if (!isRecord(value) || !isSeat(value.seat)) return false;
  if (value.type === 'play') return isCard(value.card);
  if (value.type === 'discard') {
    return Array.isArray(value.cards) && value.cards.every(isCard);
  }
  return false;
}

function isSavedGame(value: unknown): value is SavedGame {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.seed === 'number' &&
    isSeat(value.human) &&
    typeof value.opponentRng === 'number' &&
    Array.isArray(value.actions) &&
    value.actions.every(isAction)
  );
}
