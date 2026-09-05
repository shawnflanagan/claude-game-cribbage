import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseCards } from '../../engine';
import { PeggingHand } from './Hand';

describe('PeggingHand', () => {
  it('greys out cards that are not legal and plays a legal one on a tap', () => {
    const cards = parseCards('5H KS 9D');
    const played: string[] = [];
    render(
      <PeggingHand
        cards={cards}
        legal={parseCards('5H')}
        onPlay={(c) => played.push(`${String(c.rank)}${c.suit}`)}
      />,
    );
    const five = screen.getByRole('button', { name: '5 of hearts' });
    const king = screen.getByRole('button', { name: 'king of spades' });
    expect(five).toHaveProperty('disabled', false);
    expect(king).toHaveProperty('disabled', true);
    fireEvent.click(king);
    fireEvent.click(five);
    expect(played).toEqual(['5hearts']);
  });

  it('disables every card when it is not your turn', () => {
    render(
      <PeggingHand
        cards={parseCards('5H KS')}
        legal={[]}
        onPlay={() => undefined}
      />,
    );
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveProperty('disabled', true);
    }
  });
});
