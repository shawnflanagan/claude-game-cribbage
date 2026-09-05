import type { GameResult, Seat } from '../../engine';

type Props = { result: GameResult; human: Seat; onNewGame: () => void };

export function GameOver({ result, human, onNewGame }: Props) {
  const won = result.winner === human;
  const skunk =
    result.skunk === 'double-skunk'
      ? 'A Double Skunk!'
      : result.skunk === 'skunk'
        ? 'A Skunk!'
        : null;
  return (
    <section className="game-over" role="dialog" aria-labelledby="result-title">
      <h2 id="result-title">{won ? 'You win!' : 'Computer wins.'}</h2>
      <p>
        You {result.scores[human]}, Computer{' '}
        {result.scores[human === 0 ? 1 : 0]}.
      </p>
      {skunk !== null && <p className="skunk">{skunk}</p>}
      <button type="button" className="action" onClick={onNewGame}>
        New game
      </button>
    </section>
  );
}
