import { useEffect, useRef } from 'react';
import type { GameEvent, Seat } from '../../engine';
import { describeEvent } from '../log';

type Props = { events: readonly GameEvent[]; human: Seat };

export function Log({ events, human }: Props) {
  const lines = events.flatMap((e) => {
    const line = describeEvent(e, human);
    return line === null ? [] : [line];
  });
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    // Keep the newest line in view as the Game goes on.
    const el = box.current;
    if (el !== null) el.scrollTop = el.scrollHeight;
  }, [lines.length]);
  return (
    <section className="log" aria-label="Log" ref={box}>
      <h2>Log</h2>
      <ol aria-live="polite">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
    </section>
  );
}
