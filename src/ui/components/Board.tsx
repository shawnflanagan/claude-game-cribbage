import { otherSeat, type PerSeat, type Seat } from '../../engine';
import {
  boardGeometry,
  pegPosition,
  type BoardGeometry,
  type Point,
  type SkunkLine,
  type Track,
} from '../board';

const HOLE_RADIUS = 2.6;
const GAME_HOLE_RADIUS = 4;
const PEG_RADIUS = 4;

// The two Folds: one Turn on a wide screen, three on a phone. CSS shows one.
const WIDE = boardGeometry({ holesPerLeg: 60, numeralStep: 10 });
const NARROW = boardGeometry({ holesPerLeg: 30, numeralStep: 30 });

const SKUNK_TEXT: Record<SkunkLine['kind'], { name: string; letter: string }> =
  {
    skunk: { name: 'Skunk line', letter: 'S' },
    'double-skunk': { name: 'Double Skunk line', letter: 'SS' },
  };

type Props = {
  scores: PerSeat<number>;
  /** The scores before the latest Tally, where the back Pegs sit. */
  previous: PerSeat<number>;
  human: Seat;
};

/**
 * The Board: two Tracks side by side, out along the bottom Leg, round a
 * Turn and back, with a front and back Peg per Seat so the Board shows the
 * score and the one before it. The human's Track is the outer one.
 */
export function Board(props: Props) {
  return (
    <div className="board">
      <Fold {...props} geometry={WIDE} name="wide" />
      <Fold {...props} geometry={NARROW} name="narrow" />
    </div>
  );
}

type FoldProps = Props & { geometry: BoardGeometry; name: 'wide' | 'narrow' };

function Fold({ scores, previous, human, geometry, name }: FoldProps) {
  const { viewBox } = geometry;
  const tracks: readonly { track: Track; seat: Seat }[] = [
    { track: 0, seat: human },
    { track: 1, seat: otherSeat(human) },
  ];
  return (
    <svg
      className={`board-${name}`}
      role="group"
      aria-label="Cribbage board"
      viewBox={`${String(viewBox.x)} ${String(viewBox.y)} ${String(viewBox.width)} ${String(viewBox.height)}`}
    >
      {tracks.map(({ track, seat }) => {
        const who = seat === human ? 'You' : 'Computer';
        return (
          <g
            key={track}
            data-track={track}
            className={`track track-${String(track)}`}
          >
            <path className="track-band" d={geometry.band[track]} />
            {geometry.startHoles[track].map((point, i) => (
              <Hole key={`start-${String(i)}`} at={point} kind="start" />
            ))}
            {geometry.holes[track].map((point, i) => (
              <Hole key={i} at={point} hole={i + 1} />
            ))}
            <Hole at={geometry.gameHole[track]} kind="game" />
            <Peg
              kind="back"
              label={`${who}, back peg at ${String(previous[seat])}`}
              at={pegPosition(geometry, track, previous[seat], 'back')}
            />
            <Peg
              kind="front"
              label={`${who}, front peg at ${String(scores[seat])}`}
              at={pegPosition(geometry, track, scores[seat], 'front')}
            />
          </g>
        );
      })}
      {geometry.numerals.map((n) => (
        <Label key={n.hole} at={n.at}>
          {n.hole}
        </Label>
      ))}
      <Label
        at={{
          x: geometry.gameHole[0].x - GAME_HOLE_RADIUS - 3,
          y: (geometry.gameHole[0].y + geometry.gameHole[1].y) / 2,
        }}
        anchor="end"
      >
        121
      </Label>
      {geometry.skunkLines.map((line) => (
        <g key={line.kind}>
          <line
            className="skunk-line"
            role="img"
            aria-label={SKUNK_TEXT[line.kind].name}
            x1={line.tick.from.x}
            y1={line.tick.from.y}
            x2={line.tick.to.x}
            y2={line.tick.to.y}
          />
          <Label at={line.letter} className="board-skunk">
            {SKUNK_TEXT[line.kind].letter}
          </Label>
        </g>
      ))}
    </svg>
  );
}

type HoleProps = { at: Point; hole?: number; kind?: 'start' | 'game' };

function Hole({ at, hole, kind }: HoleProps) {
  return (
    <circle
      className={kind === undefined ? 'hole' : `hole hole-${kind}`}
      data-hole={hole}
      cx={at.x}
      cy={at.y}
      r={kind === 'game' ? GAME_HOLE_RADIUS : HOLE_RADIUS}
    />
  );
}

type LabelProps = {
  at: Point;
  anchor?: 'middle' | 'end';
  className?: string;
  children: React.ReactNode;
};

/** Text printed on the wood: numerals, the Skunk letters, 121. */
function Label({ at, anchor = 'middle', className, children }: LabelProps) {
  return (
    <text
      className={
        className === undefined ? 'board-text' : `board-text ${className}`
      }
      x={at.x}
      y={at.y}
      textAnchor={anchor}
      dominantBaseline="middle"
    >
      {children}
    </text>
  );
}

type PegProps = { kind: 'front' | 'back'; label: string; at: Point };

/** A pin: its shadow on the wood, a coloured head, and a glint of light. */
function Peg({ kind, label, at }: PegProps) {
  return (
    <g
      className={`peg peg-${kind}`}
      role="img"
      aria-label={label}
      transform={`translate(${String(at.x)} ${String(at.y)})`}
    >
      <ellipse className="peg-shadow" cx={0.8} cy={1.4} rx={4.4} ry={2.6} />
      <circle className="peg-head" r={PEG_RADIUS} />
      <circle className="peg-shine" cx={-1.3} cy={-1.4} r={1.2} />
    </g>
  );
}
