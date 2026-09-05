import { otherSeat, type Action, type Card, type Seat } from '../../engine';
import { cardKey } from '../cards';
import { combinations, seatName } from '../log';
import type { Pause, TableModel } from '../session';
import { CardBack, CardView } from './CardView';
import { GameOver } from './GameOver';
import { DiscardHand, HiddenHand, PeggingHand, ShownHand } from './Hand';

type Props = {
  model: TableModel;
  human: Seat;
  /** The human's legal Pegging cards right now; empty unless it is their turn. */
  legal: readonly Card[];
  humanToAct: boolean;
  pause: Pause;
  onAct: (action: Action) => void;
  onContinue: () => void;
  onNewGame: () => void;
};

export function Table({
  model,
  human,
  legal,
  humanToAct,
  pause,
  onAct,
  onContinue,
  onNewGame,
}: Props) {
  const computer = otherSeat(human);
  const who = (seat: Seat) => seatName(seat, human);
  const showing = model.stage === 'show' || model.stage === 'over';
  const computerShown = model.shows.some(
    (s) => s.seat === computer && s.source === 'hand',
  );
  return (
    <main className="table">
      <section className="seat seat-computer" aria-label="Computer">
        <header>
          <span className="name">Computer</span>
          {model.dealer === computer && <span className="badge">Dealer</span>}
          {model.saidGo === computer && <span className="badge">Go</span>}
        </header>
        {computerShown ? (
          <ShownHand cards={model.kept[computer]} />
        ) : (
          <HiddenHand
            size={
              showing
                ? model.kept[computer].length
                : model.hands[computer].length
            }
          />
        )}
      </section>

      <section className="middle">
        {model.stage === 'over' && model.result !== null && (
          <GameOver result={model.result} human={human} onNewGame={onNewGame} />
        )}
        {model.stage === 'cutting' && model.cuts !== null && (
          <div className="cut" aria-label="Cut for deal">
            <span>You cut</span>
            <CardView card={model.cuts[human]} />
            <span>Computer cuts</span>
            <CardView card={model.cuts[computer]} />
          </div>
        )}
        {model.stage !== 'cutting' && (
          <div className="centre">
            <div className="deck-area">
              <span className="label">Starter</span>
              {model.starter === null ? (
                <CardBack />
              ) : (
                <CardView card={model.starter} />
              )}
            </div>
            <div className="crib-area">
              <span className="label">Crib</span>
              <div className="cards">
                {model.crib !== null
                  ? model.crib.map((c) => (
                      <CardView key={cardKey(c)} card={c} />
                    ))
                  : Array.from({ length: model.cribSize }, (_, i) => (
                      <CardBack key={i} />
                    ))}
              </div>
            </div>
          </div>
        )}
        {model.stage === 'pegging' && <PlayRows model={model} human={human} />}
        <p className="status" role="status">
          {statusLine(model, human, humanToAct, who)}
        </p>
        {model.lastTally !== null && (
          <p className="scoring">
            {who(model.lastTally.seat)}: {combinations(model.lastTally.tally)}
          </p>
        )}
        {pause.kind === 'continue' && (
          <button type="button" className="action" onClick={onContinue}>
            Continue
          </button>
        )}
      </section>

      <section className="seat seat-human" aria-label="You">
        <header>
          <span className="name">You</span>
          {model.dealer === human && <span className="badge">Dealer</span>}
          {model.saidGo === human && <span className="badge">Go</span>}
        </header>
        {model.stage === 'discarding' && !model.discarded[human] ? (
          <DiscardHand
            cards={model.hands[human]}
            enabled={humanToAct}
            onDiscard={(cards) => {
              onAct({ type: 'discard', seat: human, cards });
            }}
          />
        ) : model.stage === 'pegging' ? (
          <PeggingHand
            cards={model.hands[human]}
            legal={humanToAct ? legal : []}
            onPlay={(card) => {
              onAct({ type: 'play', seat: human, card });
            }}
          />
        ) : (
          <ShownHand cards={showing ? model.kept[human] : model.hands[human]} />
        )}
      </section>
    </main>
  );
}

function statusLine(
  model: TableModel,
  human: Seat,
  humanToAct: boolean,
  who: (seat: Seat) => string,
): string {
  switch (model.stage) {
    case 'cutting':
      return 'Cutting for the deal.';
    case 'discarding':
      if (model.discarded.every(Boolean)) return 'Cutting the Starter.';
      if (model.discarded[human]) return 'Waiting for the Computer to discard.';
      return humanToAct ? 'Choose your Discard for the Crib.' : 'Dealing.';
    case 'pegging':
      return humanToAct ? 'Your play.' : 'Computer is thinking.';
    case 'show': {
      const last = model.shows.at(-1);
      if (last === undefined) return 'The Show.';
      const what = last.source === 'crib' ? 'the Crib' : 'the Hand';
      return `${who(last.seat)} ${last.seat === human ? 'count' : 'counts'} ${what} for ${String(last.tally.total)}.`;
    }
    case 'over':
      return 'Game over.';
  }
}

/**
 * Pegging as two rows, one per Seat, so who played what is never in doubt.
 * Cards keep their play order left to right across both rows; the Count sits
 * between them; each Seat's earlier sequences lie face down beside its row.
 */
function PlayRows({ model, human }: { model: TableModel; human: Seat }) {
  const computer = otherSeat(human);
  const columns = Math.max(model.sequence.length, 1);
  return (
    <div
      className="play-rows"
      role="group"
      aria-label="Pegging"
      style={{
        gridTemplateColumns: `var(--card-w) repeat(${String(columns)}, var(--card-w))`,
      }}
    >
      <PlayRow seat={computer} human={human} row={1} model={model} />
      <div className="count" style={{ gridRow: 2, gridColumn: '1 / -1' }}>
        Count <strong>{model.count}</strong>
      </div>
      <PlayRow seat={human} human={human} row={3} model={model} />
    </div>
  );
}

type PlayRowProps = {
  seat: Seat;
  human: Seat;
  /** The grid row this Seat's cards occupy. */
  row: number;
  model: TableModel;
};

function PlayRow({ seat, human, row, model }: PlayRowProps) {
  const mine = seat === human;
  const pile = model.playedPile[seat];
  return (
    <div
      className={`play-row play-row-${mine ? 'human' : 'computer'}`}
      role="group"
      aria-label={mine ? 'Your played cards' : "Computer's played cards"}
    >
      <span
        className="play-row-tint"
        aria-hidden="true"
        style={{ gridRow: row, gridColumn: '1 / -1' }}
      />
      <span
        className="played-pile"
        role="img"
        aria-label={`${String(pile)} played earlier`}
        style={{ gridRow: row, gridColumn: 1 }}
      >
        {pile > 0 && (
          <>
            <CardBack />
            <span className="pile-count" aria-hidden="true">
              {pile}
            </span>
          </>
        )}
      </span>
      {model.sequence.map((played, i) =>
        played.seat === seat ? (
          <span
            key={cardKey(played.card)}
            className="play-slot"
            style={{ gridRow: row, gridColumn: i + 2 }}
          >
            <CardView card={played.card} />
          </span>
        ) : null,
      )}
    </div>
  );
}
