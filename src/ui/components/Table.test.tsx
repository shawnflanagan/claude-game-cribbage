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
  counted: 2,
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
    expect(screen.getByText('Fifteen two, and a pair is four')).toBeDefined();
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

describe('Table counting out the Show', () => {
  const tally = {
    total: 4,
    combinations: [
      { kind: 'pair' as const, points: 2, cards: parseCards('5H 5S') },
      { kind: 'fifteen' as const, points: 2, cards: parseCards('5D JC') },
    ],
  };
  const show = {
    type: 'show-counted' as const,
    seat: 0 as const,
    source: 'hand' as const,
    cards: parseCards('5H 5S 6D JC'),
    tally,
  };
  const model: TableModel = {
    ...showModel,
    lastTally: { seat: 0, source: 'hand', tally },
    shows: [show],
  };
  const props = {
    model,
    human: 0 as const,
    legal: [],
    humanToAct: false,
    pause: { kind: 'after', ms: 700 } as const,
    onAct: () => undefined,
    onContinue: () => undefined,
    onNewGame: () => undefined,
  };
  it('shows the Hand with nothing lit and no total before counting starts', () => {
    render(<Table {...props} model={{ ...model, counted: 0 }} />);
    expect(screen.getByRole('status').textContent).toBe('You count the Hand.');
    expect(document.querySelectorAll('.card-lit')).toHaveLength(0);
    expect(document.querySelector('.phrase')?.textContent).toBe('');
  });

  it('lights the cards of the Combination being counted, fifteens first', () => {
    const { rerender } = render(
      <Table {...props} model={{ ...model, counted: 1 }} />,
    );
    const lit = () =>
      [...document.querySelectorAll('.card-lit')].map((c) =>
        c.getAttribute('aria-label'),
      );
    expect(lit()).toEqual(['5 of diamonds', 'jack of clubs']);
    expect(document.querySelector('.phrase')?.textContent).toBe('Fifteen two');
    rerender(<Table {...props} model={{ ...model, counted: 2 }} />);
    expect(lit()).toEqual(['5 of hearts', '5 of spades']);
    expect(screen.getByRole('status').textContent).toBe(
      'You count the Hand for 4.',
    );
  });

  it('lights the Starter when it is part of the Combination', () => {
    render(<Table {...props} model={{ ...model, counted: 1 }} />);
    expect(
      screen.getByLabelText('5 of diamonds').classList.contains('card-lit'),
    ).toBe(true);
  });

  it('says No score under a Hand worth nothing', () => {
    const empty = { total: 0, combinations: [] };
    render(
      <Table
        {...props}
        model={{
          ...model,
          counted: 0,
          lastTally: { seat: 0, source: 'hand', tally: empty },
          shows: [{ ...show, tally: empty }],
        }}
      />,
    );
    expect(document.querySelector('.phrase')?.textContent).toBe('No score');
  });
});

describe('Table announcing the cut', () => {
  it('names the cut cards and the Dealer while the cut lingers', () => {
    render(
      <Table
        model={{
          ...showModel,
          stage: 'cutting',
          cuts: [parseCard('4H'), parseCard('JS')],
          dealer: 0,
          shows: [],
          lastTally: null,
        }}
        human={0}
        legal={[]}
        humanToAct={false}
        pause={{ kind: 'after', ms: 2100 }}
        onAct={() => undefined}
        onContinue={() => undefined}
        onNewGame={() => undefined}
      />,
    );
    expect(screen.getByRole('status').textContent).toBe(
      'You cut a 4, Computer cut a Jack. You deal.',
    );
  });
});

describe('Table Pegging chips', () => {
  // The fold drops a Pegging Tally when the next card lands (see session.test);
  // here the chips only ever attach to the newest card.
  it('puts a chip for each Combination beside the card just played', () => {
    const fifteen = { kind: 'fifteen' as const, points: 2, cards: [] };
    const pair = { kind: 'pair' as const, points: 2, cards: [] };
    render(
      <Table
        model={{
          ...showModel,
          stage: 'pegging',
          shows: [],
          sequence: [
            { seat: 1, card: parseCard('7H') },
            { seat: 0, card: parseCard('8S') },
          ],
          count: 15,
          lastTally: {
            seat: 0,
            source: 'pegging',
            tally: { total: 4, combinations: [fifteen, pair] },
          },
        }}
        human={0}
        legal={[]}
        humanToAct={false}
        pause={{ kind: 'after', ms: 1000 }}
        onAct={() => undefined}
        onContinue={() => undefined}
        onNewGame={() => undefined}
      />,
    );
    const slot = screen.getByLabelText('8 of spades').parentElement;
    const chips = [...(slot?.querySelectorAll('.chip') ?? [])];
    expect(chips.map((c) => c.textContent)).toEqual(['Fifteen 2', 'Pair 2']);
    expect(
      screen
        .getByLabelText('7 of hearts')
        .parentElement?.querySelector('.chip'),
    ).toBeNull();
  });
});
