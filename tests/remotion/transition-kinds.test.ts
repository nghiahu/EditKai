import { describe, expect, it } from 'vitest';
import { transitionStyle } from '../../remotion/transition';
import type { Layer } from '../../src/plan/types';

const tr = (kind: string): Layer => ({ id: 't', track: 'graphic', type: 'transition', start: 10, end: 10.4, props: { kind } });
const at = (kind: string, t: number) => transitionStyle([tr(kind)], t);
const shift = (t: number) => Math.abs(Number(/translateX\((-?[\d.]+)px\)/.exec(String(at('whip', t).transform))?.[1] ?? 0));

describe('transitionStyle whip and dip', () => {
  it('whip throws the picture sideways and smears it, most at the middle of the layer, and nothing outside it', () => {
    const mid = at('whip', 10.2);
    expect(shift(10.2)).toBeGreaterThan(100);
    expect(String(mid.filter)).toMatch(/blur\(/);
    expect(at('whip', 9.9)).toEqual({});
    expect(at('whip', 10.4)).toEqual({});
    expect(shift(10.2)).toBeGreaterThan(shift(10.05));
  });
  it('dip goes nearly black at the middle and is back to normal at the ends', () => {
    const b = (t: number) => Number(/brightness\(([\d.]+)\)/.exec(String(at('dip', t).filter))?.[1] ?? 1);
    expect(b(10.2)).toBeLessThan(0.25);
    expect(b(10.02)).toBeGreaterThan(0.85);
    expect(at('dip', 9.9)).toEqual({});
  });
  it('the old kinds are unchanged', () => {
    expect(String(at('zoom', 10.2).transform)).toMatch(/scale\(1\.1/);
    expect(String(at('blur', 10.2).filter)).toMatch(/blur\(1[34]/);
  });
});
