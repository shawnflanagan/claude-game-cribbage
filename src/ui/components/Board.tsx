import {
  DOUBLE_SKUNK_LINE,
  SKUNK_LINE,
  WINNING_SCORE,
  otherSeat,
  type PerSeat,
  type Seat,
} from '../../engine';

// Layout, in SVG units. The 120 scoring holes before the game hole snake
// through four rows of thirty so the board stays readable on a phone.
const HOLES_PER_ROW = 30;
const ROWS = (WINNING_SCORE - 1) / HOLES_PER_ROW;
const HOLE_SPACING_X = 12;
const ROW_SPACING_Y = 14;
const TRACK_GAP = ROW_SPACING_Y;
const HOLE_RADIUS = 2.6;
const GAME_HOLE_RADIUS = 4;
const PEG_RADIUS = 4;

type Point = { readonly x: number; readonly y: number };

/** Where hole `hole` (0 to 121) sits on track `track` (0 above, 1 below). */
function holePosition(track: number, hole: number): Point {
  const top = track * (ROWS * ROW_SPACING_Y + TRACK_GAP);
  if (hole === 0) return { x: 0, y: top };
  if (hole >= WINNING_SCORE)
    return { x: 0, y: top + (ROWS - 1) * ROW_SPACING_Y };
  const index = hole - 1;
  const row = Math.floor(index / HOLES_PER_ROW);
  const col = index % HOLES_PER_ROW;
  const along = row % 2 === 0 ? col : HOLES_PER_ROW - 1 - col;
  return { x: HOLE_SPACING_X * (1 + along), y: top + row * ROW_SPACING_Y };
}

/** Hole positions never change, so they are computed once per track. */
const POSITIONS: readonly (readonly Point[])[] = [0, 1].map((track) =>
  Array.from({ length: WINNING_SCORE + 1 }, (_, hole) =>
    holePosition(track, hole),
  ),
);

function positionOf(track: number, hole: number): Point {
  return POSITIONS[track]?.[Math.min(hole, WINNING_SCORE)] ?? { x: 0, y: 0 };
}

const translate = ({ x, y }: Point) => `translate(${String(x)} ${String(y)})`;

function holeClass(hole: number): string {
  if (hole === WINNING_SCORE) return 'hole hole-game';
  if (hole === 0) return 'hole hole-start';
  return 'hole';
}

type Props = {
  scores: PerSeat<number>;
  /** The scores before the latest Tally, where the back pegs sit. */
  previous: PerSeat<number>;
  human: Seat;
};

/**
 * The cribbage board: a 121-hole track per Seat with a front and back
 * peg, so the board shows the current score and the one before it.
 */
export function Board({ scores, previous, human }: Props) {
  const width = HOLE_SPACING_X * (HOLES_PER_ROW + 2);
  const height = 2 * ROWS * ROW_SPACING_Y + TRACK_GAP;
  const seats: readonly Seat[] = [human, otherSeat(human)];
  return (
    <div className="board">
      <svg
        role="group"
        aria-label="Cribbage board"
        viewBox={`${String(-HOLE_SPACING_X / 2)} ${String(-ROW_SPACING_Y / 2)} ${String(width)} ${String(height)}`}
      >
        {seats.map((seat, track) => {
          const name = seat === human ? 'You' : 'Computer';
          return (
            <g
              key={seat}
              data-track={track}
              className={`track track-${String(track)}`}
            >
              {POSITIONS[track]?.map((point, hole) => (
                <circle
                  key={hole}
                  className={holeClass(hole)}
                  data-hole={hole}
                  cx={point.x}
                  cy={point.y}
                  r={hole === WINNING_SCORE ? GAME_HOLE_RADIUS : HOLE_RADIUS}
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
                transform={translate(positionOf(track, previous[seat]))}
              >
                <circle r={PEG_RADIUS} />
              </g>
              <g
                className="peg peg-front"
                role="img"
                aria-label={`${name}, front peg at ${String(scores[seat])}`}
                transform={translate(positionOf(track, scores[seat]))}
              >
                <circle r={PEG_RADIUS} />
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

type SkunkMarkProps = { track: number; before: number; label: string };

/** A tick across the track just before hole `before`, where a Skunk line falls. */
function SkunkMark({ track, before, label }: SkunkMarkProps) {
  const a = positionOf(track, before - 1);
  const b = positionOf(track, before);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const acrossRows = a.y !== b.y;
  const half = acrossRows ? ROW_SPACING_Y * 0.45 : HOLE_SPACING_X * 0.6;
  return (
    <line
      className="skunk-line"
      role="img"
      aria-label={label}
      x1={acrossRows ? mid.x : mid.x - half}
      x2={acrossRows ? mid.x : mid.x + half}
      y1={acrossRows ? mid.y - half : mid.y}
      y2={acrossRows ? mid.y + half : mid.y}
    />
  );
}
