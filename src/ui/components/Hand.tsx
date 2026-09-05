import { useState } from 'react';
import { sameCard, type Card } from '../../engine';
import { CardBack, CardView } from './CardView';

type DiscardProps = {
  cards: readonly Card[];
  enabled: boolean;
  onDiscard: (cards: readonly [Card, Card]) => void;
};

/** Six cards; tap two, then send them to the Crib. */
export function DiscardHand({ cards, enabled, onDiscard }: DiscardProps) {
  const [selected, setSelected] = useState<readonly Card[]>([]);
  const toggle = (card: Card) => {
    setSelected((current) =>
      current.some((c) => sameCard(c, card))
        ? current.filter((c) => !sameCard(c, card))
        : current.length < 2
          ? [...current, card]
          : current,
    );
  };
  const [a, b] = selected;
  const ready = enabled && a !== undefined && b !== undefined;
  return (
    <div className="hand">
      <div className="cards">
        {cards.map((card) => (
          <CardView
            key={key(card)}
            card={card}
            selected={selected.some((c) => sameCard(c, card))}
            disabled={!enabled}
            onClick={() => {
              toggle(card);
            }}
          />
        ))}
      </div>
      <button
        type="button"
        className="action"
        disabled={!ready}
        onClick={() => {
          if (a !== undefined && b !== undefined) {
            onDiscard([a, b]);
            setSelected([]);
          }
        }}
      >
        Send to crib
      </button>
    </div>
  );
}

type PeggingProps = {
  cards: readonly Card[];
  /** Which cards may be played right now; empty when it is not your turn. */
  legal: readonly Card[];
  onPlay: (card: Card) => void;
};

/** Your remaining cards; one tap plays, illegal cards are greyed out. */
export function PeggingHand({ cards, legal, onPlay }: PeggingProps) {
  return (
    <div className="hand">
      <div className="cards">
        {cards.map((card) => (
          <CardView
            key={key(card)}
            card={card}
            disabled={!legal.some((c) => sameCard(c, card))}
            onClick={() => {
              onPlay(card);
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function ShownHand({ cards }: { cards: readonly Card[] }) {
  return (
    <div className="hand">
      <div className="cards">
        {cards.map((card) => (
          <CardView key={key(card)} card={card} />
        ))}
      </div>
    </div>
  );
}

export function HiddenHand({ size }: { size: number }) {
  return (
    <div className="hand">
      <div className="cards">
        {Array.from({ length: size }, (_, i) => (
          <CardBack key={i} />
        ))}
      </div>
    </div>
  );
}

function key(card: Card): string {
  return `${String(card.rank)}-${card.suit}`;
}
