import { cardValue, sameCard, type Card } from './cards';
import { otherSeat, type Seat } from './seat';
import { makeTally, type Combination, type Tally } from './tally';
import type { Violation } from './violation';

export const MAX_COUNT = 31;

export type PlayedCard = {
  readonly seat: Seat;
  readonly card: Card;
};

export type PeggingState = {
  /** Cards each Seat still holds. */
  readonly hands: readonly [readonly Card[], readonly Card[]];
  /** Cards played since the Count last reset, in order. */
  readonly sequence: readonly PlayedCard[];
  readonly count: number;
  /** The Seat expected to play next. Meaningless once `done`. */
  readonly turn: Seat;
  /** Whether each Seat has already said Go in this sequence. */
  readonly atGo: readonly [boolean, boolean];
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

export function startPegging(
  hands: readonly [readonly Card[], readonly Card[]],
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
  const played: PeggingState = {
    ...state,
    hands: withoutCard(state.hands, seat, card),
    sequence,
    count,
  };
  const events: PeggingEvent[] = [{ type: 'card-played', seat, card, count }];
  const tally = scorePlay(sequence, count);
  if (tally.total > 0) events.push({ type: 'tally', seat, tally });
  return advance(played, seat, events);
}

function refuse(violation: Violation): PlayResult {
  return { ok: false, violation };
}

function withoutCard(
  hands: PeggingState['hands'],
  seat: Seat,
  card: Card,
): PeggingState['hands'] {
  const remaining = hands[seat].filter((c) => !sameCard(c, card));
  return seat === 0 ? [remaining, hands[1]] : [hands[0], remaining];
}

/** Decides who acts next after `lastPlayer` played, or ends the sequence. */
function advance(
  state: PeggingState,
  lastPlayer: Seat,
  events: PeggingEvent[],
): PlayResult {
  if (state.count === MAX_COUNT) {
    return endSequence(state, lastPlayer, events, false);
  }
  const opponent = otherSeat(lastPlayer);
  if (legalCards(state, opponent).length > 0) {
    return { ok: true, state: { ...state, turn: opponent }, events };
  }
  let next = state;
  if (state.hands[opponent].length > 0 && !state.atGo[opponent]) {
    events.push({ type: 'go', seat: opponent });
    next = { ...state, atGo: withGo(state.atGo, opponent) };
  }
  if (legalCards(next, lastPlayer).length > 0) {
    return { ok: true, state: { ...next, turn: lastPlayer }, events };
  }
  return endSequence(next, lastPlayer, events, true);
}

function withGo(atGo: PeggingState['atGo'], seat: Seat): PeggingState['atGo'] {
  return seat === 0 ? [true, atGo[1]] : [atGo[0], true];
}

/**
 * Ends the current sequence: Last Card to whoever played last unless they
 * made Thirty-One, then either the next leader takes over or Pegging ends.
 */
function endSequence(
  state: PeggingState,
  lastPlayer: Seat,
  events: PeggingEvent[],
  awardLastCard: boolean,
): PlayResult {
  const lastCard = state.sequence.at(-1)?.card;
  if (awardLastCard && lastCard !== undefined) {
    events.push({
      type: 'tally',
      seat: lastPlayer,
      tally: makeTally([{ kind: 'last-card', points: 1, cards: [lastCard] }]),
    });
  }
  const reset = {
    ...state,
    sequence: [],
    count: 0,
    atGo: [false, false] as const,
  };
  if (state.hands[0].length + state.hands[1].length === 0) {
    events.push({ type: 'pegging-ended' });
    return { ok: true, state: { ...reset, done: true }, events };
  }
  const opponent = otherSeat(lastPlayer);
  const leader = state.hands[opponent].length > 0 ? opponent : lastPlayer;
  events.push({ type: 'sequence-ended', leader });
  return { ok: true, state: { ...reset, turn: leader }, events };
}

/** The Combinations the newest card in the sequence makes. */
function scorePlay(sequence: readonly PlayedCard[], count: number): Tally {
  const cards = sequence.map((p) => p.card);
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
  const tail = cards.slice(cards.length - n);
  if (n === 2) return [{ kind: 'pair', points: 2, cards: tail }];
  if (n === 3) return [{ kind: 'pair-royal', points: 6, cards: tail }];
  if (n === 4) return [{ kind: 'double-pair-royal', points: 12, cards: tail }];
  return [];
}

/** The longest Run formed by the cards ending the sequence, in any order. */
function runAtEnd(cards: readonly Card[]): Combination[] {
  for (let length = cards.length; length >= 3; length--) {
    const tail = cards.slice(cards.length - length);
    const ranks = tail.map((c) => c.rank).sort((a, b) => a - b);
    const consecutive = ranks.every(
      (rank, i) => i === 0 || rank === (ranks[i - 1] ?? 0) + 1,
    );
    if (consecutive) return [{ kind: 'run', points: length, cards: tail }];
  }
  return [];
}
