import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

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
  function memoryStorage(): Storage {
    const map = new Map<string, string>();
    return {
      get length() {
        return map.size;
      },
      clear: () => {
        map.clear();
      },
      getItem: (k) => map.get(k) ?? null,
      key: (i) => [...map.keys()][i] ?? null,
      removeItem: (k) => {
        map.delete(k);
      },
      setItem: (k, v) => {
        map.set(k, v);
      },
    };
  }

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
    first.unmount();

    render(
      <App seed={999} pace={0} storage={storage} confirmNewGame={() => true} />,
    );
    expect(screen.getByText(/Count/)).toBeDefined();
    expect(screen.getByRole('list').textContent).toBe(logBefore);
    expect(
      screen.getByRole('region', { name: 'You' }).querySelectorAll('.card'),
    ).toHaveLength(4);

    fireEvent.click(screen.getByRole('button', { name: 'New game' }));
    await waitFor(() => {
      expect(storage.getItem('cribbage.game')).toBeNull();
    });
  });
});
