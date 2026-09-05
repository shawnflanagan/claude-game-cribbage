/** One of the two symmetric positions at the table. */
export type Seat = 0 | 1;

export function otherSeat(seat: Seat): Seat {
  return seat === 0 ? 1 : 0;
}

/** A value per Seat, indexed by Seat. */
export type PerSeat<T> = readonly [T, T];

export function withSeat<T>(
  pair: PerSeat<T>,
  seat: Seat,
  value: T,
): PerSeat<T> {
  return seat === 0 ? [value, pair[1]] : [pair[0], value];
}
