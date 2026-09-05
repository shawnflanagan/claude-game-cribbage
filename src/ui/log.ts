import type {
  Card,
  Combination,
  GameEvent,
  GameResult,
  Seat,
  Tally,
} from '../engine';
import { otherSeat } from '../engine';
import { formatCard } from './cards';

export function seatName(seat: Seat, human: Seat): string {
  return seat === human ? 'You' : 'Computer';
}

/** "You count" but "Computer counts". */
function verb(seat: Seat, human: Seat, base: string): string {
  return seat === human ? base : `${base}s`;
}

export function describeSkunk(result: GameResult): string | null {
  switch (result.skunk) {
    case 'double-skunk':
      return 'A Double Skunk!';
    case 'skunk':
      return 'A Skunk!';
    case 'none':
      return null;
  }
}

/** The Log in glossary words. Returns null for Events not worth a line. */
export function describeEvent(event: GameEvent, human: Seat): string | null {
  const who = (seat: Seat) => seatName(seat, human);
  const does = (seat: Seat, base: string) => verb(seat, human, base);
  switch (event.type) {
    case 'cut-for-deal': {
      const [a, b] = event.cuts;
      const cut = `${who(0)} ${does(0, 'cut')} ${formatCard(a)}, ${who(1)} ${does(1, 'cut')} ${formatCard(b)}.`;
      return event.dealer === null
        ? `${cut} A tie, cut again.`
        : `${cut} ${who(event.dealer)} ${does(event.dealer, 'deal')}.`;
    }
    case 'dealt':
      return `Round ${String(event.round)}. ${who(event.dealer)} ${does(event.dealer, 'deal')}.`;
    case 'discarded':
      return event.seat === human
        ? `You send ${cards(event.cards)} to the Crib.`
        : 'Computer sends a Discard to the Crib.';
    case 'starter-cut':
      return `The Starter is ${formatCard(event.card)}.`;
    case 'heels':
      return `${who(event.seat)} ${does(event.seat, 'score')} ${combinations(event.tally)}.`;
    case 'card-played':
      return `${who(event.seat)} ${does(event.seat, 'play')} ${formatCard(event.card)} for ${String(event.count)}.`;
    case 'tally':
      return `${who(event.seat)} ${does(event.seat, 'score')} ${combinations(event.tally)}.`;
    case 'go':
      return `${who(event.seat)} ${does(event.seat, 'say')} Go.`;
    case 'show-counted': {
      const what = event.source === 'crib' ? 'the Crib ' : '';
      const total =
        event.tally.total === 0
          ? 'for nothing'
          : `for ${String(event.tally.total)}: ${combinations(event.tally)}`;
      return `Show: ${who(event.seat)} ${does(event.seat, 'count')} ${what}${cards(event.cards)} ${total}.`;
    }
    case 'game-won': {
      const { winner, scores } = event.result;
      const line = `${who(winner)} ${does(winner, 'win')} ${String(scores[winner])} to ${String(scores[otherSeat(winner)])}.`;
      const skunk = describeSkunk(event.result);
      return skunk === null ? line : `${line} ${skunk}`;
    }
    case 'scored':
    case 'sequence-ended':
    case 'pegging-ended':
    case 'round-ended':
      return null;
  }
}

function cards(list: readonly Card[]): string {
  return list.map(formatCard).join(' ');
}

/** "Fifteen for 2 and a Run of 3 for 3" */
export function combinations(tally: Tally): string {
  const parts = tally.combinations.map(describeCombination);
  if (parts.length === 0) return 'nothing';
  if (parts.length === 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1) ?? ''}`;
}

export function describeCombination(c: Combination): string {
  const points = `for ${String(c.points)}`;
  switch (c.kind) {
    case 'fifteen':
      return `Fifteen ${points}`;
    case 'pair':
      return `a Pair ${points}`;
    case 'pair-royal':
      return `a Pair Royal ${points}`;
    case 'double-pair-royal':
      return `a Double Pair Royal ${points}`;
    case 'run':
      return `a Run of ${String(c.cards.length)} ${points}`;
    case 'flush':
      return `a Flush ${points}`;
    case 'nobs':
      return `Nobs ${points}`;
    case 'thirty-one':
      return `Thirty-One ${points}`;
    case 'last-card':
      return `Last Card ${points}`;
    case 'heels':
      return `Heels ${points}`;
  }
}
