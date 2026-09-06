import { render, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { boardGeometry, pegPosition } from '../board';
import { Board } from './Board';

const WIDE = boardGeometry({ holesPerLeg: 60, numeralStep: 10 });

/** The drawing shown on a wide screen; the narrow one is hidden by CSS. */
function wide(container: HTMLElement): HTMLElement {
  const svg = container.querySelector('svg.board-wide');
  if (!(svg instanceof SVGElement)) throw new Error('no wide Board');
  return svg as unknown as HTMLElement;
}

const transformOf = (element: HTMLElement) =>
  element.getAttribute('transform') ?? '';
const translate = (track: 0 | 1, score: number, peg: 'front' | 'back') => {
  const at = pegPosition(WIDE, track, score, peg);
  return `translate(${String(at.x)} ${String(at.y)})`;
};

describe('Board', () => {
  it('draws both Folds, for CSS to choose between', () => {
    const { container } = render(
      <Board scores={[0, 0]} previous={[0, 0]} human={0} />,
    );
    expect(container.querySelector('svg.board-wide')).not.toBeNull();
    expect(container.querySelector('svg.board-narrow')).not.toBeNull();
  });

  it('has two Start Holes, 120 Holes, and a Game Hole per Track', () => {
    const { container } = render(
      <Board scores={[0, 0]} previous={[0, 0]} human={0} />,
    );
    for (const track of [0, 1]) {
      const holes = wide(container).querySelectorAll(
        `[data-track="${String(track)}"] .hole`,
      );
      expect(holes).toHaveLength(123);
      expect(
        wide(container).querySelectorAll(
          `[data-track="${String(track)}"] .hole-start`,
        ),
      ).toHaveLength(2);
      expect(
        wide(container).querySelectorAll(
          `[data-track="${String(track)}"] .hole-game`,
        ),
      ).toHaveLength(1);
    }
  });

  it('rests both Pegs in the Start Holes before anyone scores, front ahead', () => {
    const { container } = render(
      <Board scores={[0, 0]} previous={[0, 0]} human={0} />,
    );
    const drawing = within(wide(container));
    expect(transformOf(drawing.getByLabelText('You, front peg at 0'))).toBe(
      translate(0, 0, 'front'),
    );
    expect(transformOf(drawing.getByLabelText('You, back peg at 0'))).toBe(
      translate(0, 0, 'back'),
    );
    expect(translate(0, 0, 'front')).not.toBe(translate(0, 0, 'back'));
  });

  it('moves the front Peg to the score and leaves the back Peg where it was', () => {
    const { container } = render(
      <Board scores={[45, 12]} previous={[38, 12]} human={0} />,
    );
    const drawing = within(wide(container));
    expect(transformOf(drawing.getByLabelText('You, front peg at 45'))).toBe(
      translate(0, 45, 'front'),
    );
    expect(transformOf(drawing.getByLabelText('You, back peg at 38'))).toBe(
      translate(0, 38, 'back'),
    );
    expect(
      transformOf(drawing.getByLabelText('Computer, front peg at 12')),
    ).toBe(translate(1, 12, 'front'));
  });

  it('reaches the Game Hole at 121', () => {
    const { container } = render(
      <Board scores={[121, 90]} previous={[118, 90]} human={0} />,
    );
    const drawing = within(wide(container));
    const game = wide(container).querySelector('[data-track="0"] .hole-game');
    const at = pegPosition(WIDE, 0, 121, 'front');
    expect(game?.getAttribute('cx')).toBe(String(at.x));
    expect(transformOf(drawing.getByLabelText('You, front peg at 121'))).toBe(
      translate(0, 121, 'front'),
    );
  });

  it('marks the Skunk lines once each, spanning both Tracks, with their letters', () => {
    const { container } = render(
      <Board scores={[0, 0]} previous={[0, 0]} human={0} />,
    );
    const drawing = within(wide(container));
    expect(drawing.getAllByLabelText('Skunk line')).toHaveLength(1);
    expect(drawing.getAllByLabelText('Double Skunk line')).toHaveLength(1);
    const letters = [...wide(container).querySelectorAll('.board-skunk')].map(
      (t) => t.textContent,
    );
    expect(letters).toEqual(['SS', 'S']);
  });

  it('numbers every tenth Hole once and marks the Game Hole 121', () => {
    const { container } = render(
      <Board scores={[0, 0]} previous={[0, 0]} human={0} />,
    );
    const numbers = [...wide(container).querySelectorAll('.board-text')].map(
      (t) => t.textContent,
    );
    expect(numbers.filter((n) => n === '60')).toHaveLength(1);
    expect(numbers).toContain('121');
    expect(numbers.filter((n) => /^\d+$/.test(n))).toHaveLength(13);
  });

  it('draws each Peg as a pin with a head, a glint, and a shadow', () => {
    const { container } = render(
      <Board scores={[3, 0]} previous={[0, 0]} human={0} />,
    );
    const peg = within(wide(container)).getByLabelText('You, front peg at 3');
    expect(peg.querySelector('.peg-head')).not.toBeNull();
    expect(peg.querySelector('.peg-shine')).not.toBeNull();
    expect(peg.querySelector('.peg-shadow')).not.toBeNull();
  });

  it('seats the human on the first Track whichever Seat they hold', () => {
    const { container } = render(
      <Board scores={[5, 9]} previous={[5, 9]} human={1} />,
    );
    const drawing = within(wide(container));
    expect(transformOf(drawing.getByLabelText('You, front peg at 9'))).toBe(
      translate(0, 9, 'front'),
    );
    expect(
      transformOf(drawing.getByLabelText('Computer, front peg at 5')),
    ).toBe(translate(1, 5, 'front'));
  });
});
