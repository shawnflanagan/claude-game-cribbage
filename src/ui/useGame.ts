import { useEffect, useReducer } from 'react';
import { seatsToAct, viewFor, type Action, type Seat } from '../engine';
import type { Opponent } from '../opponent';
import {
  caughtUp,
  computerAct,
  humanAct,
  nextPause,
  reveal,
  startSession,
  type Pause,
  type Session,
} from './session';

type Dispatch =
  | { type: 'human'; action: Action }
  | { type: 'computer'; opponent: Opponent }
  | { type: 'reveal' }
  | { type: 'new-game'; seed: number };

function reduce(session: Session, message: Dispatch): Session {
  switch (message.type) {
    case 'human':
      return humanAct(session, message.action);
    case 'computer':
      return computerAct(session, message.opponent) ?? session;
    case 'reveal':
      return reveal(session);
    case 'new-game':
      return startSession(message.seed);
  }
}

export type Game = {
  readonly session: Session;
  readonly pause: Pause;
  /** True when the table shows the engine's real state and the human must act. */
  readonly humanToAct: boolean;
  readonly act: (action: Action) => void;
  readonly continueShow: () => void;
  readonly newGame: (seed: number) => void;
};

/**
 * Owns one Game for the UI: applies the human's Actions, lets the opponent
 * move whenever the engine is waiting on it, and walks the presentation
 * cursor at a human pace. `pace` scales every delay; 0 makes tests instant.
 */
export function useGame(seed: number, opponent: Opponent, pace = 1): Game {
  const [session, dispatch] = useReducer(reduce, seed, startSession);
  const human: Seat = session.human;
  const pause = nextPause(session, human);

  useEffect(() => {
    const computer: Seat = human === 0 ? 1 : 0;
    if (seatsToAct(viewFor(session.engine, computer)).includes(computer)) {
      dispatch({ type: 'computer', opponent });
    }
  }, [session, human, opponent]);

  useEffect(() => {
    if (pause.kind !== 'after') return;
    const timer = setTimeout(() => {
      dispatch({ type: 'reveal' });
    }, pause.ms * pace);
    return () => {
      clearTimeout(timer);
    };
  }, [session, pause, pace]);

  const humanToAct =
    caughtUp(session) &&
    seatsToAct(viewFor(session.engine, human)).includes(human);

  return {
    session,
    pause,
    humanToAct,
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
