import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { gameResult } from '../../engine';
import { GameOver } from './GameOver';

describe('GameOver', () => {
  it('names the winner and the scores', () => {
    render(
      <GameOver
        result={gameResult(0, [121, 100])}
        human={0}
        onNewGame={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { name: 'You win!' })).toBeDefined();
    expect(screen.getByText('You 121, Computer 100.')).toBeDefined();
    expect(screen.queryByText(/Skunk/)).toBeNull();
  });

  it('calls out a Skunk and a Double Skunk', () => {
    const { rerender } = render(
      <GameOver
        result={gameResult(1, [80, 121])}
        human={0}
        onNewGame={() => undefined}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Computer wins.' }),
    ).toBeDefined();
    expect(screen.getByText('A Skunk!')).toBeDefined();
    rerender(
      <GameOver
        result={gameResult(0, [121, 40])}
        human={0}
        onNewGame={() => undefined}
      />,
    );
    expect(screen.getByText('A Double Skunk!')).toBeDefined();
  });
});
