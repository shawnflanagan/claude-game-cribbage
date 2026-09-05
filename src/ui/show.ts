import type { Combination, CombinationKind, Tally } from '../engine';

// The order a player counts a Hand out loud: fifteens first, then the pair
// family, runs, a flush, and Nobs always last. Pegging kinds never appear.
const SPOKEN_ORDER: readonly CombinationKind[] = [
  'fifteen',
  'pair',
  'pair-royal',
  'double-pair-royal',
  'run',
  'flush',
  'nobs',
];

/** The Combinations of a Show Tally in the order they are counted out. */
export function countingOrder(tally: Tally): readonly Combination[] {
  return [...tally.combinations].sort(
    (a, b) => SPOKEN_ORDER.indexOf(a.kind) - SPOKEN_ORDER.indexOf(b.kind),
  );
}

/** The glossary name of a Combination: "Fifteen", "Pair Royal", "Run of 3". */
export function combinationName(c: Combination): string {
  switch (c.kind) {
    case 'fifteen':
      return 'Fifteen';
    case 'pair':
      return 'Pair';
    case 'pair-royal':
      return 'Pair Royal';
    case 'double-pair-royal':
      return 'Double Pair Royal';
    case 'run':
      return `Run of ${String(c.cards.length)}`;
    case 'flush':
      return 'Flush';
    case 'nobs':
      return 'Nobs';
    case 'thirty-one':
      return 'Thirty-One';
    case 'last-card':
      return 'Last Card';
    case 'heels':
      return 'Heels';
  }
}

/** Whether the name takes an article: "a Pair" but "Fifteen". */
export function takesArticle(c: Combination): boolean {
  return (
    c.kind === 'pair' ||
    c.kind === 'pair-royal' ||
    c.kind === 'double-pair-royal' ||
    c.kind === 'run' ||
    c.kind === 'flush'
  );
}

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty'];

/** Numbers as they are spoken at the table; a Hand never exceeds 29. */
export function numberWord(n: number): string {
  const small = ONES[n];
  if (small !== undefined) return small;
  const tens = TENS[Math.floor(n / 10)] ?? String(n);
  const rest = n % 10;
  return rest === 0 ? tens : `${tens}-${ONES[rest] ?? String(rest)}`;
}

/** How the Combination is spoken: "a pair royal", "a run of three". */
function spoken(c: Combination): string {
  const name =
    c.kind === 'run'
      ? `run of ${numberWord(c.cards.length)}`
      : combinationName(c).toLowerCase();
  return takesArticle(c) ? `a ${name}` : name;
}

/**
 * The running phrase after `counted` Combinations have been counted out:
 * "Fifteen two, fifteen four, and a pair is six, and one for his Nobs".
 * Empty before the first Combination; "No score" for a Hand worth nothing.
 */
export function showPhrase(tally: Tally, counted: number): string {
  const ordered = countingOrder(tally);
  if (ordered.length === 0) return 'No score';
  let running = 0;
  const parts: string[] = [];
  for (const c of ordered.slice(0, counted)) {
    running += c.points;
    const first = parts.length === 0;
    if (c.kind === 'fifteen') {
      parts.push(`fifteen ${numberWord(running)}`);
    } else if (c.kind === 'nobs') {
      parts.push(`${first ? '' : 'and '}one for his Nobs`);
    } else {
      parts.push(
        `${first ? '' : 'and '}${spoken(c)} is ${numberWord(running)}`,
      );
    }
  }
  const phrase = parts.join(', ');
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/** The short label on a Pegging chip: "Fifteen 2", "Run of 3", "Last Card 1". */
export function chipLabel(c: Combination): string {
  return c.kind === 'run'
    ? combinationName(c)
    : `${combinationName(c)} ${String(c.points)}`;
}
