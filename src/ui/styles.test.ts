import { describe, expect, it } from 'vitest';
import css from './styles.css?raw';

const COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;

describe('the stylesheet', () => {
  it('keeps every colour in a token, so dark mode can redefine them all', () => {
    const strays = css
      .split('\n')
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => COLOUR.test(line) && !line.trim().startsWith('--'));
    expect(strays).toEqual([]);
  });

  it('redefines the table under the dark scheme but leaves card faces alone', () => {
    const block =
      /@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n\}/.exec(css)?.[0] ??
      '';
    expect(block).toContain('--felt:');
    expect(block).toContain('--wood:');
    expect(block).not.toContain('--paper:');
    expect(block).not.toContain('--ink:');
    expect(block).not.toContain('--red:');
  });
});
