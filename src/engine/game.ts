import { fullDeck, JACK, sameCard, type Card } from './cards';
import {
  legalCards,
  playCard,
  startPegging,
  type PeggingEvent,
  type PeggingState,
} from './pegging';
import { createRng, nextInt, shuffle, type Rng } from './random';
import { otherSeat, withSeat, type PerSeat, type Seat } from './seat';
import { scoreShow } from './show';
import { makeTally, type Tally } from './tally';
import type { Violation } from './violation';

export const WINNING_SCORE = 121;
export const SKUNK_LINE = 91;
export const DOUBLE_SKUNK_LINE = 61;
const HAND_SIZE = 6;
const KEPT_SIZE = 4;

/**
 * Where a Game is waiting for a decision. Everything mechanical happens
 * inside `apply`, so there is no phase for the cut, the Show, or the deal.
 */
export type Phase = 'discard' | 'pegging' | 'game-over';

/** The only decisions a Seat makes (ADR 0003). */
export type Action =
  | {
      readonly type: 'discard';
      readonly seat: Seat;
      readonly cards: readonly Card[];
    }
  | { readonly type: 'play'; readonly seat: Seat; readonly card: Card };

export type Skunk = 'none' | 'skunk' | 'double-skunk';

export type GameResult = {
  readonly winner: Seat;
  readonly scores: PerSeat<number>;
  readonly skunk: Skunk;
};

export type GameState = {
  readonly rng: Rng;
  readonly scores: PerSeat<number>;
  readonly dealer: Seat;
  readonly round: number;
  readonly phase: Phase;
  /** Six cards each after the deal, the four kept once a Seat has discarded. */
  readonly hands: PerSeat<readonly Card[]>;
  readonly crib: readonly Card[];
  readonly starter: Card | null;
  /** The undealt remainder of the deck. */
  readonly deck: readonly Card[];
  readonly pegging: PeggingState | null;
  readonly result: GameResult | null;
};

export type GameEvent =
  | { type: 'cut-for-deal'; cuts: PerSeat<Card>; dealer: Seat | null }
  | { type: 'dealt'; dealer: Seat; round: number }
  | { type: 'discarded'; seat: Seat }
  | { type: 'starter-cut'; card: Card }
  | { type: 'heels'; seat: Seat; tally: Tally }
  | {
      type: 'show-counted';
      seat: Seat;
      source: 'hand' | 'crib';
      cards: readonly Card[];
      tally: Tally;
    }
  | { type: 'round-ended'; round: number }
  | { type: 'game-won'; result: GameResult }
  | PeggingEvent;

export type ApplyResult =
  | { ok: true; state: GameState; events: readonly GameEvent[] }
  | { ok: false; violation: Violation };

type Step = { state: GameState; events: readonly GameEvent[] };

export type NewGameOptions = {
  /** Starting scores, for tests and handicap games. Defaults to 0 each. */
  readonly scores?: PerSeat<number>;
};

/** Cuts for deal, deals the first Round, and waits for Discards. */
export function newGame(seed: number, options: NewGameOptions = {}): Step {
  let rng = createRng(seed);
  const events: GameEvent[] = [];
  let dealer: Seat | null = null;
  while (dealer === null) {
    const cut = shuffle(fullDeck(), rng);
    rng = cut.rng;
    const [a, b] = cut.value;
    if (a === undefined || b === undefined) throw new Error('empty deck');
    dealer = a.rank < b.rank ? 0 : a.rank > b.rank ? 1 : null;
    events.push({ type: 'cut-for-deal', cuts: [a, b], dealer });
  }
  const dealt = deal(
    {
      rng,
      scores: options.scores ?? [0, 0],
      dealer,
      round: 0,
      phase: 'discard',
      hands: [[], []],
      crib: [],
      starter: null,
      deck: [],
      pegging: null,
      result: null,
    },
    dealer,
  );
  return { state: dealt.state, events: [...events, ...dealt.events] };
}

/**
 * Applies one Action and every mechanical consequence that follows it:
 * the Starter cut and Heels once both Seats have discarded, the Show and
 * the next deal once Pegging ends, and the end of the Game the instant a
 * score reaches 121.
 */
export function apply(state: GameState, action: Action): ApplyResult {
  if (state.phase === 'game-over') return refuse('wrong-phase');
  return action.type === 'discard'
    ? applyDiscard(state, action.seat, action.cards)
    : applyPlay(state, action.seat, action.card);
}

function refuse(violation: Violation): ApplyResult {
  return { ok: false, violation };
}

function applyDiscard(
  state: GameState,
  seat: Seat,
  cards: readonly Card[],
): ApplyResult {
  if (state.phase !== 'discard') return refuse('wrong-phase');
  const hand = state.hands[seat];
  if (hand.length !== HAND_SIZE) return refuse('not-your-turn');
  const [a, b] = cards;
  if (
    cards.length !== 2 ||
    a === undefined ||
    b === undefined ||
    sameCard(a, b)
  ) {
    return refuse('must-discard-two');
  }
  if (!cards.every((card) => hand.some((c) => sameCard(c, card)))) {
    return refuse('card-not-in-hand');
  }
  const kept = hand.filter((c) => !cards.some((d) => sameCard(c, d)));
  const discarded: GameState = {
    ...state,
    hands: withSeat(state.hands, seat, kept),
    crib: [...state.crib, ...cards],
  };
  const events: GameEvent[] = [{ type: 'discarded', seat }];
  const bothDone = discarded.hands.every((h) => h.length === KEPT_SIZE);
  const next = bothDone
    ? cutStarter(discarded)
    : { state: discarded, events: [] };
  return { ok: true, state: next.state, events: [...events, ...next.events] };
}

function applyPlay(state: GameState, seat: Seat, card: Card): ApplyResult {
  if (state.phase !== 'pegging' || state.pegging === null) {
    return refuse('wrong-phase');
  }
  const played = playCard(state.pegging, seat, card);
  if (!played.ok) return refuse(played.violation);
  let current: GameState = { ...state, pegging: played.state };
  const events: GameEvent[] = [];
  for (const event of played.events) {
    events.push(event);
    if (event.type === 'tally') {
      const scored = score(current, event.seat, event.tally.total);
      current = scored.state;
      events.push(...scored.events);
      if (current.phase === 'game-over') break;
    }
  }
  if (current.phase !== 'game-over' && played.state.done) {
    const shown = show(current);
    current = shown.state;
    events.push(...shown.events);
  }
  return { ok: true, state: current, events };
}

/** Shuffles a fresh deck and deals the next Round. */
function deal(state: GameState, dealer: Seat): Step {
  const shuffled = shuffle(fullDeck(), state.rng);
  const deck = shuffled.value;
  const pone = otherSeat(dealer);
  const hands: [Card[], Card[]] = [[], []];
  for (let i = 0; i < HAND_SIZE * 2; i++) {
    const card = deck[i];
    if (card === undefined) throw new Error('short deck');
    hands[i % 2 === 0 ? pone : dealer].push(card);
  }
  const round = state.round + 1;
  return {
    state: {
      ...state,
      rng: shuffled.rng,
      dealer,
      round,
      phase: 'discard',
      hands,
      crib: [],
      starter: null,
      deck: deck.slice(HAND_SIZE * 2),
      pegging: null,
    },
    events: [{ type: 'dealt', dealer, round }],
  };
}

/** Turns the Starter, scores Heels for a Jack, and begins Pegging. */
function cutStarter(state: GameState): Step {
  const draw = nextInt(state.rng, state.deck.length);
  const starter = state.deck[draw.value];
  if (starter === undefined) throw new Error('empty deck');
  let current: GameState = {
    ...state,
    rng: draw.rng,
    starter,
    deck: state.deck.filter((_, i) => i !== draw.value),
  };
  const events: GameEvent[] = [{ type: 'starter-cut', card: starter }];
  if (starter.rank === JACK) {
    const tally = makeTally([{ kind: 'heels', points: 2, cards: [starter] }]);
    events.push({ type: 'heels', seat: current.dealer, tally });
    const scored = score(current, current.dealer, tally.total);
    current = scored.state;
    events.push(...scored.events);
    if (current.phase === 'game-over') return { state: current, events };
  }
  return {
    state: {
      ...current,
      phase: 'pegging',
      pegging: startPegging(current.hands, otherSeat(current.dealer)),
    },
    events,
  };
}

/** Pone's Hand, then the Dealer's, then the Crib; then the next Round. */
function show(state: GameState): Step {
  if (state.starter === null) throw new Error('no Starter');
  const dealer = state.dealer;
  const pone = otherSeat(dealer);
  const counts: {
    seat: Seat;
    source: 'hand' | 'crib';
    cards: readonly Card[];
  }[] = [
    { seat: pone, source: 'hand', cards: state.hands[pone] },
    { seat: dealer, source: 'hand', cards: state.hands[dealer] },
    { seat: dealer, source: 'crib', cards: state.crib },
  ];
  let current = state;
  const events: GameEvent[] = [];
  for (const count of counts) {
    const tally = scoreShow({
      cards: count.cards,
      starter: state.starter,
      isCrib: count.source === 'crib',
    });
    events.push({ type: 'show-counted', ...count, tally });
    const scored = score(current, count.seat, tally.total);
    current = scored.state;
    events.push(...scored.events);
    if (current.phase === 'game-over') return { state: current, events };
  }
  events.push({ type: 'round-ended', round: current.round });
  const dealt = deal(current, pone);
  return { state: dealt.state, events: [...events, ...dealt.events] };
}

/** Adds points for a Seat and ends the Game the instant 121 is reached. */
function score(state: GameState, seat: Seat, points: number): Step {
  if (points === 0) return { state, events: [] };
  const total = Math.min(WINNING_SCORE, state.scores[seat] + points);
  const scores = withSeat(state.scores, seat, total);
  if (total < WINNING_SCORE) return { state: { ...state, scores }, events: [] };
  const loser = scores[otherSeat(seat)];
  const result: GameResult = {
    winner: seat,
    scores,
    skunk:
      loser < DOUBLE_SKUNK_LINE
        ? 'double-skunk'
        : loser < SKUNK_LINE
          ? 'skunk'
          : 'none',
  };
  return {
    state: { ...state, scores, phase: 'game-over', result },
    events: [{ type: 'game-won', result }],
  };
}

export type PeggingView = {
  readonly count: number;
  readonly sequence: PeggingState['sequence'];
  readonly turn: Seat;
  readonly done: boolean;
  /** The viewing Seat's cards still to play. */
  readonly hand: readonly Card[];
  readonly otherHandCount: number;
  /** Which of `hand` may be played onto the Count right now. */
  readonly legal: readonly Card[];
};

/** What one Seat may know: everything except the other Hand and the deck. */
export type View = {
  readonly seat: Seat;
  readonly phase: Phase;
  readonly scores: PerSeat<number>;
  readonly dealer: Seat;
  readonly round: number;
  readonly result: GameResult | null;
  readonly hand: readonly Card[];
  readonly otherHandCount: number;
  readonly cribCount: number;
  readonly starter: Card | null;
  /** Whether each Seat has sent its Discards to the Crib this Round. */
  readonly discarded: PerSeat<boolean>;
  readonly pegging: PeggingView | null;
};

export function viewFor(state: GameState, seat: Seat): View {
  const other = otherSeat(seat);
  const pegging = state.pegging;
  return {
    seat,
    phase: state.phase,
    scores: state.scores,
    dealer: state.dealer,
    round: state.round,
    result: state.result,
    hand: state.hands[seat],
    otherHandCount: state.hands[other].length,
    cribCount: state.crib.length,
    starter: state.starter,
    discarded: [
      state.hands[0].length === KEPT_SIZE,
      state.hands[1].length === KEPT_SIZE,
    ],
    pegging:
      pegging === null
        ? null
        : {
            count: pegging.count,
            sequence: pegging.sequence,
            turn: pegging.turn,
            done: pegging.done,
            hand: pegging.hands[seat],
            otherHandCount: pegging.hands[other].length,
            legal: legalCards(pegging, seat),
          },
  };
}
