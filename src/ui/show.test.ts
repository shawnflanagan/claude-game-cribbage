import { describe, expect, it } from 'vitest';
import { makeTally, parseCards, type Combination } from '../engine';
import { chipLabel, countingOrder, showPhrase } from './show';

const fifteen = (cards: string): Combination => ({
  kind: 'fifteen',
  points: 2,
  cards: parseCards(cards),
});
const pair = (cards: string): Combination => ({
  kind: 'pair',
  points: 2,
  cards: parseCards(cards),
});
const run = (cards: string): Combination => ({
  kind: 'run',
  points: cards.split(' ').length,
  cards: parseCards(cards),
});

describe('counting out the Show', () => {
  it('says fifteen two, fifteen four for fifteens alone', () => {
    const tally = makeTally([fifteen('7H 8S'), fifteen('7H 8D')]);
    expect(showPhrase(tally, 1)).toBe('Fifteen two');
    expect(showPhrase(tally, 2)).toBe('Fifteen two, fifteen four');
  });

  it('adds a pair to the running total with an and', () => {
    const tally = makeTally([fifteen('7H 8S'), pair('8S 8D')]);
    expect(showPhrase(tally, 2)).toBe('Fifteen two, and a pair is four');
  });

  it('starts without an and when there are no fifteens', () => {
    const tally = makeTally([pair('8S 8D'), run('6H 7H 8S')]);
    expect(showPhrase(tally, 2)).toBe(
      'A pair is two, and a run of three is five',
    );
  });

  it('names a run by its length', () => {
    expect(showPhrase(makeTally([run('6H 7H 8S 9D')]), 1)).toBe(
      'A run of four is four',
    );
    expect(showPhrase(makeTally([run('5H 6H 7H 8S 9D')]), 1)).toBe(
      'A run of five is five',
    );
  });

  it('counts a flush and the pair family', () => {
    const flush: Combination = {
      kind: 'flush',
      points: 4,
      cards: parseCards('2H 4H 6H 9H'),
    };
    expect(showPhrase(makeTally([flush]), 1)).toBe('A flush is four');
    const royal: Combination = {
      kind: 'pair-royal',
      points: 6,
      cards: parseCards('8S 8D 8C'),
    };
    expect(showPhrase(makeTally([fifteen('7H 8S'), royal]), 2)).toBe(
      'Fifteen two, and a pair royal is eight',
    );
  });

  it('puts Nobs last, as one for his Nobs', () => {
    const nobs: Combination = {
      kind: 'nobs',
      points: 1,
      cards: parseCards('JH'),
    };
    const tally = makeTally([nobs, fifteen('5H JH')]);
    expect(countingOrder(tally).map((c) => c.kind)).toEqual([
      'fifteen',
      'nobs',
    ]);
    expect(showPhrase(tally, 2)).toBe('Fifteen two, and one for his Nobs');
  });

  it('counts the 29 hand all the way up', () => {
    const fives = parseCards('5H 5S 5D 5C');
    const jack = parseCards('JC');
    const fifteens = Array.from({ length: 8 }, () => fifteen('5H JC'));
    const royal: Combination = {
      kind: 'double-pair-royal',
      points: 12,
      cards: fives,
    };
    const nobs: Combination = { kind: 'nobs', points: 1, cards: jack };
    const tally = makeTally([...fifteens, royal, nobs]);
    expect(tally.total).toBe(29);
    expect(showPhrase(tally, 10)).toBe(
      'Fifteen two, fifteen four, fifteen six, fifteen eight, fifteen ten, fifteen twelve, fifteen fourteen, fifteen sixteen, and a double pair royal is twenty-eight, and one for his Nobs',
    );
  });

  it('says No score for a Hand worth nothing', () => {
    expect(showPhrase(makeTally([]), 0)).toBe('No score');
  });

  it('says nothing before the first Combination is counted', () => {
    expect(showPhrase(makeTally([fifteen('7H 8S')]), 0)).toBe('');
  });

  it('orders fifteens, then pairs, runs, a flush, and Nobs last', () => {
    const tally = makeTally([
      { kind: 'nobs', points: 1, cards: parseCards('JH') },
      { kind: 'flush', points: 4, cards: parseCards('2H 4H 6H JH') },
      run('4H 5S 6H'),
      pair('4H 4C'),
      fifteen('4H 5S 6H'),
    ]);
    expect(countingOrder(tally).map((c) => c.kind)).toEqual([
      'fifteen',
      'pair',
      'run',
      'flush',
      'nobs',
    ]);
  });
});

describe('Pegging chips', () => {
  it('labels each Combination with its name and points', () => {
    expect(chipLabel(fifteen('7H 8S'))).toBe('Fifteen 2');
    expect(chipLabel(pair('8S 8D'))).toBe('Pair 2');
    expect(chipLabel(run('6H 7H 8S'))).toBe('Run of 3');
    expect(
      chipLabel({ kind: 'thirty-one', points: 2, cards: parseCards('3H') }),
    ).toBe('Thirty-One 2');
    expect(
      chipLabel({ kind: 'last-card', points: 1, cards: parseCards('3H') }),
    ).toBe('Last Card 1');
    expect(
      chipLabel({
        kind: 'pair-royal',
        points: 6,
        cards: parseCards('8S 8D 8C'),
      }),
    ).toBe('Pair Royal 6');
  });
});
