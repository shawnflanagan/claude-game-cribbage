import {
  otherSeat,
  sameCard,
  type Action,
  type Card,
  type Seat,
  type Tally,
} from '../../engine';
import { cardKey } from '../cards';
import { combinations, describeCut, seatName } from '../log';
import type { GameRecord } from '../record';
import type { LastTally, Pause, TableModel } from '../session';
import { chipLabel, countingOrder, showPhrase } from '../show';
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
  record: GameRecord;
  onResetRecord: () => void;
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
  record,
  onResetRecord,
}: Props) {
  const computer = otherSeat(human);
  const who = (seat: Seat) => seatName(seat, human);
  const showing = model.stage === 'show' || model.stage === 'over';
  const computerShown = model.shows.some(
    (s) => s.seat === computer && s.source === 'hand',
  );
  const latestShow = model.shows.at(-1);
  const lit =
    latestShow === undefined ? [] : litCards(latestShow.tally, model.counted);
  const isLit = (card: Card) => lit.some((c) => sameCard(c, card));
  const phraseFor = (seat: Seat, source: 'hand' | 'crib') =>
    latestShow?.seat === seat &&
    latestShow.source === source && (
      <p className="phrase" aria-live="polite">
        {showPhrase(latestShow.tally, model.counted)}
      </p>
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
          <>
            <ShownHand cards={model.kept[computer]} lit={lit} />
            {phraseFor(computer, 'hand')}
          </>
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
          <GameOver
            result={model.result}
            human={human}
            record={record}
            onNewGame={onNewGame}
            onResetRecord={onResetRecord}
          />
        )}
        {model.stage === 'cutting' && model.cuts !== null && (
          <div className="cut" aria-label="Cut for deal">
            <span>You</span>
            <CardView card={model.cuts[human]} />
            <span>Computer</span>
            <CardView card={model.cuts[computer]} />
          </div>
        )}
        {model.stage !== 'cutting' && (
          <div className="centre">
            <div className="deck-area">
              <span className="label">Starter</span>
              {model.starter === null ? (
                <CardBack slot="deck" />
              ) : (
                <CardView card={model.starter} lit={isLit(model.starter)} />
              )}
            </div>
            <div className="crib-area">
              <span className="label">Crib</span>
              <div className="cards">
                {model.crib !== null ? (
                  model.crib.map((c) => (
                    <CardView key={cardKey(c)} card={c} lit={isLit(c)} />
                  ))
                ) : (
                  <>
                    {model.discards[human].map((c) => (
                      <CardBack key={cardKey(c)} of={c} />
                    ))}
                    {model.discards[computer].map((_, i) => (
                      <CardBack key={i} slot={`crib-${String(i)}`} />
                    ))}
                  </>
                )}
              </div>
              {model.dealer !== null && phraseFor(model.dealer, 'crib')}
            </div>
          </div>
        )}
        {model.stage === 'pegging' && <PlayRows model={model} human={human} />}
        <p className="status" role="status">
          {statusLine(model, human, humanToAct, who)}
        </p>
        {model.lastTally !== null && model.lastTally.source === 'heels' && (
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
        {model.stage === 'discarding' && model.discards[human].length === 0 ? (
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
          <>
            <ShownHand
              cards={showing ? model.kept[human] : model.hands[human]}
              lit={lit}
            />
            {phraseFor(human, 'hand')}
          </>
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
      return model.cuts === null
        ? 'Cutting for the deal.'
        : describeCut(model.cuts, model.dealer, human);
    case 'discarding':
      if (model.discards.every((d) => d.length > 0))
        return 'Cutting the Starter.';
      if (model.discards[human].length > 0)
        return 'Waiting for the Computer to discard.';
      return humanToAct ? 'Choose your Discard for the Crib.' : 'Dealing.';
    case 'pegging':
      return humanToAct ? 'Your play.' : 'Computer is thinking.';
    case 'show': {
      const last = model.shows.at(-1);
      if (last === undefined) return 'The Show.';
      const what = last.source === 'crib' ? 'the Crib' : 'the Hand';
      const counts = `${who(last.seat)} ${last.seat === human ? 'count' : 'counts'} ${what}`;
      return model.counted < last.tally.combinations.length
        ? `${counts}.`
        : `${counts} for ${String(last.tally.total)}.`;
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
        aria-label={`${String(pile.length)} played earlier`}
        style={{ gridRow: row, gridColumn: 1 }}
      >
        {pile.map((card) => (
          <CardBack key={cardKey(card)} of={card} />
        ))}
        {pile.length > 0 && (
          <span className="pile-count" aria-hidden="true">
            {pile.length}
          </span>
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
            {i === model.sequence.length - 1 && (
              <Chips tally={model.lastTally} />
            )}
          </span>
        ) : null,
      )}
    </div>
  );
}

/** Why the pegs just moved: one chip per Combination of the latest play. */
function Chips({ tally }: { tally: LastTally | null }) {
  if (tally?.source !== 'pegging') return null;
  return (
    <span className="chips">
      {tally.tally.combinations.map((c, i) => (
        <span key={i} className="chip">
          {chipLabel(c)}
        </span>
      ))}
    </span>
  );
}

/** The cards of the Combination being counted out right now. */
function litCards(tally: Tally, counted: number): readonly Card[] {
  return countingOrder(tally)[counted - 1]?.cards ?? [];
}
