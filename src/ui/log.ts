import {
  formatCard,
  type Card,
  type Combination,
  type GameEvent,
  type Seat,
  type Tally,
} from '../engine';

/** The Log in glossary words. Returns null for Events not worth a line. */
export function describeEvent(event: GameEvent, human: Seat): string | null {
  const who = (seat: Seat) => (seat === human ? 'You' : 'Computer');
  const verb = (seat: Seat, base: string) =>
    seat === human ? base : `${base}s`;
  switch (event.type) {
    case 'cut-for-deal': {
      const [a, b] = event.cuts;
      const cut = `${who(0)} ${verb(0, 'cut')} ${formatCard(a)}, ${who(1)} ${verb(1, 'cut')} ${formatCard(b)}.`;
      return event.dealer === null
        ? `${cut} A tie, cut again.`
        : `${cut} ${who(event.dealer)} ${verb(event.dealer, 'deal')}.`;
    }
    case 'dealt':
      return `Round ${String(event.round)}. ${who(event.dealer)} ${verb(event.dealer, 'deal')}.`;
    case 'discarded':
      return event.seat === human
        ? `You send ${cards(event.cards)} to the Crib.`
        : 'Computer sends two cards to the Crib.';
    case 'starter-cut':
      return `The Starter is ${formatCard(event.card)}.`;
    case 'heels':
      return `${who(event.seat)} ${verb(event.seat, 'score')} Heels for 2.`;
    case 'card-played':
      return `${who(event.seat)} ${verb(event.seat, 'play')} ${formatCard(event.card)} for ${String(event.count)}.`;
    case 'tally':
      return `${who(event.seat)} ${verb(event.seat, 'score')} ${combinations(event.tally)}.`;
    case 'go':
      return `${who(event.seat)} ${verb(event.seat, 'say')} Go.`;
    case 'show-counted': {
      const what = event.source === 'crib' ? 'the Crib ' : '';
      const total =
        event.tally.total === 0
          ? 'for nothing'
          : `for ${String(event.tally.total)}: ${combinations(event.tally)}`;
      return `Show: ${who(event.seat)} ${verb(event.seat, 'count')} ${what}${cards(event.cards)} ${total}.`;
    }
    case 'game-won': {
      const { winner, scores, skunk } = event.result;
      const line = `${who(winner)} ${verb(winner, 'win')} ${String(scores[winner])} to ${String(scores[winner === 0 ? 1 : 0])}.`;
      if (skunk === 'double-skunk') return `${line} A Double Skunk!`;
      if (skunk === 'skunk') return `${line} A Skunk!`;
      return line;
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
