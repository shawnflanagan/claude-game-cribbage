import type { Card } from './cards';

export type CombinationKind =
  | 'fifteen'
  | 'pair'
  | 'pair-royal'
  | 'double-pair-royal'
  | 'run'
  | 'flush'
  | 'nobs';

/** One scoring item: what kind, how many points, and which cards made it. */
export type Combination = {
  readonly kind: CombinationKind;
  readonly points: number;
  readonly cards: readonly Card[];
};

/** Every Combination for one Hand, the Crib, or (later) one Pegging play. */
export type Tally = {
  readonly combinations: readonly Combination[];
  readonly total: number;
};

export function makeTally(combinations: readonly Combination[]): Tally {
  return {
    combinations,
    total: combinations.reduce((sum, c) => sum + c.points, 0),
  };
}
