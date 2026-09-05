import { describe, expect, it } from 'vitest';
import { withMotion } from './motion';

describe('motion', () => {
  it('applies the update at once where the browser has no view transitions', () => {
    let applied = 0;
    withMotion(
      () => {
        applied++;
      },
      { startViewTransition: undefined, reducedMotion: false },
    );
    expect(applied).toBe(1);
  });

  it('applies the update at once under reduced motion', () => {
    let applied = 0;
    let transitions = 0;
    withMotion(
      () => {
        applied++;
      },
      {
        startViewTransition: () => {
          transitions++;
        },
        reducedMotion: true,
      },
    );
    expect(applied).toBe(1);
    expect(transitions).toBe(0);
  });

  it('runs the update inside a view transition when one is available', () => {
    const order: string[] = [];
    withMotion(
      () => {
        order.push('update');
      },
      {
        startViewTransition: (change) => {
          order.push('snapshot');
          change();
          order.push('animate');
        },
        reducedMotion: false,
      },
    );
    expect(order).toEqual(['snapshot', 'update', 'animate']);
  });
});
