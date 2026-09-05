import type { Card } from '../../engine';
import { isCourt, pipLayout, rankLabel, suitGlyph } from '../cards';

const SUIT_NAMES = {
  clubs: 'clubs',
  diamonds: 'diamonds',
  hearts: 'hearts',
  spades: 'spades',
} as const;

const RANK_NAMES: Record<number, string> = {
  1: 'ace',
  11: 'jack',
  12: 'queen',
  13: 'king',
};

export function cardName(card: Card): string {
  return `${RANK_NAMES[card.rank] ?? String(card.rank)} of ${SUIT_NAMES[card.suit]}`;
}

type Props = {
  card: Card;
  /** Renders as a button when given. */
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  /** Lifted with a glow: part of the Combination being counted out. */
  lit?: boolean;
};

export function CardView({ card, onClick, disabled, selected, lit }: Props) {
  const red = card.suit === 'hearts' || card.suit === 'diamonds';
  const className = [
    'card',
    red ? 'card-red' : 'card-black',
    selected === true ? 'card-selected' : '',
    lit === true ? 'card-lit' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const face = <CardFace card={card} />;
  if (onClick === undefined) {
    return (
      <span className={className} aria-label={cardName(card)} role="img">
        {face}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={className}
      aria-label={cardName(card)}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      {face}
    </button>
  );
}

/**
 * The printed face: an index in two corners, and either the pips of a number
 * card or the framed letter of a court card. Drawn with text only, so it is
 * hidden from assistive technology in favour of the card's name.
 */
function CardFace({ card }: { card: Card }) {
  const rank = rankLabel(card.rank);
  const suit = suitGlyph(card.suit);
  return (
    <>
      <CardIndex rank={rank} suit={suit} />
      {isCourt(card.rank) ? (
        <span className="card-court" aria-hidden="true">
          <span className="card-court-letter">{rank}</span>
          <span className="card-court-suit">{suit}</span>
        </span>
      ) : (
        <span
          className={`card-pips${card.rank === 1 ? ' card-pips-ace' : ''}`}
          aria-hidden="true"
        >
          {pipLayout(card.rank).map((pip) => (
            <span
              key={`${pip.column}-${String(pip.row)}`}
              className={`card-pip card-pip-${pip.column}${pip.inverted ? ' card-pip-inverted' : ''}`}
              style={{ top: `${String(pip.row * 100)}%` }}
            >
              {suit}
            </span>
          ))}
        </span>
      )}
      <CardIndex rank={rank} suit={suit} bottom />
    </>
  );
}

/** Rank over suit in a corner; the bottom one is turned like a real card. */
function CardIndex({
  rank,
  suit,
  bottom = false,
}: {
  rank: string;
  suit: string;
  bottom?: boolean;
}) {
  return (
    <span
      className={bottom ? 'card-index card-index-bottom' : 'card-index'}
      aria-hidden="true"
    >
      <span>{rank}</span>
      <span>{suit}</span>
    </span>
  );
}

export function CardBack() {
  return <span className="card card-back" aria-hidden="true" />;
}
