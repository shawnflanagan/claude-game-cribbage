import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Board } from './Board';

const board = () => screen.getByRole('group', { name: 'Cribbage board' });

function hole(track: number, n: number): Element {
  const el = board().querySelector(
    `[data-track="${String(track)}"] .hole[data-hole="${String(n)}"]`,
  );
  if (el === null)
    throw new Error(`no hole ${String(n)} on track ${String(track)}`);
  return el;
}

const centre = (el: Element) => ({
  x: Number(el.getAttribute('cx')),
  y: Number(el.getAttribute('cy')),
});

describe('Board', () => {
  it('has a start hole and 121 scoring holes per Seat, the game hole last', () => {
    render(<Board scores={[0, 0]} previous={[0, 0]} human={0} />);
    for (const track of ['0', '1']) {
      const holes = board().querySelectorAll(
        `[data-track="${track}"] .hole:not(.hole-start)`,
      );
      expect(holes).toHaveLength(121);
      expect(holes[120]?.classList.contains('hole-game')).toBe(true);
      expect(
        board().querySelectorAll(`[data-track="${track}"] .hole-start`),
      ).toHaveLength(1);
    }
  });

  it('snakes the track: rows turn at 30, 60, and 90, and no two holes share a spot', () => {
    render(<Board scores={[0, 0]} previous={[0, 0]} human={0} />);
    expect(centre(hole(0, 30)).x).toBe(centre(hole(0, 31)).x);
    expect(centre(hole(0, 60)).x).toBe(centre(hole(0, 61)).x);
    expect(centre(hole(0, 90)).x).toBe(centre(hole(0, 91)).x);
    expect(centre(hole(0, 1)).y).toBe(centre(hole(0, 30)).y);
    expect(centre(hole(0, 31)).y).toBeGreaterThan(centre(hole(0, 30)).y);
    const spots = new Set<string>();
    for (const el of board().querySelectorAll('.hole')) {
      const { x, y } = centre(el);
      spots.add(`${String(x)},${String(y)}`);
    }
    expect(spots.size).toBe(2 * 122);
  });

  it('puts both pegs at the start before anyone scores', () => {
    render(<Board scores={[0, 0]} previous={[0, 0]} human={0} />);
    expect(screen.getByLabelText('You, front peg at 0')).toBeDefined();
    expect(screen.getByLabelText('You, back peg at 0')).toBeDefined();
    expect(screen.getByLabelText('Computer, front peg at 0')).toBeDefined();
  });

  it('moves the front peg to the score and leaves the back peg where it was', () => {
    render(<Board scores={[45, 12]} previous={[38, 12]} human={0} />);
    expect(screen.getByLabelText('You, front peg at 45')).toBeDefined();
    expect(screen.getByLabelText('You, back peg at 38')).toBeDefined();
    expect(screen.getByLabelText('Computer, front peg at 12')).toBeDefined();
    expect(screen.getByLabelText('Computer, back peg at 12')).toBeDefined();
  });

  it('places each peg on the hole it names', () => {
    render(<Board scores={[45, 12]} previous={[38, 12]} human={0} />);
    const expectOn = (label: string, track: number, n: number) => {
      const { x, y } = centre(hole(track, n));
      expect(screen.getByLabelText(label).getAttribute('transform')).toBe(
        `translate(${String(x)} ${String(y)})`,
      );
    };
    expectOn('You, front peg at 45', 0, 45);
    expectOn('You, back peg at 38', 0, 38);
    expectOn('Computer, front peg at 12', 1, 12);
  });

  it('reaches the game hole at 121', () => {
    render(<Board scores={[121, 90]} previous={[118, 90]} human={0} />);
    const { x, y } = centre(hole(0, 121));
    expect(
      screen.getByLabelText('You, front peg at 121').getAttribute('transform'),
    ).toBe(`translate(${String(x)} ${String(y)})`);
  });

  it('marks the Skunk and Double Skunk lines on each track', () => {
    render(<Board scores={[0, 0]} previous={[0, 0]} human={0} />);
    expect(screen.getAllByLabelText('Skunk line')).toHaveLength(2);
    expect(screen.getAllByLabelText('Double Skunk line')).toHaveLength(2);
  });

  it('seats the human on the first track whichever Seat they hold', () => {
    render(<Board scores={[10, 20]} previous={[10, 20]} human={1} />);
    expect(screen.getByLabelText('You, front peg at 20')).toBeDefined();
    expect(screen.getByLabelText('Computer, front peg at 10')).toBeDefined();
  });
});
