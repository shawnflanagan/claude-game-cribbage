import { cardValue, sameCard, type Card } from './cards';
import { isRun, pairOf } from './combinations';
import { otherSeat, withSeat, type PerSeat, type Seat } from './seat';
import { makeTally, type Combination, type Tally } from './tally';
import type { Violation } from './violation';

export const MAX_COUNT = 31;

export type PlayedCard = {
  readonly seat: Seat;
  readonly card: Card;
};

export type PeggingState = {
  /** Cards each Seat still holds. */
  readonly hands: PerSeat<readonly Card[]>;
  /** Cards played since the Count last reset, in order. */
  readonly sequence: readonly PlayedCard[];
  readonly count: number;
  /** The Seat expected to play next. Meaningless once `done`. */
  readonly turn: Seat;
  /** Whether each Seat has already said Go in this sequence. */
  readonly atGo: PerSeat<boolean>;
  readonly done: boolean;
};

export type PeggingEvent =
  | { type: 'card-played'; seat: Seat; card: Card; count: number }
  | { type: 'tally'; seat: Seat; tally: Tally }
  | { type: 'go'; seat: Seat }
  | { type: 'sequence-ended'; leader: Seat }
  | { type: 'pegging-ended' };

export type PlayResult =
  | { ok: true; state: PeggingState; events: readonly PeggingEvent[] }
  | { ok: false; violation: Violation };

type Step = { state: PeggingState; events: readonly PeggingEvent[] };

export function startPegging(
  hands: PerSeat<readonly Card[]>,
  leader: Seat,
): PeggingState {
  return {
    hands,
    sequence: [],
    count: 0,
    turn: leader,
    atGo: [false, false],
    done: false,
  };
}

/** The cards this Seat could play onto the current Count. Empty means Go. */
export function legalCards(state: PeggingState, seat: Seat): Card[] {
  return state.hands[seat].filter(
    (card) => state.count + cardValue(card) <= MAX_COUNT,
  );
}

/**
 * Plays one card. On success the state has already advanced through every
 * automatic consequence: the other Seat's Go, a sequence ending with Last
 * Card or Thirty-One, and the next leader taking the turn (ADR 0003).
 */
export function playCard(
  state: PeggingState,
  seat: Seat,
  card: Card,
): PlayResult {
  if (state.done) return refuse('wrong-phase');
  if (state.turn !== seat) return refuse('not-your-turn');
  if (!state.hands[seat].some((c) => sameCard(c, card))) {
    return refuse('card-not-in-hand');
  }
  const count = state.count + cardValue(card);
  if (count > MAX_COUNT) return refuse('count-would-exceed-31');

  const sequence = [...state.sequence, { seat, card }];
  const remaining = state.hands[seat].filter((c) => !sameCard(c, card));
  const played: PeggingState = {
    ...state,
    hands: withSeat(state.hands, seat, remaining),
    sequence,
    count,
  };
  const tally = scorePlay(sequence, count);
  const events: PeggingEvent[] = [{ type: 'card-played', seat, card, count }];
  if (tally.total > 0) events.push({ type: 'tally', seat, tally });
  const next = advance(played, seat);
  return { ok: true, state: next.state, events: [...events, ...next.events] };
}

function refuse(violation: Violation): PlayResult {
  return { ok: false, violation };
}

/** Decides who acts next after `lastSeat` played, or ends the sequence. */
function advance(state: PeggingState, lastSeat: Seat): Step {
  if (state.count === MAX_COUNT) return endSequence(state, lastSeat);
  const other = otherSeat(lastSeat);
  if (legalCards(state, other).length > 0) {
    return { state: { ...state, turn: other }, events: [] };
  }
  // The other Seat is at Go, said once per sequence, and only if it holds
  // cards at all: a Seat that has played out says nothing.
  const says = state.hands[other].length > 0 && !state.atGo[other];
  const marked = says
    ? { ...state, atGo: withSeat(state.atGo, other, true) }
    : state;
  const events: PeggingEvent[] = says ? [{ type: 'go', seat: other }] : [];
  if (legalCards(marked, lastSeat).length > 0) {
    return { state: { ...marked, turn: lastSeat }, events };
  }
  const ended = endSequence(marked, lastSeat);
  return { state: ended.state, events: [...events, ...ended.events] };
}

/**
 * Ends the current sequence: Last Card to whoever played last unless they
 * made Thirty-One, then either the next leader takes over or Pegging ends.
 */
function endSequence(state: PeggingState, lastSeat: Seat): Step {
  const events: PeggingEvent[] = [];
  const lastCard = state.sequence.at(-1)?.card;
  if (state.count !== MAX_COUNT && lastCard !== undefined) {
    events.push({
      type: 'tally',
      seat: lastSeat,
      tally: makeTally([{ kind: 'last-card', points: 1, cards: [lastCard] }]),
    });
  }
  const reset: PeggingState = {
    ...state,
    sequence: [],
    count: 0,
    atGo: [false, false],
  };
  if (state.hands[0].length + state.hands[1].length === 0) {
    events.push({ type: 'pegging-ended' });
    return { state: { ...reset, done: true }, events };
  }
  const other = otherSeat(lastSeat);
  const leader = state.hands[other].length > 0 ? other : lastSeat;
  events.push({ type: 'sequence-ended', leader });
  return { state: { ...reset, turn: leader }, events };
}

/** The Combinations the newest card in the sequence makes. */
function scorePlay(sequence: readonly PlayedCard[], count: number): Tally {
  return tallyForCards(
    sequence.map((p) => p.card),
    count,
  );
}

/**
 * What playing `card` after `before` would score. Lets an opponent weigh a
 * play without touching Pegging state.
 */
export function tallyForPlay(before: readonly Card[], card: Card): Tally {
  const cards = [...before, card];
  const count = cards.reduce((sum, c) => sum + cardValue(c), 0);
  return tallyForCards(cards, count);
}

function tallyForCards(cards: readonly Card[], count: number): Tally {
  const combinations: Combination[] = [];
  if (count === 15) combinations.push({ kind: 'fifteen', points: 2, cards });
  if (count === MAX_COUNT) {
    combinations.push({ kind: 'thirty-one', points: 2, cards });
  }
  combinations.push(...pairAtEnd(cards), ...runAtEnd(cards));
  return makeTally(combinations);
}

/** Two, three, or four cards of one rank ending the sequence. */
function pairAtEnd(cards: readonly Card[]): Combination[] {
  const last = cards.at(-1);
  if (last === undefined) return [];
  let n = 0;
  for (let i = cards.length - 1; i >= 0 && cards[i]?.rank === last.rank; i--) {
    n++;
  }
  const pair = pairOf(cards.slice(cards.length - n));
  return pair === undefined ? [] : [pair];
}

/** The longest Run formed by the cards ending the sequence, in any order. */
function runAtEnd(cards: readonly Card[]): Combination[] {
  for (let length = cards.length; length >= 3; length--) {
    const tail = cards.slice(cards.length - length);
    if (isRun(tail)) return [{ kind: 'run', points: length, cards: tail }];
  }
  return [];
}
