import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Board } from './Board';

describe('Board', () => {
  it('has a start hole and 121 scoring holes per player, the game hole last', () => {
    render(<Board scores={[0, 0]} previous={[0, 0]} human={0} />);
    const board = screen.getByRole('img', { name: /board/i });
    for (const track of ['0', '1']) {
      const holes = board.querySelectorAll(
        `[data-track="${track}"] .hole:not(.hole-start)`,
      );
      expect(holes).toHaveLength(121);
      expect(holes[120]?.classList.contains('hole-game')).toBe(true);
      expect(
        board.querySelectorAll(`[data-track="${track}"] .hole-start`),
      ).toHaveLength(1);
    }
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

  it('places the pegs on the holes they name', () => {
    render(<Board scores={[45, 12]} previous={[38, 12]} human={0} />);
    const board = screen.getByRole('img', { name: /board/i });
    const hole = board.querySelector('[data-track="0"] .hole[data-hole="45"]');
    const peg = screen.getByLabelText('You, front peg at 45');
    expect(hole).not.toBeNull();
    expect(peg.getAttribute('transform')).toBe(hole?.getAttribute('data-at'));
  });

  it('reaches the game hole at 121', () => {
    render(<Board scores={[121, 90]} previous={[118, 90]} human={0} />);
    expect(screen.getByLabelText('You, front peg at 121')).toBeDefined();
    const board = screen.getByRole('img', { name: /board/i });
    expect(
      board.querySelector('[data-track="0"] .hole[data-hole="121"]'),
    ).not.toBeNull();
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
