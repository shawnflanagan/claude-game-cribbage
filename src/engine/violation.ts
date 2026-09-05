/** Why an Action was refused. Returned as a value, never thrown. */
export type Violation =
  | 'not-your-turn'
  | 'card-not-in-hand'
  | 'count-would-exceed-31'
  | 'wrong-phase';
