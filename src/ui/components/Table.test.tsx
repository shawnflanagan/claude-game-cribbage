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
