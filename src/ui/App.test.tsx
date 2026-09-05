import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseCards } from '../engine';
import { App } from './App';
import { PeggingHand } from './components/Hand';
import { Table } from './components/Table';
import { present, revealAll, startSession } from './session';

describe('App', () => {
  it('shows the game title', () => {
    render(<App seed={1} pace={0} />);
    expect(screen.getByRole('heading', { name: 'Cribbage' })).toBeDefined();
  });

  it('deals six cards and only enables Send to crib once two are selected', async () => {
    render(<App seed={1} pace={0} />);
    const send = await screen.findByRole('button', { name: 'Send to crib' });
    await waitFor(() => {
      expect(screen.getByText('Choose two cards for the Crib.')).toBeDefined();
    });
    const hand = screen.getByRole('region', { name: 'You' });
    const cards = [...hand.querySelectorAll('button.card')];
    expect(cards).toHaveLength(6);
    const card = (i: number) => {
      const el = cards[i];
      if (el === undefined) throw new Error(`no card ${String(i)}`);
      return el;
    };
    expect(send).toHaveProperty('disabled', true);
    fireEvent.click(card(0));
    expect(send).toHaveProperty('disabled', true);
    fireEvent.click(card(1));
    expect(send).toHaveProperty('disabled', false);
    fireEvent.click(card(1));
    expect(send).toHaveProperty('disabled', true);
    fireEvent.click(card(2));
    fireEvent.click(send);
    await waitFor(() => {
      expect(
        screen.getByRole('region', { name: 'You' }).querySelectorAll('.card'),
      ).toHaveLength(4);
    });
  });
});

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
});

describe('Table', () => {
  it('shows a Continue button only while the Show waits on the reader', () => {
    const model = present(revealAll(startSession(3)));
    let continued = 0;
    const props = {
      model,
      human: 0 as const,
      legal: [],
      humanToAct: false,
      onAct: () => undefined,
      onContinue: () => {
        continued++;
      },
    };
    const { rerender } = render(<Table {...props} pause={{ kind: 'idle' }} />);
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    rerender(<Table {...props} pause={{ kind: 'continue' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(continued).toBe(1);
  });
});
