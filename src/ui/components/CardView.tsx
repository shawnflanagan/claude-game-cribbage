import type { Card } from '../../engine';
import { rankLabel, suitGlyph } from '../cards';

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
};

export function CardView({ card, onClick, disabled, selected }: Props) {
  const red = card.suit === 'hearts' || card.suit === 'diamonds';
  const className = [
    'card',
    red ? 'card-red' : 'card-black',
    selected === true ? 'card-selected' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const face = (
    <>
      <span className="card-rank">{rankLabel(card.rank)}</span>
      <span className="card-suit">{suitGlyph(card.suit)}</span>
    </>
  );
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

export function CardBack() {
  return <span className="card card-back" aria-hidden="true" />;
}
