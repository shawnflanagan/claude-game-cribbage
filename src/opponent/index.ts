// Computer opponents: pure functions from a View to an Action.
// May depend on the engine, never on the UI. See docs/adr/0001.
export type { Opponent } from './opponent';
export { randomOpponent } from './random';
