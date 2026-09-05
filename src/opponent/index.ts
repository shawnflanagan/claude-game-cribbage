// Computer opponents: pure functions from a View to an Action.
// May depend on the engine, never on the UI. See docs/adr/0001.
export type { Opponent } from './opponent';
export { playout } from './playout';
export type { Playout } from './playout';
export { randomOpponent } from './random';
