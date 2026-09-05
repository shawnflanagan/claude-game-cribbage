import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { gameResult } from '../../engine';
import { EMPTY_RECORD, type GameRecord } from '../record';
import { GameOver } from './GameOver';

const record: GameRecord = {
  you: { wins: 3, skunks: 1, doubleSkunks: 0 },
  computer: { wins: 1, skunks: 0, doubleSkunks: 0 },
  lastGame: '1:40',
};

const props = {
  human: 0 as const,
  record,
  onNewGame: () => undefined,
  onResetRecord: () => undefined,
};

describe('GameOver', () => {
  it('names the winner and the scores', () => {
    render(<GameOver {...props} result={gameResult(0, [121, 100])} />);
    expect(screen.getByRole('heading', { name: 'You win!' })).toBeDefined();
    expect(screen.getByText('You 121, Computer 100.')).toBeDefined();
    expect(screen.queryByText(/A Skunk/)).toBeNull();
  });

  it('calls out a Skunk and a Double Skunk', () => {
    const { rerender } = render(
      <GameOver {...props} result={gameResult(1, [80, 121])} />,
    );
    expect(
      screen.getByRole('heading', { name: 'Computer wins.' }),
    ).toBeDefined();
    expect(screen.getByText('A Skunk!')).toBeDefined();
    rerender(<GameOver {...props} result={gameResult(0, [121, 40])} />);
    expect(screen.getByText('A Double Skunk!')).toBeDefined();
  });

  it('shows the Record with its Skunks', () => {
    render(<GameOver {...props} result={gameResult(0, [121, 100])} />);
    const shown = screen.getByLabelText('Record');
    expect(shown.textContent).toContain('You lead 3 games to 1');
    expect(shown.textContent).toContain('Including 1 Skunk for you');
  });

  it('offers to reset the Record', () => {
    let resets = 0;
    render(
      <GameOver
        {...props}
        record={EMPTY_RECORD}
        result={gameResult(0, [121, 100])}
        onResetRecord={() => {
          resets++;
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset record' }));
    expect(resets).toBe(1);
  });
});
