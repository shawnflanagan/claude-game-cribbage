import {
  DOUBLE_SKUNK_LINE,
  SKUNK_LINE,
  WINNING_SCORE,
  type PerSeat,
} from '../engine';

export type Point = { readonly x: number; readonly y: number };
export type Segment = { readonly from: Point; readonly to: Point };

/** Track 0 is the outer Track on the first Leg; the human's, nearest their Hand. */
export type Track = 0 | 1;

export type Numeral = { readonly hole: number; readonly at: Point };

export type SkunkLine = {
  readonly kind: 'skunk' | 'double-skunk';
  /** The Hole the line falls before. */
  readonly before: number;
  /** One tick spanning both Tracks. */
  readonly tick: Segment;
  /** Where its letter goes: on the outer edge, clear of the numerals. */
  readonly letter: Point;
};

/** A Turn joins two Legs; each Track rounds it on its own radius. */
export type Turn = { readonly centre: Point; readonly radius: PerSeat<number> };

/**
 * Where everything on the Board sits, in SVG units. Holes lie on the Legs
 * only; each Turn is a bare arc of Track joining one Leg to the next.
 */
export type BoardGeometry = {
  readonly legs: number;
  /** Holes 1 to 120 of each Track, so Hole n is at index n - 1. */
  readonly holes: PerSeat<readonly Point[]>;
  readonly startHoles: PerSeat<readonly [Point, Point]>;
  readonly gameHole: PerSeat<Point>;
  /** The painted band of each Track as an SVG path, Start Holes to Game Hole. */
  readonly band: PerSeat<string>;
  readonly turns: readonly Turn[];
  readonly numerals: readonly Numeral[];
  readonly skunkLines: readonly SkunkLine[];
  readonly viewBox: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
};

export type BoardOptions = {
  /** 60 draws one Turn; 30 folds the Track through three for a phone. */
  readonly holesPerLeg: number;
  /** Numerals on every Hole that is a multiple of this. */
  readonly numeralStep: number;
};

const HOLE_SPACING = 12;
const GROUP_GAP = 4;
const HOLES_PER_GROUP = 5;
/** Between the two Tracks, perpendicular to a Leg. */
const TRACK_GAP = 12;
/** Between the centre lines of neighbouring Legs. */
const LEG_PITCH = 36;
const START_GAP = HOLE_SPACING * 1.5;
const EDGE = 10;
/** From a Leg's centre line out to its numerals and letters. */
const TEXT_OFFSET = TRACK_GAP / 2 + 11;
/** How far a Skunk tick reaches past the Tracks on either side. */
const TICK_REACH = TRACK_GAP / 2 + 4;

const SCORING_HOLES = WINNING_SCORE - 1;

/** Distance along a Leg from its first Hole to Hole `k` (0-based). */
function along(k: number): number {
  return k * HOLE_SPACING + Math.floor(k / HOLES_PER_GROUP) * GROUP_GAP;
}

/** Even Legs run right and their outer edge is below; odd Legs the reverse. */
function direction(leg: number): 1 | -1 {
  return leg % 2 === 0 ? 1 : -1;
}

function perTrack<T>(make: (track: Track) => T): PerSeat<T> {
  return [make(0), make(1)];
}

export function boardGeometry(options: BoardOptions): BoardGeometry {
  const { holesPerLeg, numeralStep } = options;
  const legs = SCORING_HOLES / holesPerLeg;
  const legLength = along(holesPerLeg - 1);
  const left = START_GAP * 2;
  const right = left + legLength;

  // Leg i's centre line; Legs climb from the bottom.
  const legY = (leg: number) => -leg * LEG_PITCH;
  // Track 0 sits outside on even Legs (below) and inside on odd ones (above),
  // which is what keeps the Tracks in the same order through every Turn.
  const offsetSign = (track: Track, leg: number) =>
    (track === 0 ? 1 : -1) * direction(leg);
  const trackY = (track: Track, leg: number) =>
    legY(leg) + (offsetSign(track, leg) * TRACK_GAP) / 2;
  const legX = (leg: number, k: number) =>
    direction(leg) === 1 ? left + along(k) : right - along(k);
  /** The end of a Leg, where its Turn begins. */
  const legEnd = (leg: number) => (direction(leg) === 1 ? right : left);
  const legOf = (hole: number) => Math.floor((hole - 1) / holesPerLeg);

  const holeAt = (track: Track, hole: number): Point => {
    const leg = legOf(hole);
    return { x: legX(leg, (hole - 1) % holesPerLeg), y: trackY(track, leg) };
  };

  const holes = perTrack((track) =>
    Array.from({ length: SCORING_HOLES }, (_, i) => holeAt(track, i + 1)),
  );

  const startHoles = perTrack((track): readonly [Point, Point] => [
    { x: left - START_GAP * 2, y: trackY(track, 0) },
    { x: left - START_GAP, y: trackY(track, 0) },
  ]);

  // Legs come in an even number, so the last one heads left and ends where
  // the Track began; the Game Hole waits just beyond it.
  const lastLeg = legs - 1;
  const gameHole = perTrack((track) => ({
    x: left - START_GAP,
    y: trackY(track, lastLeg),
  }));

  const turns: Turn[] = Array.from({ length: legs - 1 }, (_, leg) => ({
    centre: { x: legEnd(leg), y: (legY(leg) + legY(leg + 1)) / 2 },
    radius: perTrack(
      (track) => Math.abs(trackY(track, leg + 1) - trackY(track, leg)) / 2,
    ),
  }));

  const band = perTrack((track) => {
    const start = startHoles[track][0];
    const parts = [`M ${fmt(start.x)} ${fmt(start.y)}`];
    for (let leg = 0; leg < legs; leg++) {
      const end = legEnd(leg);
      parts.push(`L ${fmt(end)} ${fmt(trackY(track, leg))}`);
      const turn = turns[leg];
      if (turn !== undefined) {
        const radius = turn.radius[track];
        // Turning up at the right end sweeps against the clock; at the left, with it.
        const sweep = direction(leg) === 1 ? 0 : 1;
        parts.push(
          `A ${fmt(radius)} ${fmt(radius)} 0 0 ${String(sweep)} ${fmt(end)} ${fmt(trackY(track, leg + 1))}`,
        );
      }
    }
    const finish = gameHole[track];
    parts.push(`L ${fmt(finish.x)} ${fmt(finish.y)}`);
    return parts.join(' ');
  });

  // Numerals along the outer edge of whichever Leg the Hole is on.
  const numerals: Numeral[] = [];
  for (let hole = numeralStep; hole <= SCORING_HOLES; hole += numeralStep) {
    const leg = legOf(hole);
    numerals.push({
      hole,
      at: { x: holeAt(0, hole).x, y: legY(leg) + direction(leg) * TEXT_OFFSET },
    });
  }

  function skunkLine(kind: SkunkLine['kind'], before: number): SkunkLine {
    const legBefore = legOf(before - 1);
    const legAfter = legOf(before);
    if (legBefore === legAfter) {
      const x = (holeAt(0, before - 1).x + holeAt(0, before).x) / 2;
      const y = legY(legBefore);
      const outward = direction(legBefore);
      // The numeral before the line sits behind the tick, so the letter goes
      // a little way ahead of it along the Leg.
      return {
        kind,
        before,
        tick: {
          from: { x, y: y - TICK_REACH },
          to: { x, y: y + TICK_REACH },
        },
        letter: { x: x + outward * 7, y: y + outward * TEXT_OFFSET },
      };
    }
    // The line falls in a Turn: a radial tick at the apex of the arc.
    const turn = turns[legBefore];
    if (turn === undefined)
      throw new Error('a Skunk line beyond the last Turn');
    const outward = direction(legBefore);
    const inner = LEG_PITCH / 2 - TICK_REACH;
    const outer = LEG_PITCH / 2 + TICK_REACH;
    const { centre } = turn;
    return {
      kind,
      before,
      tick: {
        from: { x: centre.x + outward * inner, y: centre.y },
        to: { x: centre.x + outward * outer, y: centre.y },
      },
      letter: { x: centre.x + outward * (outer + 7), y: centre.y },
    };
  }

  const skunkLines = [
    skunkLine('double-skunk', DOUBLE_SKUNK_LINE),
    skunkLine('skunk', SKUNK_LINE),
  ];

  // The viewBox wraps everything drawn: Holes, the outer edge of each Turn,
  // and the text, with a margin all round.
  const drawn: Point[] = [
    ...holes[0],
    ...holes[1],
    ...startHoles[0],
    ...startHoles[1],
    ...gameHole,
    ...numerals.map((n) => n.at),
    ...skunkLines.flatMap((m) => [m.tick.from, m.tick.to, m.letter]),
    ...turns.flatMap((t) => {
      const reach = Math.max(...t.radius);
      return [
        { x: t.centre.x - reach, y: t.centre.y },
        { x: t.centre.x + reach, y: t.centre.y },
      ];
    }),
    { x: left, y: legY(lastLeg) - TRACK_GAP / 2 },
    { x: left, y: TRACK_GAP / 2 },
  ];
  const xs = drawn.map((p) => p.x);
  const ys = drawn.map((p) => p.y);
  const minX = Math.min(...xs) - EDGE;
  const minY = Math.min(...ys) - EDGE;
  const viewBox = {
    x: minX,
    y: minY,
    width: Math.max(...xs) + EDGE - minX,
    height: Math.max(...ys) + EDGE - minY,
  };

  return {
    legs,
    holes,
    startHoles,
    gameHole,
    band,
    turns,
    numerals,
    skunkLines,
    viewBox,
  };
}

/**
 * Where a Peg sits for a score: the Start Holes at zero (the back Peg in the
 * first, the front in the second), the Game Hole from 121 up, else its Hole.
 */
export function pegPosition(
  board: BoardGeometry,
  track: Track,
  score: number,
  peg: 'front' | 'back',
): Point {
  if (score <= 0) return board.startHoles[track][peg === 'front' ? 1 : 0];
  if (score >= WINNING_SCORE) return board.gameHole[track];
  return board.holes[track][score - 1] ?? board.gameHole[track];
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}
