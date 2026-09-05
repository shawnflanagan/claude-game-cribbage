import { otherSeat, type GameResult, type Seat } from '../../engine';
import { describeSkunk } from '../log';

type Props = { result: GameResult; human: Seat; onNewGame: () => void };

export function GameOver({ result, human, onNewGame }: Props) {
  const won = result.winner === human;
  const skunk = describeSkunk(result);
  return (
    <section className="game-over" aria-labelledby="result-title">
      <h2 id="result-title">{won ? 'You win!' : 'Computer wins.'}</h2>
      <p>
        You {result.scores[human]}, Computer {result.scores[otherSeat(human)]}.
      </p>
      {skunk !== null && <p className="skunk">{skunk}</p>}
      <button type="button" className="action" onClick={onNewGame} autoFocus>
        New game
      </button>
    </section>
  );
}
