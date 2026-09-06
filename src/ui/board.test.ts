import { describe, expect, it } from 'vitest';
import { WINNING_SCORE } from '../engine';
import {
  boardGeometry,
  pegPosition,
  type BoardGeometry,
  type Point,
} from './board';

const close = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Hole n of a Track, failing loudly rather than returning undefined. */
function hole(board: BoardGeometry, track: 0 | 1, n: number): Point {
  const at = board.holes[track][n - 1];
  if (at === undefined) throw new Error(`no Hole ${String(n)}`);
  return at;
}

describe.each([
  { holesPerLeg: 60, legs: 2 },
  { holesPerLeg: 30, legs: 4 },
])('the Board with $holesPerLeg Holes per Leg', ({ holesPerLeg, legs }) => {
  const board = boardGeometry({ holesPerLeg, numeralStep: 10 });

  it('has two Start Holes, Holes 1 to 120, and a Game Hole on each Track', () => {
    for (const track of [0, 1] as const) {
      expect(board.startHoles[track]).toHaveLength(2);
      expect(board.holes[track]).toHaveLength(WINNING_SCORE - 1);
      expect(board.gameHole[track]).toBeDefined();
    }
    expect(board.legs).toBe(legs);
  });

  it('never puts two Holes of a Track in the same place', () => {
    for (const track of [0, 1] as const) {
      const all = [
        ...board.startHoles[track],
        ...board.holes[track],
        board.gameHole[track],
      ];
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i];
          const b = all[j];
          if (a === undefined || b === undefined) throw new Error('missing');
          expect(distance(a, b)).toBeGreaterThan(6);
        }
      }
    }
  });

  it('keeps the two Tracks apart everywhere, Turns included', () => {
    const everything = (track: 0 | 1) => [
      ...board.startHoles[track],
      ...board.holes[track],
      board.gameHole[track],
    ];
    for (const a of everything(0)) {
      for (const b of everything(1)) {
        expect(distance(a, b)).toBeGreaterThan(6);
      }
    }
    expect(board.turns).toHaveLength(legs - 1);
    for (const turn of board.turns) {
      expect(Math.abs(turn.radius[0] - turn.radius[1])).toBeGreaterThan(6);
      expect(Math.min(...turn.radius)).toBeGreaterThan(6);
    }
  });

  it('runs each Leg the opposite way to the one before, starting rightwards', () => {
    for (let leg = 0; leg < legs; leg++) {
      const first = hole(board, 0, leg * holesPerLeg + 1);
      const last = hole(board, 0, (leg + 1) * holesPerLeg);
      expect(first.y).toBeCloseTo(last.y);
      if (leg % 2 === 0) expect(last.x).toBeGreaterThan(first.x);
      else expect(last.x).toBeLessThan(first.x);
      if (leg > 0) {
        expect(first.y).toBeLessThan(
          hole(board, 0, (leg - 1) * holesPerLeg + 1).y,
        );
      }
    }
  });

  it('puts your Track on the outside of the first Leg, nearest your Hand', () => {
    expect(hole(board, 0, 1).y).toBeGreaterThan(hole(board, 1, 1).y);
  });

  it('places the Start Holes before Hole 1 and the Game Hole after Hole 120', () => {
    for (const track of [0, 1] as const) {
      const [first, second] = board.startHoles[track];
      const one = hole(board, track, 1);
      const last = hole(board, track, WINNING_SCORE - 1);
      expect(first.x).toBeLessThan(second.x);
      expect(second.x).toBeLessThan(one.x);
      expect(first.y).toBeCloseTo(one.y);
      // The last Leg heads left, so the Game Hole lies beyond it on the left.
      expect(board.gameHole[track].x).toBeLessThan(last.x);
      expect(board.gameHole[track].y).toBeCloseTo(last.y);
    }
  });

  it('leaves a wider gap after every fifth Hole', () => {
    const within = distance(hole(board, 0, 1), hole(board, 0, 2));
    expect(distance(hole(board, 0, 2), hole(board, 0, 3))).toBeCloseTo(within);
    expect(distance(hole(board, 0, 5), hole(board, 0, 6))).toBeGreaterThan(
      within,
    );
  });

  it('marks the Skunk lines before Holes 61 and 91, spanning both Tracks', () => {
    expect(board.skunkLines.map((m) => [m.kind, m.before])).toEqual([
      ['double-skunk', 61],
      ['skunk', 91],
    ]);
    const across = distance(hole(board, 0, 1), hole(board, 1, 1));
    for (const line of board.skunkLines) {
      expect(distance(line.tick.from, line.tick.to)).toBeGreaterThan(across);
    }
  });

  it('keeps each Skunk letter clear of every numeral', () => {
    for (const line of board.skunkLines) {
      for (const numeral of board.numerals) {
        expect(distance(line.letter, numeral.at)).toBeGreaterThan(8);
      }
    }
  });

  it('numbers every tenth Hole once, along the outer edge', () => {
    expect(board.numerals.map((n) => n.hole)).toEqual(
      Array.from({ length: 12 }, (_, i) => (i + 1) * 10),
    );
    const ten = board.numerals[0];
    if (ten === undefined) throw new Error('no numeral');
    expect(ten.at.x).toBeCloseTo(hole(board, 0, 10).x);
    expect(ten.at.y).toBeGreaterThan(hole(board, 0, 10).y);
  });

  it('fits every Hole inside its viewBox', () => {
    const { x, y, width, height } = board.viewBox;
    for (const track of [0, 1] as const) {
      for (const p of [
        ...board.startHoles[track],
        ...board.holes[track],
        board.gameHole[track],
      ]) {
        expect(p.x).toBeGreaterThan(x);
        expect(p.x).toBeLessThan(x + width);
        expect(p.y).toBeGreaterThan(y);
        expect(p.y).toBeLessThan(y + height);
      }
    }
  });
});

describe('Peg positions', () => {
  const board = boardGeometry({ holesPerLeg: 60, numeralStep: 10 });

  it('rests both Pegs in the Start Holes at zero, the front one ahead', () => {
    expect(
      close(pegPosition(board, 0, 0, 'back'), board.startHoles[0][0]),
    ).toBe(true);
    expect(
      close(pegPosition(board, 0, 0, 'front'), board.startHoles[0][1]),
    ).toBe(true);
  });

  it('puts a Peg on the Hole it scores', () => {
    const at = hole(board, 1, 45);
    expect(close(pegPosition(board, 1, 45, 'front'), at)).toBe(true);
    expect(close(pegPosition(board, 1, 45, 'back'), at)).toBe(true);
  });

  it('reaches the Game Hole at 121 and stays there beyond it', () => {
    expect(close(pegPosition(board, 0, 121, 'front'), board.gameHole[0])).toBe(
      true,
    );
    expect(close(pegPosition(board, 0, 124, 'front'), board.gameHole[0])).toBe(
      true,
    );
  });
});

describe('numeral step', () => {
  it('numbers every thirtieth Hole when asked', () => {
    const board = boardGeometry({ holesPerLeg: 30, numeralStep: 30 });
    expect(board.numerals.map((n) => n.hole)).toEqual([30, 60, 90, 120]);
  });
});
