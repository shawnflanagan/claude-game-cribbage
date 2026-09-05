import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { parseCard, parseCards } from '../../engine';
import type { TableModel } from '../session';
import { Table } from './Table';

const showModel: TableModel = {
  stage: 'show',
  round: 1,
  dealer: 1,
  cuts: null,
  scores: [4, 0],
  previousScores: [0, 0],
  hands: [[], []],
  kept: [parseCards('5H 5S 6D JC'), parseCards('2H 3S 8D KC')],
  discarded: [true, true],
  cribSize: 4,
  crib: null,
  starter: parseCard('5D'),
  sequence: [],
  count: 0,
  playedPile: [0, 0],
  saidGo: null,
  lastTally: {
    seat: 0,
    source: 'hand',
    tally: {
      total: 4,
      combinations: [
        { kind: 'fifteen', points: 2, cards: [] },
        { kind: 'pair', points: 2, cards: [] },
      ],
    },
  },
  shows: [
    {
      type: 'show-counted',
      seat: 0,
      source: 'hand',
      cards: parseCards('5H 5S 6D JC'),
      tally: {
        total: 4,
        combinations: [
          { kind: 'fifteen', points: 2, cards: [] },
          { kind: 'pair', points: 2, cards: [] },
        ],
      },
    },
  ],
  result: null,
};

describe('Table during the Show', () => {
  const props = {
    model: showModel,
    human: 0 as const,
    legal: [],
    humanToAct: false,
    onAct: () => undefined,
    onNewGame: () => undefined,
  };

  it('shows the count, its Combinations, and the kept cards, and hides the Computer hand until counted', () => {
    render(
      <Table
        {...props}
        pause={{ kind: 'continue' }}
        onContinue={() => undefined}
      />,
    );
    expect(screen.getByText('You count the Hand for 4.')).toBeDefined();
    expect(
      screen.getByText('You: Fifteen for 2 and a Pair for 2'),
    ).toBeDefined();
    expect(
      screen.getByRole('region', { name: 'You' }).querySelectorAll('.card'),
    ).toHaveLength(4);
    expect(
      screen
        .getByRole('region', { name: 'Computer' })
        .querySelectorAll('.card-back'),
    ).toHaveLength(4);
  });

  it('shows a Continue button only while the Show waits on the reader', () => {
    let continued = 0;
    const { rerender } = render(
      <Table
        {...props}
        pause={{ kind: 'idle' }}
        onContinue={() => undefined}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
    rerender(
      <Table
        {...props}
        pause={{ kind: 'continue' }}
        onContinue={() => {
          continued++;
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(continued).toBe(1);
  });
});

describe('Table during Pegging', () => {
  const peggingModel: TableModel = {
    ...showModel,
    stage: 'pegging',
    hands: [parseCards('4C 7C'), []],
    kept: [parseCards('4C 7C 8S QS'), parseCards('5S 6H TH QH')],
    sequence: [
      { seat: 1, card: parseCard('QH') },
      { seat: 0, card: parseCard('8S') },
      { seat: 1, card: parseCard('TH') },
    ],
    count: 28,
    playedPile: [1, 1],
    lastTally: null,
    shows: [],
  };
  const props = {
    model: peggingModel,
    human: 0 as const,
    legal: [],
    humanToAct: false,
    pause: { kind: 'idle' } as const,
    onAct: () => undefined,
    onContinue: () => undefined,
    onNewGame: () => undefined,
  };

  it('puts each played card in the row of the Seat that played it', () => {
    render(<Table {...props} />);
    const yours = screen.getByRole('group', { name: 'Your played cards' });
    const theirs = screen.getByRole('group', {
      name: "Computer's played cards",
    });
    expect(yours.querySelectorAll('.play-slot .card')).toHaveLength(1);
    expect(yours.querySelector('[aria-label="8 of spades"]')).not.toBeNull();
    expect(theirs.querySelectorAll('.play-slot .card')).toHaveLength(2);
    expect(
      theirs.querySelector('[aria-label="queen of hearts"]'),
    ).not.toBeNull();
  });

  it('keeps the cards in play order left to right across both rows', () => {
    render(<Table {...props} />);
    const columns = [
      ...screen.getByLabelText('Pegging').querySelectorAll('.play-slot'),
    ].map((slot) => [
      slot.querySelector('.card')?.getAttribute('aria-label'),
      (slot as HTMLElement).style.gridColumn,
    ]);
    expect(columns).toEqual([
      ['queen of hearts', '2'],
      ['10 of hearts', '4'],
      ['8 of spades', '3'],
    ]);
  });

  it("shows each Seat's pile face down with how many cards it holds", () => {
    render(<Table {...props} />);
    const yours = screen.getByRole('group', { name: 'Your played cards' });
    expect(yours.querySelector('.played-pile .card-back')).not.toBeNull();
    expect(yours.querySelector('.played-pile')?.textContent).toBe('1');
    expect(screen.getByText(/Count/).textContent).toContain('28');
  });

  it('shows an empty pile before the first Count reset', () => {
    render(
      <Table {...props} model={{ ...peggingModel, playedPile: [0, 0] }} />,
    );
    const yours = screen.getByRole('group', { name: 'Your played cards' });
    expect(yours.querySelector('.played-pile .card-back')).toBeNull();
    expect(yours.querySelector('.played-pile')?.textContent).toBe('');
  });
});
