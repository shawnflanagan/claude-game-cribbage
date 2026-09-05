import { useEffect, useState } from 'react';
import { otherSeat, type PerSeat } from '../engine';
import { heuristicOpponent } from '../opponent';
import { Board } from './components/Board';
import { Log } from './components/Log';
import { Table } from './components/Table';
import {
  EMPTY_RECORD,
  gameKey,
  loadRecord,
  recordGame,
  saveRecord,
} from './record';
import { present } from './session';
import { useGame } from './useGame';

type Props = {
  /** Seed of the first Game; a fresh one is drawn when omitted. */
  seed?: number;
  /** Scores the first Game starts from: a handicap, or a short Game in tests. */
  startingScores?: PerSeat<number>;
  /** Scales the presentation delays; 0 makes everything instant for tests. */
  pace?: number;
  confirmNewGame?: () => boolean;
  confirmResetRecord?: () => boolean;
  /** Where the Game in progress and the Record are kept; null keeps nothing. */
  storage?: Storage | null;
};

export function App({
  seed,
  startingScores,
  pace = 1,
  confirmNewGame = () =>
    window.confirm('Abandon this game and start a new one?'),
  confirmResetRecord = () => window.confirm('Reset the record to nothing?'),
  storage = browserStorage(),
}: Props) {
  const [firstSeed] = useState(() => seed ?? freshSeed());
  const game = useGame(
    firstSeed,
    heuristicOpponent,
    pace,
    storage,
    startingScores === undefined ? {} : { scores: startingScores },
  );
  const { session } = game;
  const human = session.human;
  const model = present(session);
  const startNew = () => {
    if (model.stage === 'over' || confirmNewGame()) game.newGame(freshSeed());
  };

  // The Record grows when the win is revealed, never for an abandoned Game.
  const [record, setRecord] = useState(() =>
    storage === null ? EMPTY_RECORD : loadRecord(storage),
  );
  const { result } = model;
  const key = gameKey(session.seed, session.actions.length);
  useEffect(() => {
    if (result === null) return;
    const next = recordGame(record, result, human, key);
    if (next === record) return;
    if (storage !== null) saveRecord(storage, next);
    setRecord(next);
  }, [result, human, key, record, storage]);
  // A reset leaves the Game on screen uncounted too, so the slate is clean.
  const resetRecord = () => {
    if (!confirmResetRecord()) return;
    const cleared = { ...EMPTY_RECORD, lastGame: result === null ? null : key };
    if (storage !== null) saveRecord(storage, cleared);
    setRecord(cleared);
  };
  return (
    <div className="app">
      <header className="top">
        <h1>Cribbage</h1>
        <div className="scores" aria-label="Scores">
          <span>
            You <strong>{model.scores[human]}</strong>
          </span>
          <span>
            Computer <strong>{model.scores[otherSeat(human)]}</strong>
          </span>
          {model.round > 0 && (
            <span className="round">Round {model.round}</span>
          )}
        </div>
        <nav className="top-actions">
          <a className="quiet quiet-link" href="#log">
            Log
          </a>
          <button type="button" className="quiet" onClick={startNew}>
            New game
          </button>
        </nav>
      </header>
      <Board
        scores={model.scores}
        previous={model.previousScores}
        human={human}
      />
      <Table
        model={model}
        human={human}
        legal={game.legal}
        humanToAct={game.humanToAct}
        pause={game.pause}
        onAct={game.act}
        onContinue={game.continueShow}
        onNewGame={startNew}
        record={record}
        onResetRecord={resetRecord}
      />
      <Log events={session.events.slice(0, session.revealed)} human={human} />
    </div>
  );
}

function freshSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
