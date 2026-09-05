// The pure cribbage engine. Framework-free, deterministic, no I/O.
// See docs/adr/0001-pure-engine-ui-as-thin-consumer.md and CONTEXT.md.
export {
  cardValue,
  formatCard,
  parseCard,
  parseCards,
  rankLabel,
  sameCard,
  suitGlyph,
} from './cards';
export type { Card, Rank, Suit } from './cards';
export {
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
export type { PeggingEvent, PlayedCard } from './pegging';
export { createRng, nextInt } from './random';
export type { Draw, Rng } from './random';
export { otherSeat } from './seat';
export type { PerSeat, Seat } from './seat';
export type { Combination, CombinationKind, Tally } from './tally';
export type { Violation } from './violation';
