/** One of the two symmetric positions at the table. */
export type Seat = 0 | 1;

export const SEATS: readonly Seat[] = [0, 1];

export function otherSeat(seat: Seat): Seat {
  return seat === 0 ? 1 : 0;
}
