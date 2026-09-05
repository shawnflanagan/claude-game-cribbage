import type { GameResult, Seat } from '../engine';
import { isObject, readItem, removeItem, writeItem } from './storage';

export const RECORD_KEY = 'cribbage.record';

/** One party's standing in the Record: Games won, how many were Skunks. */
export type Standing = {
  readonly wins: number;
  readonly skunks: number;
  readonly doubleSkunks: number;
};

/**
 * The glossary's Record: finished Games between the human and the Computer,
 * kept by who they are rather than which Seat they sat in. (The prefix only
 * keeps clear of TypeScript's built-in Record type.)
 */
export type GameRecord = {
  readonly you: Standing;
  readonly computer: Standing;
  /**
   * The key of the last Game counted, so reporting it again (a re-render, a
   * reload onto the result screen) changes nothing. See `gameKey`.
   */
  readonly lastGame: string | null;
};

const NOTHING: Standing = { wins: 0, skunks: 0, doubleSkunks: 0 };

export const EMPTY_RECORD: GameRecord = {
  you: NOTHING,
  computer: NOTHING,
  lastGame: null,
};

/**
 * Identifies one finished Game: its seed and how many Actions it took. Two
 * Games with the same seed are the same deals, so only identical play
 * (the same Actions, hence the same winner) would be counted once.
 */
export function gameKey(seed: number, actions: number): string {
  return `${String(seed)}:${String(actions)}`;
}

/** Adds a finished Game. Only a Game that reached 121 has a result to add. */
export function recordGame(
  record: GameRecord,
  result: GameResult,
  human: Seat,
  key: string,
): GameRecord {
  if (record.lastGame === key) return record;
  const winner = result.winner === human ? 'you' : 'computer';
  const before = record[winner];
  const after: Standing = {
    wins: before.wins + 1,
    skunks: before.skunks + (result.skunk === 'skunk' ? 1 : 0),
    doubleSkunks:
      before.doubleSkunks + (result.skunk === 'double-skunk' ? 1 : 0),
  };
  return { ...record, [winner]: after, lastGame: key };
}

function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? '' : 's'}`;
}

function skunksOf(standing: Standing): string | null {
  const parts = [
    standing.skunks > 0 ? plural(standing.skunks, 'Skunk') : null,
    standing.doubleSkunks > 0
      ? plural(standing.doubleSkunks, 'Double Skunk')
      : null,
  ].filter((p) => p !== null);
  return parts.length === 0 ? null : parts.join(' and ');
}

/** "You lead 3 games to 1", with a second line for Skunks when there are any. */
export function describeRecord(record: GameRecord): {
  lead: string;
  skunks: string | null;
} {
  const { you, computer } = record;
  let lead: string;
  if (you.wins + computer.wins === 0) lead = 'No Games finished yet';
  else if (you.wins > computer.wins)
    lead = `You lead ${plural(you.wins, 'game')} to ${String(computer.wins)}`;
  else if (computer.wins > you.wins)
    lead = `Computer leads ${plural(computer.wins, 'game')} to ${String(you.wins)}`;
  else lead = `Level at ${plural(you.wins, 'game')} each`;

  const yours = skunksOf(you);
  const theirs = skunksOf(computer);
  const lines = [
    yours === null ? null : `${yours} for you`,
    theirs === null ? null : `${theirs} for Computer`,
  ].filter((p) => p !== null);
  const skunks =
    lines.length === 0 ? null : `Including ${lines.join(', and ')}`;
  return { lead, skunks };
}

type SavedRecord = { readonly version: 1 } & GameRecord;

export function saveRecord(storage: Storage, record: GameRecord): void {
  const saved: SavedRecord = { version: 1, ...record };
  writeItem(storage, RECORD_KEY, saved);
}

export function loadRecord(storage: Storage): GameRecord {
  const saved = readItem(storage, RECORD_KEY);
  if (!isSavedRecord(saved)) return EMPTY_RECORD;
  return { you: saved.you, computer: saved.computer, lastGame: saved.lastGame };
}

export function clearRecord(storage: Storage): void {
  removeItem(storage, RECORD_KEY);
}

function isStanding(value: unknown): value is Standing {
  return (
    isObject(value) &&
    Number.isInteger(value.wins) &&
    Number.isInteger(value.skunks) &&
    Number.isInteger(value.doubleSkunks)
  );
}

function isSavedRecord(value: unknown): value is SavedRecord {
  return (
    isObject(value) &&
    value.version === 1 &&
    isStanding(value.you) &&
    isStanding(value.computer) &&
    (value.lastGame === null || typeof value.lastGame === 'string')
  );
}
