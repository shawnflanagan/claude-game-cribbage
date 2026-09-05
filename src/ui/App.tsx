import { viewFor } from '../engine';
import { randomOpponent } from '../opponent';
import { GameOver } from './components/GameOver';
import { Log } from './components/Log';
import { Table } from './components/Table';
import { present } from './session';
import { useGame } from './useGame';

type Props = {
  seed?: number;
  /** Scales the presentation delays; 0 makes everything instant for tests. */
  pace?: number;
  confirmNewGame?: () => boolean;
};

export function App({
  seed = freshSeed(),
  pace = 1,
  confirmNewGame = () =>
    window.confirm('Abandon this game and start a new one?'),
}: Props) {
  const game = useGame(seed, randomOpponent, pace);
  const { session } = game;
  const human = session.human;
  const model = present(session);
  const view = viewFor(session.engine, human);
  const legal = game.humanToAct ? (view.pegging?.legal ?? []) : [];
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
            Computer <strong>{model.scores[human === 0 ? 1 : 0]}</strong>
          </span>
        </div>
        <button type="button" className="quiet" onClick={startNew}>
          New game
        </button>
      </header>
      {model.stage === 'over' && model.result !== null ? (
        <GameOver result={model.result} human={human} onNewGame={startNew} />
      ) : null}
      <Table
        model={model}
        human={human}
        legal={legal}
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
