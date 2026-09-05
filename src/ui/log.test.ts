import { describe, expect, it } from 'vitest';
import { parseCard, parseCards, type GameEvent } from '../engine';
import { describeCut, describeEvent } from './log';

const human = 0;

describe('Log lines', () => {
  it('names the human You and the other Seat Computer', () => {
    expect(
      describeEvent(
        { type: 'card-played', seat: 0, card: parseCard('7S'), count: 22 },
        human,
      ),
    ).toBe('You play 7♠ for 22.');
    expect(
      describeEvent(
        { type: 'card-played', seat: 1, card: parseCard('7S'), count: 22 },
        human,
      ),
    ).toBe('Computer plays 7♠ for 22.');
  });

  it('describes the cut for deal and who deals', () => {
    const event: GameEvent = {
      type: 'cut-for-deal',
      cuts: [parseCard('4H'), parseCard('KD')],
      dealer: 0,
    };
    expect(describeEvent(event, human)).toBe(
      'You cut 4♥, Computer cuts K♦. You deal.',
    );
    expect(describeEvent({ ...event, dealer: null }, human)).toBe(
      'You cut 4♥, Computer cuts K♦. A tie, cut again.',
    );
  });

  it('shows the human their own Discards but not the Computer ones', () => {
    const cards = parseCards('5H KS');
    expect(describeEvent({ type: 'discarded', seat: 0, cards }, human)).toBe(
      'You send 5♥ K♠ to the Crib.',
    );
    expect(describeEvent({ type: 'discarded', seat: 1, cards }, human)).toBe(
      'Computer sends a Discard to the Crib.',
    );
  });

  it('spells out each Combination in a Tally', () => {
    const tally = {
      total: 5,
      combinations: [
        { kind: 'fifteen' as const, points: 2, cards: [] },
        { kind: 'run' as const, points: 3, cards: parseCards('4H 5S 6D') },
      ],
    };
    expect(describeEvent({ type: 'tally', seat: 1, tally }, human)).toBe(
      'Computer scores Fifteen for 2 and a Run of 3 for 3.',
    );
  });

  it('describes the Show, including a Hand worth nothing and the Crib', () => {
    const cards = parseCards('2H 4S 6D 8C');
    const nothing = { total: 0, combinations: [] };
    expect(
      describeEvent(
        {
          type: 'show-counted',
          seat: 0,
          source: 'hand',
          cards,
          tally: nothing,
        },
        human,
      ),
    ).toBe('Show: You count 2♥ 4♠ 6♦ 8♣ for nothing.');
    const four = {
      total: 4,
      combinations: [
        { kind: 'fifteen' as const, points: 2, cards: [] },
        { kind: 'pair' as const, points: 2, cards: [] },
      ],
    };
    expect(
      describeEvent(
        { type: 'show-counted', seat: 1, source: 'crib', cards, tally: four },
        human,
      ),
    ).toBe(
      'Show: Computer counts the Crib 2♥ 4♠ 6♦ 8♣ for 4: Fifteen for 2 and a Pair for 2.',
    );
  });

  it('announces Heels, Go, the Starter, the deal, and the win', () => {
    const heels = {
      total: 2,
      combinations: [{ kind: 'heels' as const, points: 2, cards: [] }],
    };
    expect(describeEvent({ type: 'heels', seat: 1, tally: heels }, human)).toBe(
      'Computer scores Heels for 2.',
    );
    expect(describeEvent({ type: 'go', seat: 1 }, human)).toBe(
      'Computer says Go.',
    );
    expect(
      describeEvent({ type: 'starter-cut', card: parseCard('JS') }, human),
    ).toBe('The Starter is J♠.');
    expect(
      describeEvent(
        { type: 'dealt', dealer: 1, round: 3, hands: [[], []] },
        human,
      ),
    ).toBe('Round 3. Computer deals.');
    expect(
      describeEvent(
        {
          type: 'game-won',
          result: { winner: 0, scores: [121, 85], skunk: 'skunk' },
        },
        human,
      ),
    ).toBe('You win 121 to 85. A Skunk!');
  });

  it('stays quiet for bookkeeping Events', () => {
    expect(
      describeEvent(
        { type: 'scored', seat: 0, points: 2, scores: [2, 0] },
        human,
      ),
    ).toBeNull();
    expect(
      describeEvent({ type: 'sequence-ended', leader: 1 }, human),
    ).toBeNull();
    expect(describeEvent({ type: 'pegging-ended' }, human)).toBeNull();
    expect(describeEvent({ type: 'round-ended', round: 1 }, human)).toBeNull();
  });
});

describe('the cut announced on the table', () => {
  it('names each card in words and who deals', () => {
    expect(describeCut([parseCard('4H'), parseCard('JS')], 0, 0)).toBe(
      'You cut a 4, Computer cut a Jack. You deal.',
    );
    expect(describeCut([parseCard('AH'), parseCard('8S')], 1, 0)).toBe(
      'You cut an Ace, Computer cut an 8. Computer deals.',
    );
  });

  it('calls a tie', () => {
    expect(describeCut([parseCard('QH'), parseCard('QS')], null, 0)).toBe(
      'You cut a Queen, Computer cut a Queen. A tie, cut again.',
    );
  });
});
