import { otherSeat, type PerSeat, type Seat } from '../../engine';

const HOLES_PER_ROW = 30;
const ROWS = 4;
const DX = 12;
const DY = 14;
const TRACK_GAP = DY;
const GAME_HOLE = 121;
const SKUNK_LINE = 91;
const DOUBLE_SKUNK_LINE = 61;

type Props = {
  scores: PerSeat<number>;
  /** The scores before the latest Tally, where the back pegs sit. */
  previous: PerSeat<number>;
  human: Seat;
};

/** Where hole `hole` (0 to 121) sits on track `track` (0 above, 1 below). */
function holePosition(track: number, hole: number): { x: number; y: number } {
  const top = track * (ROWS * DY + TRACK_GAP);
  if (hole === 0) return { x: 0, y: top };
  if (hole >= GAME_HOLE) return { x: 0, y: top + (ROWS - 1) * DY };
  const index = hole - 1;
  const row = Math.floor(index / HOLES_PER_ROW);
  const col = index % HOLES_PER_ROW;
  // Rows snake: left to right, then back, so the track reads as one path.
  const along = row % 2 === 0 ? col : HOLES_PER_ROW - 1 - col;
  return { x: DX * (1 + along), y: top + row * DY };
}

const at = ({ x, y }: { x: number; y: number }) =>
  `translate(${String(x)} ${String(y)})`;

/**
 * The cribbage board: a 121-hole track per player with a front and back
 * peg, so the board shows the current score and the one before it.
 */
export function Board({ scores, previous, human }: Props) {
  const width = DX * (HOLES_PER_ROW + 2);
  const height = 2 * ROWS * DY + TRACK_GAP;
  // The human always reads the top track.
  const seats: readonly Seat[] = [human, otherSeat(human)];
  return (
    <div className="board">
      <svg
        role="img"
        aria-label="Cribbage board"
        viewBox={`${String(-DX / 2)} ${String(-DY / 2)} ${String(width)} ${String(height)}`}
      >
        {seats.map((seat, track) => {
          const name = seat === human ? 'You' : 'Computer';
          return (
            <g
              key={seat}
              data-track={track}
              className={`track track-${String(track)}`}
            >
              {Array.from({ length: GAME_HOLE + 1 }, (_, hole) => (
                <circle
                  key={hole}
                  className={
                    hole === GAME_HOLE
                      ? 'hole hole-game'
                      : hole === 0
                        ? 'hole hole-start'
                        : 'hole'
                  }
                  data-hole={hole}
                  data-at={at(holePosition(track, hole))}
                  cx={holePosition(track, hole).x}
                  cy={holePosition(track, hole).y}
                  r={hole === GAME_HOLE ? 4 : 2.6}
                />
              ))}
              <SkunkMark
                track={track}
                before={DOUBLE_SKUNK_LINE}
                label="Double Skunk line"
              />
              <SkunkMark track={track} before={SKUNK_LINE} label="Skunk line" />
              <g
                className="peg peg-back"
                role="img"
                aria-label={`${name}, back peg at ${String(previous[seat])}`}
                transform={at(holePosition(track, previous[seat]))}
              >
                <circle r={4} />
              </g>
              <g
                className="peg peg-front"
                role="img"
                aria-label={`${name}, front peg at ${String(scores[seat])}`}
                transform={at(holePosition(track, scores[seat]))}
              >
                <circle r={4} />
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** A tick between hole `before - 1` and hole `before`. */
function SkunkMark({
  track,
  before,
  label,
}: {
  track: number;
  before: number;
  label: string;
}) {
  const a = holePosition(track, before - 1);
  const b = holePosition(track, before);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const horizontal = a.y === b.y;
  return (
    <line
      className="skunk-line"
      role="img"
      aria-label={label}
      x1={horizontal ? mid.x : mid.x - DX * 0.6}
      x2={horizontal ? mid.x : mid.x + DX * 0.6}
      y1={horizontal ? mid.y - DY * 0.45 : mid.y}
      y2={horizontal ? mid.y + DY * 0.45 : mid.y}
    />
  );
}
