import { useState } from 'react';
import { otherSeat } from '../engine';
import { heuristicOpponent } from '../opponent';
import { Board } from './components/Board';
import { GameOver } from './components/GameOver';
import { Log } from './components/Log';
import { Table } from './components/Table';
import { present } from './session';
import { useGame } from './useGame';

type Props = {
  /** Seed of the first Game; a fresh one is drawn when omitted. */
  seed?: number;
  /** Scales the presentation delays; 0 makes everything instant for tests. */
  pace?: number;
  confirmNewGame?: () => boolean;
  /** Where the Game in progress is kept between visits; null keeps nothing. */
  storage?: Storage | null;
};

export function App({
  seed,
  pace = 1,
  confirmNewGame = () =>
    window.confirm('Abandon this game and start a new one?'),
  storage = browserStorage(),
}: Props) {
  const [firstSeed] = useState(() => seed ?? freshSeed());
  const game = useGame(firstSeed, heuristicOpponent, pace, storage);
  const { session } = game;
  const human = session.human;
  const model = present(session);
  const startNew = () => {
    if (model.stage === 'over' || confirmNewGame()) game.newGame(freshSeed());
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
        <button type="button" className="quiet" onClick={startNew}>
          New game
        </button>
      </header>
      <Board
        scores={model.scores}
        previous={model.previousScores}
        human={human}
      />
      {model.stage === 'over' && model.result !== null ? (
        <GameOver result={model.result} human={human} onNewGame={startNew} />
      ) : null}
      <Table
        model={model}
        human={human}
        legal={game.legal}
        humanToAct={game.humanToAct}
        pause={game.pause}
        onAct={game.act}
        onContinue={game.continueShow}
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
