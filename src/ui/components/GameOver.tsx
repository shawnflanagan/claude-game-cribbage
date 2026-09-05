import { otherSeat, type GameResult, type Seat } from '../../engine';
import { describeSkunk } from '../log';
import { describeRecord, type GameRecord } from '../record';

type Props = {
  result: GameResult;
  human: Seat;
  record: GameRecord;
  onNewGame: () => void;
  onResetRecord: () => void;
};

export function GameOver({
  result,
  human,
  record,
  onNewGame,
  onResetRecord,
}: Props) {
  const won = result.winner === human;
  const skunk = describeSkunk(result);
  const shown = describeRecord(record);
  return (
    <section className="game-over" aria-labelledby="result-title">
      <h2 id="result-title">{won ? 'You win!' : 'Computer wins.'}</h2>
      <p>
        You {result.scores[human]}, Computer {result.scores[otherSeat(human)]}.
      </p>
      {skunk !== null && <p className="skunk">{skunk}</p>}
      <div className="record" aria-label="Record">
        <p className="record-lead">{shown.lead}</p>
        {shown.skunks !== null && (
          <p className="record-skunks">{shown.skunks}</p>
        )}
      </div>
      <button type="button" className="action" onClick={onNewGame} autoFocus>
        New game
      </button>
      <button
        type="button"
        className="quiet quiet-dark"
        onClick={onResetRecord}
      >
        Reset record
      </button>
    </section>
  );
}
