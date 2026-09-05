import {
  apply,
  createRng,
  newGame,
  otherSeat,
  sameCard,
  seatsToAct,
  viewFor,
  withSeat,
  type Action,
  type Card,
  type GameEvent,
  type GameResult,
  type GameState,
  type PerSeat,
  type PlayedCard,
  type Rng,
  type Seat,
  type ShowCounted,
  type Tally,
} from '../engine';
import type { Opponent } from '../opponent';

/**
 * One Game as the UI holds it. The engine runs ahead the moment a decision
 * lands; the presentation cursor `revealed` walks the Events behind it so
 * the table catches up at a human pace (ADR 0003).
 */
export type Session = {
  /** Kept so the Game can be saved and replayed (ADR 0002). */
  readonly seed: number;
  readonly human: Seat;
  readonly engine: GameState;
  readonly events: readonly GameEvent[];
  /** Every accepted Action so far: with the seed, the whole Game (ADR 0002). */
  readonly actions: readonly Action[];
  readonly revealed: number;
  readonly opponentRng: Rng;
};

export function startSession(seed: number, human: Seat = 0): Session {
  const { state, events } = newGame(seed);
  return {
    seed,
    human,
    engine: state,
    events,
    actions: [],
    revealed: 0,
    // The opponent's stream is derived from the seed so a Game replays.
    opponentRng: createRng(seed ^ 0x5eed),
  };
}

/** Applies the human's Action. A refused Action leaves the session as is. */
export function humanAct(session: Session, action: Action): Session {
  const result = apply(session.engine, action);
  if (!result.ok) return session;
  return {
    ...session,
    engine: result.state,
    events: [...session.events, ...result.events],
    actions: [...session.actions, action],
  };
}

/** Whether the engine is waiting on the Computer's Seat. */
export function computerToAct(session: Session): boolean {
  const computer = otherSeat(session.human);
  return seatsToAct(viewFor(session.engine, computer)).includes(computer);
}

/** Lets the Computer act if the engine is waiting on it; null when not. */
export function computerAct(
  session: Session,
  opponent: Opponent,
): Session | null {
  if (!computerToAct(session)) return null;
  const computer = otherSeat(session.human);
  const choice = opponent(
    viewFor(session.engine, computer),
    session.opponentRng,
  );
  const result = apply(session.engine, choice.value);
  if (!result.ok) return null;
  return {
    ...session,
    engine: result.state,
    events: [...session.events, ...result.events],
    actions: [...session.actions, choice.value],
    opponentRng: choice.rng,
  };
}

export function reveal(session: Session): Session {
  if (session.revealed >= session.events.length) return session;
  return { ...session, revealed: session.revealed + 1 };
}

export function revealAll(session: Session): Session {
  return { ...session, revealed: session.events.length };
}

export function caughtUp(session: Session): boolean {
  return session.revealed >= session.events.length;
}

export type Pause =
  { kind: 'idle' } | { kind: 'after'; ms: number } | { kind: 'continue' };

export const COMPUTER_MOVE_MS = 600;

/** Events nobody sees on their own: they ride along with the one before. */
function isBookkeeping(event: GameEvent): boolean {
  return event.type === 'scored' || event.type === 'round-ended';
}

/**
 * How the next unrevealed Event should arrive: after a delay so the human
 * can follow the Computer, at once for the human's own doings, or only when
 * they press Continue after reading a Show count.
 */
export function nextPause(session: Session): Pause {
  const next = session.events[session.revealed];
  if (next === undefined) return { kind: 'idle' };
  if (isBookkeeping(next)) return { kind: 'after', ms: 0 };
  if (lastVisible(session)?.type === 'show-counted')
    return { kind: 'continue' };
  return { kind: 'after', ms: delayBefore(next, session.human) };
}

/** The most recent revealed Event that a person would notice. */
function lastVisible(session: Session): GameEvent | undefined {
  for (let i = session.revealed - 1; i >= 0; i--) {
    const event = session.events[i];
    if (event !== undefined && !isBookkeeping(event)) return event;
  }
  return undefined;
}

function delayBefore(event: GameEvent, human: Seat): number {
  switch (event.type) {
    case 'card-played':
    case 'discarded':
      return event.seat === human ? 0 : COMPUTER_MOVE_MS;
    case 'go':
      return event.seat === human ? COMPUTER_MOVE_MS / 2 : COMPUTER_MOVE_MS;
    case 'cut-for-deal':
    case 'dealt':
    case 'starter-cut':
    case 'heels':
    case 'tally':
    case 'show-counted':
      return COMPUTER_MOVE_MS;
    case 'sequence-ended':
    case 'pegging-ended':
      return COMPUTER_MOVE_MS / 2;
    case 'scored':
    case 'round-ended':
    case 'game-won':
      return 0;
  }
}

export type Stage = 'cutting' | 'discarding' | 'pegging' | 'show' | 'over';

export type LastTally = {
  readonly seat: Seat;
  readonly tally: Tally;
  readonly source: 'pegging' | 'heels' | 'hand' | 'crib';
};

/** What the table shows: a fold over the revealed Events. */
export type TableModel = {
  readonly stage: Stage;
  readonly round: number;
  readonly dealer: Seat | null;
  readonly cuts: PerSeat<Card> | null;
  readonly scores: PerSeat<number>;
  /** Cards each Seat still holds at this point of the presentation. */
  readonly hands: PerSeat<readonly Card[]>;
  /** The four cards each Seat kept for the Show, known once the Starter is cut. */
  readonly kept: PerSeat<readonly Card[]>;
  readonly discarded: PerSeat<boolean>;
  readonly cribSize: number;
  /** The Crib's cards, once the Show reveals them. */
  readonly crib: readonly Card[] | null;
  readonly starter: Card | null;
  readonly sequence: readonly PlayedCard[];
  readonly count: number;
  readonly saidGo: Seat | null;
  readonly lastTally: LastTally | null;
  readonly shows: readonly ShowCounted[];
  readonly result: GameResult | null;
};

const EMPTY: TableModel = {
  stage: 'cutting',
  round: 0,
  dealer: null,
  cuts: null,
  scores: [0, 0],
  hands: [[], []],
  kept: [[], []],
  discarded: [false, false],
  cribSize: 0,
  crib: null,
  starter: null,
  sequence: [],
  count: 0,
  saidGo: null,
  lastTally: null,
  shows: [],
  result: null,
};

export function present(session: Session): TableModel {
  return session.events.slice(0, session.revealed).reduce(step, EMPTY);
}

function without(
  hands: PerSeat<readonly Card[]>,
  seat: Seat,
  cards: readonly Card[],
): PerSeat<readonly Card[]> {
  const kept = hands[seat].filter((c) => !cards.some((d) => sameCard(c, d)));
  return withSeat(hands, seat, kept);
}

function step(model: TableModel, event: GameEvent): TableModel {
  switch (event.type) {
    case 'cut-for-deal':
      return {
        ...model,
        stage: 'cutting',
        cuts: event.cuts,
        dealer: event.dealer,
      };
    case 'dealt':
      return {
        ...EMPTY,
        stage: 'discarding',
        scores: model.scores,
        round: event.round,
        dealer: event.dealer,
        hands: event.hands,
      };
    case 'discarded':
      return {
        ...model,
        hands: without(model.hands, event.seat, event.cards),
        discarded: withSeat(model.discarded, event.seat, true),
        cribSize: model.cribSize + event.cards.length,
      };
    case 'starter-cut':
      return {
        ...model,
        stage: 'pegging',
        starter: event.card,
        kept: model.hands,
      };
    case 'heels':
      return {
        ...model,
        lastTally: { seat: event.seat, tally: event.tally, source: 'heels' },
      };
    case 'card-played':
      return {
        ...model,
        hands: without(model.hands, event.seat, [event.card]),
        sequence: [...model.sequence, { seat: event.seat, card: event.card }],
        count: event.count,
      };
    case 'tally':
      return {
        ...model,
        lastTally: { seat: event.seat, tally: event.tally, source: 'pegging' },
      };
    case 'go':
      return { ...model, saidGo: event.seat };
    case 'sequence-ended':
      return { ...model, sequence: [], count: 0, saidGo: null };
    case 'pegging-ended':
      return { ...model, stage: 'show', sequence: [], count: 0, saidGo: null };
    case 'show-counted':
      return {
        ...model,
        shows: [...model.shows, event],
        crib: event.source === 'crib' ? event.cards : model.crib,
        lastTally: {
          seat: event.seat,
          tally: event.tally,
          source: event.source,
        },
      };
    case 'scored':
      return { ...model, scores: event.scores };
    case 'round-ended':
      return model;
    case 'game-won':
      return { ...model, stage: 'over', result: event.result };
  }
}
