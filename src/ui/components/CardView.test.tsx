import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RANKS, SUITS, parseCard, type Card } from '../../engine';
import { CardBack, CardView } from './CardView';

function renderCard(card: Card): HTMLElement {
  const { container } = render(<CardView card={card} />);
  const element = container.firstElementChild;
  if (!(element instanceof HTMLElement)) throw new Error('no card rendered');
  return element;
}

describe('CardView', () => {
  it('draws one pip per point on number cards and the Ace', () => {
    for (const rank of RANKS.filter((r) => r <= 10)) {
      const card = renderCard({ rank, suit: 'spades' });
      expect(card.querySelectorAll('.card-pip')).toHaveLength(rank);
      expect(card.querySelector('.card-court')).toBeNull();
    }
  });

  it('draws court cards as a framed letter with the suit under it', () => {
    for (const [rank, letter] of [
      [11, 'J'],
      [12, 'Q'],
      [13, 'K'],
    ] as const) {
      const card = renderCard({ rank, suit: 'hearts' });
      const court = card.querySelector('.card-court');
      expect(court?.textContent).toBe(`${letter}♥`);
      expect(card.querySelectorAll('.card-pip')).toHaveLength(0);
    }
  });

  it('shows the rank and suit in the top-left and bottom-right corners', () => {
    const card = renderCard(parseCard('TD'));
    const indices = card.querySelectorAll('.card-index');
    expect(indices).toHaveLength(2);
    for (const index of indices) expect(index.textContent).toBe('10♦');
  });

  it('colours hearts and diamonds red and the rest black', () => {
    for (const suit of SUITS) {
      const card = renderCard({ rank: 5, suit });
      const red = suit === 'hearts' || suit === 'diamonds';
      expect(card.classList.contains('card-red')).toBe(red);
      expect(card.classList.contains('card-black')).toBe(!red);
    }
  });

  it('names the card for assistive technology and hides the drawing', () => {
    const card = renderCard(parseCard('AS'));
    expect(card.getAttribute('aria-label')).toBe('ace of spades');
    for (const child of card.children) {
      expect(child.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('draws a back with no rank or suit', () => {
    const { container } = render(<CardBack />);
    expect(container.querySelector('.card-back')).not.toBeNull();
    expect(container.textContent).toBe('');
  });
});
