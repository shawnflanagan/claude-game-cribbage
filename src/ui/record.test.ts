import { describe, expect, it } from 'vitest';
import { gameResult } from '../engine';
import { memoryStorage } from './memoryStorage';
import {
  clearRecord,
  describeRecord,
  EMPTY_RECORD,
  gameKey,
  loadRecord,
  recordGame,
  saveRecord,
  type GameRecord,
} from './record';

const HUMAN = 0;

describe('the Record', () => {
  it('starts with no Games finished for either of them', () => {
    expect(EMPTY_RECORD.you.wins + EMPTY_RECORD.computer.wins).toBe(0);
  });

  it('adds a win to whoever reached 121, with any Skunk against the loser', () => {
    let record = recordGame(
      EMPTY_RECORD,
      gameResult(0, [121, 100]),
      HUMAN,
      'a',
    );
    expect(record.you).toEqual({ wins: 1, skunks: 0, doubleSkunks: 0 });
    record = recordGame(record, gameResult(1, [80, 121]), HUMAN, 'b');
    expect(record.computer).toEqual({ wins: 1, skunks: 1, doubleSkunks: 0 });
    record = recordGame(record, gameResult(0, [121, 40]), HUMAN, 'c');
    expect(record.you).toEqual({ wins: 2, skunks: 0, doubleSkunks: 1 });
  });

  it('counts a finished Game once, however many times it is reported', () => {
    const key = gameKey(7, 40);
    const once = recordGame(
      EMPTY_RECORD,
      gameResult(0, [121, 100]),
      HUMAN,
      key,
    );
    const twice = recordGame(once, gameResult(0, [121, 100]), HUMAN, key);
    expect(twice).toEqual(once);
    expect(twice.you.wins).toBe(1);
  });

  it('credits the human wherever they sit', () => {
    const record = recordGame(EMPTY_RECORD, gameResult(1, [100, 121]), 1, 'a');
    expect(record.you.wins).toBe(1);
    expect(record.computer.wins).toBe(0);
  });

  it('tells two Games with the same seed apart by how they were played', () => {
    expect(gameKey(7, 40)).not.toBe(gameKey(7, 41));
    expect(gameKey(7, 40)).toBe(gameKey(7, 40));
  });

  it('phrases a lead either way, level, and a fresh Record', () => {
    const at = (you: number, computer: number): GameRecord => ({
      you: { wins: you, skunks: 0, doubleSkunks: 0 },
      computer: { wins: computer, skunks: 0, doubleSkunks: 0 },
      lastGame: null,
    });
    expect(describeRecord(at(3, 1)).lead).toBe('You lead 3 games to 1');
    expect(describeRecord(at(1, 2)).lead).toBe('Computer leads 2 games to 1');
    expect(describeRecord(at(2, 2)).lead).toBe('Level at 2 games each');
    expect(describeRecord(at(1, 1)).lead).toBe('Level at 1 game each');
    expect(describeRecord(at(1, 0)).lead).toBe('You lead 1 game to 0');
    expect(describeRecord(at(0, 0)).lead).toBe('No Games finished yet');
    expect(describeRecord(at(3, 1)).skunks).toBeNull();
  });

  it('mentions Skunks and Double Skunks only when there are any', () => {
    const record: GameRecord = {
      you: { wins: 3, skunks: 1, doubleSkunks: 0 },
      computer: { wins: 2, skunks: 2, doubleSkunks: 1 },
      lastGame: null,
    };
    expect(describeRecord(record).skunks).toBe(
      'Including 1 Skunk for you, and 2 Skunks and 1 Double Skunk for Computer',
    );
    const yours: GameRecord = {
      ...record,
      computer: { wins: 2, skunks: 0, doubleSkunks: 0 },
    };
    expect(describeRecord(yours).skunks).toBe('Including 1 Skunk for you');
  });

  it('survives a trip through storage and can be cleared', () => {
    const storage = memoryStorage();
    const record = recordGame(
      EMPTY_RECORD,
      gameResult(1, [50, 121]),
      HUMAN,
      'z',
    );
    saveRecord(storage, record);
    expect(loadRecord(storage)).toEqual(record);
    clearRecord(storage);
    expect(loadRecord(storage)).toEqual(EMPTY_RECORD);
  });

  it('ignores a save it cannot read', () => {
    const storage = memoryStorage();
    storage.setItem('cribbage.record', '{"you":"lots"}');
    expect(loadRecord(storage)).toEqual(EMPTY_RECORD);
    storage.setItem('cribbage.record', 'not json');
    expect(loadRecord(storage)).toEqual(EMPTY_RECORD);
  });
});
