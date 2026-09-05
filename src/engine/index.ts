// The pure cribbage engine. Framework-free, deterministic, no I/O.
// See docs/adr/0001-pure-engine-ui-as-thin-consumer.md and CONTEXT.md.
export {
  cardValue,
  fullDeck,
  isCard,
  parseCard,
  parseCards,
  sameCard,
} from './cards';
export type { Card, Rank, Suit } from './cards';
export {
  DISCARD_SIZE,
  DOUBLE_SKUNK_LINE,
  SKUNK_LINE,
  WINNING_SCORE,
  apply,
  gameResult,
  newGame,
  replay,
  seatsToAct,
  viewFor,
} from './game';
export type {
  Action,
  ApplyResult,
  GameEvent,
  GameResult,
  GameState,
  NewGameOptions,
  PeggingView,
  Phase,
  ShowCounted,
  Skunk,
  View,
} from './game';
export { MAX_COUNT, tallyForPlay } from './pegging';
export type { PeggingEvent, PlayedCard } from './pegging';
export { createRng, nextInt } from './random';
export type { Draw, Rng } from './random';
export { otherSeat, withSeat } from './seat';
export { scoreShow } from './show';
export type { PerSeat, Seat } from './seat';
export type { Combination, CombinationKind, Tally } from './tally';
export type { Violation } from './violation';
