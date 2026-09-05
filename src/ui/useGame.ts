import { useEffect, useReducer } from 'react';
import { seatsToAct, viewFor, type Action, type Card } from '../engine';
import type { Opponent } from '../opponent';
import {
  caughtUp,
  computerAct,
  computerToAct,
  humanAct,
  nextPause,
  reveal,
  startSession,
  type Pause,
  type Session,
} from './session';
import { clearSaved, loadSaved, saveGame } from './storage';

type Command =
  | { type: 'human'; action: Action }
  | { type: 'computer'; opponent: Opponent }
  | { type: 'reveal' }
  | { type: 'new-game'; seed: number };

function reduce(session: Session, command: Command): Session {
  switch (command.type) {
    case 'human':
      return humanAct(session, command.action);
    case 'computer':
      return computerAct(session, command.opponent) ?? session;
    case 'reveal':
      return reveal(session);
    case 'new-game':
      return startSession(command.seed);
  }
}

export type Game = {
  readonly session: Session;
  readonly pause: Pause;
  /** True when the table shows the engine's real state and the human must act. */
  readonly humanToAct: boolean;
  /** The human's legal Pegging cards, empty unless it is their turn to play. */
  readonly legal: readonly Card[];
  readonly act: (action: Action) => void;
  readonly continueShow: () => void;
  readonly newGame: (seed: number) => void;
};

/**
 * Owns one Game for the UI: applies the human's Actions, lets the opponent
 * move whenever the engine is waiting on it, and walks the presentation
 * cursor at a human pace. `pace` scales every delay; 0 makes tests instant.
 * A saved Game in `storage` takes precedence over `seed`, which only seeds
 * the first Game; later Games come from `newGame`.
 */
export function useGame(
  seed: number,
  opponent: Opponent,
  pace = 1,
  storage: Storage | null = null,
): Game {
  const [session, dispatch] = useReducer(
    reduce,
    null,
    () => (storage === null ? null : loadSaved(storage)) ?? startSession(seed),
  );
  const pause = nextPause(session);

  // Save after every decision of the human's; a Game they have not yet
  // touched is not worth keeping, so New game leaves nothing behind.
  const decisions = session.actions.filter(
    (a) => a.seat === session.human,
  ).length;
  useEffect(() => {
    if (storage === null) return;
    if (decisions === 0) clearSaved(storage);
    else saveGame(storage, session);
  }, [storage, decisions, session]);

  useEffect(() => {
    if (computerToAct(session)) dispatch({ type: 'computer', opponent });
  }, [session, opponent]);

  const delay = pause.kind === 'after' ? pause.ms * pace : null;
  useEffect(() => {
    if (delay === null) return;
    const timer = setTimeout(() => {
      dispatch({ type: 'reveal' });
    }, delay);
    return () => {
      clearTimeout(timer);
    };
  }, [session.revealed, session.events.length, delay]);

  const view = viewFor(session.engine, session.human);
  const humanToAct =
    caughtUp(session) && seatsToAct(view).includes(session.human);

  return {
    session,
    pause,
    humanToAct,
    legal: humanToAct ? (view.pegging?.legal ?? []) : [],
    act: (action) => {
      dispatch({ type: 'human', action });
    },
    continueShow: () => {
      dispatch({ type: 'reveal' });
    },
    newGame: (next) => {
      dispatch({ type: 'new-game', seed: next });
    },
  };
}
