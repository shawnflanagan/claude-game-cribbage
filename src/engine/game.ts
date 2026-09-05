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
/** A Discard is exactly two cards. */
export const DISCARD_SIZE = 2;

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
  readonly deck: readonly Card[];
  readonly pegging: PeggingState | null;
  readonly result: GameResult | null;
};

export type ShowCounted = {
  type: 'show-counted';
  seat: Seat;
  source: 'hand' | 'crib';
  cards: readonly Card[];
  tally: Tally;
};

/**
 * Everything that happens in a Game, in order. Events are the whole truth,
 * including both Hands and both Discards: a consumer that must not see the
 * other Seat's cards (a future networked client) filters them per Seat, the
 * way `viewFor` filters state. The opponent never receives Events.
 */
export type GameEvent =
  | { type: 'cut-for-deal'; cuts: PerSeat<Card>; dealer: Seat | null }
  | {
      type: 'dealt';
      dealer: Seat;
      round: number;
      hands: PerSeat<readonly Card[]>;
    }
  | { type: 'discarded'; seat: Seat; cards: readonly Card[] }
  | { type: 'starter-cut'; card: Card }
  | { type: 'heels'; seat: Seat; tally: Tally }
  | ShowCounted
  /** Follows every Event that carries a Tally worth points, with the scores after it. */
  | { type: 'scored'; seat: Seat; points: number; scores: PerSeat<number> }
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

/**
 * Rebuilds a Game from its seed and Action history (ADR 0002). Fails with
 * the first Violation if the history does not fit the seed.
 */
export function replay(
  seed: number,
  actions: readonly Action[],
  options: NewGameOptions = {},
): ApplyResult {
  let step = newGame(seed, options);
  for (const action of actions) {
    const result = apply(step.state, action);
    if (!result.ok) return result;
    step = { state: result.state, events: [...step.events, ...result.events] };
  }
  return { ok: true, ...step };
}

/** Cuts for deal, deals the first Round, and waits for Discards. */
export function newGame(seed: number, options: NewGameOptions = {}): Step {
  let rng = createRng(seed);
  const events: GameEvent[] = [];
  let dealer: Seat | null = null;
  // Cut for deal: each Seat draws from a shuffled deck and the lower card
  // deals, Ace low. A tie means cut again.
  while (dealer === null) {
    const cut = shuffle(fullDeck(), rng);
    rng = cut.rng;
    const [a, b] = cut.value;
    if (a === undefined || b === undefined) throw unreachable('empty deck');
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

/**
 * For states the rules make impossible (a 52-card deck running dry, Pegging
 * without a Starter). Not a Violation: no Action can cause it.
 */
function unreachable(what: string): Error {
  return new Error(`Engine invariant broken: ${what}`);
}

function emit(state: GameState, ...events: GameEvent[]): Step {
  return { state, events };
}

/** Runs `next` after `step` unless the Game has already been won. */
function then(step: Step, next: (state: GameState) => Step): Step {
  if (step.state.phase === 'game-over') return step;
  const after = next(step.state);
  return { state: after.state, events: [...step.events, ...after.events] };
}

/** Records an Event that carries a Tally, then adds its points. */
function scoreEvent(
  state: GameState,
  event: GameEvent,
  seat: Seat,
  tally: Tally,
): Step {
  const scored = score(state, seat, tally.total);
  return { state: scored.state, events: [event, ...scored.events] };
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
    cards.length !== DISCARD_SIZE ||
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
  const bothDone = discarded.hands.every((h) => h.length === KEPT_SIZE);
  const step = then(emit(discarded, { type: 'discarded', seat, cards }), (s) =>
    bothDone ? cutStarter(s) : emit(s),
  );
  return { ok: true, ...step };
}

function applyPlay(state: GameState, seat: Seat, card: Card): ApplyResult {
  if (state.phase !== 'pegging' || state.pegging === null) {
    return refuse('wrong-phase');
  }
  const played = playCard(state.pegging, seat, card);
  if (!played.ok) return refuse(played.violation);
  let step = emit({ ...state, pegging: played.state });
  for (const event of played.events) {
    step = then(step, (s) =>
      event.type === 'tally'
        ? scoreEvent(s, event, event.seat, event.tally)
        : emit(s, event),
    );
  }
  step = then(step, (s) => (played.state.done ? show(s) : emit(s)));
  return { ok: true, ...step };
}

function deal(state: GameState, dealer: Seat): Step {
  const shuffled = shuffle(fullDeck(), state.rng);
  const deck = shuffled.value;
  const pone = otherSeat(dealer);
  const hands: [Card[], Card[]] = [[], []];
  // Six cards each, one at a time, Pone first.
  for (let i = 0; i < HAND_SIZE * 2; i++) {
    const card = deck[i];
    if (card === undefined) throw unreachable('short deck');
    hands[i % 2 === 0 ? pone : dealer].push(card);
  }
  const round = state.round + 1;
  return emit(
    {
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
    { type: 'dealt', dealer, round, hands },
  );
}

/** Turns the Starter, scores Heels for a Jack, and begins Pegging. */
function cutStarter(state: GameState): Step {
  const draw = nextInt(state.rng, state.deck.length);
  const starter = state.deck[draw.value];
  if (starter === undefined) throw unreachable('empty deck');
  const cut = emit(
    {
      ...state,
      rng: draw.rng,
      starter,
      deck: state.deck.filter((_, i) => i !== draw.value),
    },
    { type: 'starter-cut', card: starter },
  );
  const withHeels = then(cut, (s) => {
    if (starter.rank !== JACK) return emit(s);
    const tally = makeTally([{ kind: 'heels', points: 2, cards: [starter] }]);
    const event: GameEvent = { type: 'heels', seat: s.dealer, tally };
    return scoreEvent(s, event, s.dealer, tally);
  });
  return then(withHeels, (s) =>
    emit({
      ...s,
      phase: 'pegging',
      pegging: startPegging(s.hands, otherSeat(s.dealer)),
    }),
  );
}

/** Pone's Hand, then the Dealer's, then the Crib; then the next Round. */
function show(state: GameState): Step {
  const starter = state.starter;
  if (starter === null) throw unreachable('Pegging without a Starter');
  const dealer = state.dealer;
  const pone = otherSeat(dealer);
  const counts: Omit<ShowCounted, 'type' | 'tally'>[] = [
    { seat: pone, source: 'hand', cards: state.hands[pone] },
    { seat: dealer, source: 'hand', cards: state.hands[dealer] },
    { seat: dealer, source: 'crib', cards: state.crib },
  ];
  let step = emit(state);
  for (const count of counts) {
    step = then(step, (s) => {
      const tally = scoreShow({
        cards: count.cards,
        starter,
        isCrib: count.source === 'crib',
      });
      const event: ShowCounted = { type: 'show-counted', ...count, tally };
      return scoreEvent(s, event, count.seat, tally);
    });
  }
  step = then(step, (s) => emit(s, { type: 'round-ended', round: s.round }));
  return then(step, (s) => deal(s, pone));
}

/** Adds points for a Seat and ends the Game the instant 121 is reached. */
function score(state: GameState, seat: Seat, points: number): Step {
  if (points === 0) return emit(state);
  const total = Math.min(WINNING_SCORE, state.scores[seat] + points);
  const scores = withSeat(state.scores, seat, total);
  const scored: GameEvent = { type: 'scored', seat, points, scores };
  if (total < WINNING_SCORE) return emit({ ...state, scores }, scored);
  const result = gameResult(seat, scores);
  return emit({ ...state, scores, phase: 'game-over', result }, scored, {
    type: 'game-won',
    result,
  });
}

/**
 * The result once `winner` has reached 121: a Skunk if the loser is under
 * 91, a Double Skunk under 61.
 */
export function gameResult(winner: Seat, scores: PerSeat<number>): GameResult {
  const loser = scores[otherSeat(winner)];
  const skunk: Skunk =
    loser < DOUBLE_SKUNK_LINE
      ? 'double-skunk'
      : loser < SKUNK_LINE
        ? 'skunk'
        : 'none';
  return { winner, scores, skunk };
}

export type PeggingView = {
  readonly count: number;
  readonly sequence: PeggingState['sequence'];
  readonly turn: Seat;
  readonly done: boolean;
  /** The viewing Seat's cards still to play. */
  readonly hand: readonly Card[];
  readonly otherHandSize: number;
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
  readonly otherHandSize: number;
  readonly cribSize: number;
  readonly starter: Card | null;
  /** Whether each Seat has sent its Discards to the Crib this Round. */
  readonly discarded: PerSeat<boolean>;
  readonly pegging: PeggingView | null;
};

/** The Seats a decision is waiting on: both may Discard, one Seat pegs. */
export function seatsToAct(view: View): readonly Seat[] {
  switch (view.phase) {
    case 'discard':
      return ([0, 1] as const).filter((seat) => !view.discarded[seat]);
    case 'pegging':
      return view.pegging === null ? [] : [view.pegging.turn];
    case 'game-over':
      return [];
  }
}

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
    otherHandSize: state.hands[other].length,
    cribSize: state.crib.length,
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
            otherHandSize: pegging.hands[other].length,
            legal: legalCards(pegging, seat),
          },
  };
}
