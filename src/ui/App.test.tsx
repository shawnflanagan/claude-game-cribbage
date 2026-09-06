import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { memoryStorage } from './memoryStorage';
import { loadRecord } from './record';

const cardButtons = (region: HTMLElement) =>
  within(region).getAllByRole('button', { name: / of / });

describe('App', () => {
  it('shows the game title', () => {
    render(<App seed={1} pace={0} storage={null} />);
    expect(screen.getByRole('heading', { name: 'Cribbage' })).toBeDefined();
  });

  it('deals six cards and enables Send to crib only with two selected', async () => {
    render(<App seed={1} pace={0} storage={null} />);
    const send = await screen.findByRole('button', { name: 'Send to crib' });
    await waitFor(() => {
      expect(
        screen.getByText('Choose your Discard for the Crib.'),
      ).toBeDefined();
    });
    const cards = cardButtons(screen.getByRole('region', { name: 'You' }));
    expect(cards).toHaveLength(6);
    const [first, second, third] = cards;
    if (!first || !second || !third) throw new Error('short hand');
    expect(send).toHaveProperty('disabled', true);
    fireEvent.click(first);
    expect(send).toHaveProperty('disabled', true);
    fireEvent.click(second);
    expect(send).toHaveProperty('disabled', false);
    fireEvent.click(second);
    expect(send).toHaveProperty('disabled', true);
    fireEvent.click(third);
    expect(send).toHaveProperty('disabled', false);
  });

  it('sends the Discard to the Crib and moves on to Pegging', async () => {
    render(<App seed={1} pace={0} storage={null} />);
    const send = await screen.findByRole('button', { name: 'Send to crib' });
    await waitFor(() => {
      expect(
        screen.getByText('Choose your Discard for the Crib.'),
      ).toBeDefined();
    });
    const [a, b] = cardButtons(screen.getByRole('region', { name: 'You' }));
    if (!a || !b) throw new Error('short hand');
    fireEvent.click(a);
    fireEvent.click(b);
    fireEvent.click(send);
    await waitFor(() => {
      expect(screen.getByText(/Count/)).toBeDefined();
    });
    expect(
      screen.getByRole('region', { name: 'You' }).querySelectorAll('.card'),
    ).toHaveLength(4);
  });

  it('pegs a Round out and counts the Show out to a Continue', async () => {
    render(<App seed={1} pace={0} storage={null} />);
    const send = await screen.findByRole('button', { name: 'Send to crib' });
    await waitFor(() => {
      expect(
        screen.getByText('Choose your Discard for the Crib.'),
      ).toBeDefined();
    });
    const you = screen.getByRole('region', { name: 'You' });
    const [a, b] = cardButtons(you);
    if (!a || !b) throw new Error('short hand');
    fireEvent.click(a);
    fireEvent.click(b);
    fireEvent.click(send);
    // Play whatever is legal until the Show has been counted out.
    await waitFor(
      () => {
        const legal = within(you)
          .queryAllByRole('button', { name: / of / })
          .find((c) => !(c as HTMLButtonElement).disabled);
        if (legal !== undefined) fireEvent.click(legal);
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDefined();
      },
      { timeout: 4000, interval: 20 },
    );
    expect(screen.getByRole('status').textContent).toMatch(
      /counts? the Hand for/,
    );
    expect(document.querySelector('.phrase')?.textContent).not.toBe('');
  });

  it('asks before abandoning a Game in progress, and starts over when told to', async () => {
    let asked = 0;
    let answer = false;
    const confirmNewGame = () => {
      asked++;
      return answer;
    };
    render(
      <App seed={1} pace={0} storage={null} confirmNewGame={confirmNewGame} />,
    );
    await screen.findByRole('button', { name: 'Send to crib' });
    const before = screen.getByRole('list').textContent;
    fireEvent.click(screen.getByRole('button', { name: 'New game' }));
    expect(asked).toBe(1);
    expect(screen.getByRole('list').textContent).toBe(before);
    answer = true;
    fireEvent.click(screen.getByRole('button', { name: 'New game' }));
    expect(asked).toBe(2);
    await waitFor(() => {
      expect(screen.getByRole('list').textContent).not.toBe(before);
    });
  });
});

describe('App with a saved Game', () => {
  it('comes back where it left off after a reload, and forgets the Game on New game', async () => {
    const storage = memoryStorage();
    const first = render(<App seed={1} pace={0} storage={storage} />);
    const send = await screen.findByRole('button', { name: 'Send to crib' });
    await waitFor(() => {
      expect(
        screen.getByText('Choose your Discard for the Crib.'),
      ).toBeDefined();
    });
    const [a, b] = cardButtons(screen.getByRole('region', { name: 'You' }));
    if (!a || !b) throw new Error('short hand');
    fireEvent.click(a);
    fireEvent.click(b);
    fireEvent.click(send);
    await waitFor(() => {
      expect(screen.getByText(/Count/)).toBeDefined();
    });
    const logBefore = screen.getByRole('list').textContent;
    // The board follows the presented scores.
    const youScore = /You (\d+)/.exec(
      screen.getByLabelText('Scores').textContent,
    )?.[1];
    // Both Folds of the Board are in the DOM; CSS shows one.
    expect(
      screen.getAllByLabelText(`You, front peg at ${youScore ?? '?'}`),
    ).toHaveLength(2);
    const countBefore = screen.getByText(/Count/).textContent;
    const scoresBefore = screen.getByLabelText('Scores').textContent;
    first.unmount();

    render(
      <App seed={999} pace={0} storage={storage} confirmNewGame={() => true} />,
    );
    expect(screen.getByText(/Count/).textContent).toBe(countBefore);
    expect(screen.getByLabelText('Scores').textContent).toBe(scoresBefore);
    expect(screen.getByRole('list').textContent).toBe(logBefore);
    expect(
      screen.getByRole('region', { name: 'You' }).querySelectorAll('.card'),
    ).toHaveLength(4);

    fireEvent.click(screen.getByRole('button', { name: 'New game' }));
    await waitFor(() => {
      const raw = storage.getItem('cribbage.game');
      // The old Game is gone; whatever is saved now is the new one.
      const saved = raw === null ? null : (JSON.parse(raw) as { seed: number });
      expect(saved?.seed).not.toBe(1);
    });
  });
});

describe('App and the Record', () => {
  /** Plays whatever the table asks for until the Game is over. */
  async function playToTheEnd(): Promise<void> {
    await waitFor(
      () => {
        const you = screen.getByRole('region', { name: 'You' });
        const send = screen.queryByRole('button', { name: 'Send to crib' });
        if (send !== null) {
          const [a, b] = within(you).queryAllByRole('button', { name: / of / });
          if (a !== undefined && b !== undefined) {
            fireEvent.click(a);
            fireEvent.click(b);
            if (!(send as HTMLButtonElement).disabled) fireEvent.click(send);
          }
        }
        const legal = within(you)
          .queryAllByRole('button', { name: / of / })
          .find((c) => !(c as HTMLButtonElement).disabled);
        if (legal !== undefined) fireEvent.click(legal);
        const next = screen.queryByRole('button', { name: 'Continue' });
        if (next !== null) fireEvent.click(next);
        expect(
          screen.getByRole('heading', { name: /You win!|Computer wins\./ }),
        ).toBeDefined();
      },
      { timeout: 20_000, interval: 5 },
    );
  }

  const wins = (storage: Storage): number => {
    const record = loadRecord(storage);
    return record.you.wins + record.computer.wins;
  };

  it('counts a finished Game once, shows it, and leaves an abandoned Game out', async () => {
    const storage = memoryStorage();
    const first = render(
      <App
        seed={1}
        startingScores={[115, 115]}
        pace={0}
        storage={storage}
        confirmNewGame={() => true}
        confirmResetRecord={() => true}
      />,
    );
    await playToTheEnd();
    expect(wins(storage)).toBe(1);
    expect(screen.getByLabelText('Record').textContent).toMatch(
      /^(You lead|Computer leads) 1 game to 0/,
    );
    // A reload lands back on the result screen without counting it twice.
    first.unmount();
    render(
      <App seed={1} pace={0} storage={storage} confirmNewGame={() => true} />,
    );
    await screen.findByRole('heading', { name: /You win!|Computer wins\./ });
    expect(wins(storage)).toBe(1);
    // Starting the next Game, then abandoning it, leaves the Record alone.
    const [newGame] = screen.getAllByRole('button', { name: 'New game' });
    if (newGame === undefined) throw new Error('no New game button');
    fireEvent.click(newGame);
    await screen.findByRole('button', { name: 'Send to crib' });
    fireEvent.click(screen.getByRole('button', { name: 'New game' }));
    await screen.findByRole('button', { name: 'Send to crib' });
    expect(wins(storage)).toBe(1);
  }, 30_000);

  it('resets the Record when asked and confirmed', async () => {
    const storage = memoryStorage();
    storage.setItem(
      'cribbage.record',
      JSON.stringify({
        version: 1,
        you: { wins: 2, skunks: 0, doubleSkunks: 0 },
        computer: { wins: 0, skunks: 0, doubleSkunks: 0 },
        lastGame: '5:30',
      }),
    );
    let asked = 0;
    render(
      <App
        seed={1}
        startingScores={[115, 115]}
        pace={0}
        storage={storage}
        confirmNewGame={() => true}
        confirmResetRecord={() => {
          asked++;
          return asked > 1;
        }}
      />,
    );
    await playToTheEnd();
    expect(screen.getByLabelText('Record').textContent).toMatch(
      /^(You lead 3 games to 0|You lead 2 games to 1)/,
    );
    expect(
      loadRecord(storage).you.wins + loadRecord(storage).computer.wins,
    ).toBe(3);
    fireEvent.click(screen.getByRole('button', { name: 'Reset record' }));
    expect(loadRecord(storage).you.wins).toBe(3);
    fireEvent.click(screen.getByRole('button', { name: 'Reset record' }));
    const cleared = loadRecord(storage);
    expect(cleared.you.wins + cleared.computer.wins).toBe(0);
    expect(screen.getByLabelText('Record').textContent).toBe(
      'No Games finished yet',
    );
    // The Game on screen stays uncounted after the reset.
    await new Promise((r) => setTimeout(r, 20));
    expect(
      loadRecord(storage).you.wins + loadRecord(storage).computer.wins,
    ).toBe(0);
  }, 30_000);
});
