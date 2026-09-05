import { flushSync } from 'react-dom';

/**
 * What the browser offers for motion (ADR 0004). Passed explicitly so tests
 * can stand in for a browser with or without view transitions.
 */
export type Motion = {
  readonly startViewTransition: ((change: () => void) => void) | undefined;
  readonly reducedMotion: boolean;
};

/**
 * Applies a state update so that cards animate from where they were to where
 * they end up. The browser snapshots the page, the update is flushed to the
 * DOM, and every element with a view-transition-name moves to its new place.
 * Without the API, or when the person asked for reduced motion, the update
 * simply applies.
 */
export function withMotion(update: () => void, motion = browserMotion()): void {
  if (motion.startViewTransition === undefined || motion.reducedMotion) {
    update();
    return;
  }
  motion.startViewTransition(() => {
    flushSync(update);
  });
}

function browserMotion(): Motion {
  const doc = document as Partial<Document>;
  return {
    startViewTransition:
      typeof doc.startViewTransition === 'function'
        ? (change) => {
            document.startViewTransition(change);
          }
        : undefined,
    reducedMotion:
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}
