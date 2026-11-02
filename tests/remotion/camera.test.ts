import { describe, it, expect } from 'vitest';
import { cameraStyle } from '../../remotion/camera';
import { loadTheme } from '../../src/style/theme';
import type { Layer } from '../../src/plan/types';

const s1 = loadTheme('styles/s1').motion;
const m1 = loadTheme('styles/m1').motion;
const punch = (props: Record<string, unknown> = {}, start = 2, end = 3): Layer => ({ id: 'z', track: 'camera', type: 'zoom-punch', start, end, props });
const shake = (intensity?: number, start = 2, end = 3): Layer => ({ id: 'k', track: 'camera', type: 'shake', start, end, props: intensity === undefined ? {} : { intensity } });
const scaleOf = (s: { transform?: string | number }) => Number(/scale\(([\d.]+)\)/.exec(String(s.transform))?.[1]);
const shift = (s: { transform?: string | number }) => { const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(String(s.transform)); return m ? Math.hypot(Number(m[1]), Number(m[2])) : 0; };

describe('cameraStyle', () => {
  it('is empty outside a layer and exactly at its end', () => {
    expect(cameraStyle([punch()], 1.9, s1)).toEqual({});
    expect(cameraStyle([punch()], 3, s1)).toEqual({});
    expect(cameraStyle([], 2.5, s1)).toEqual({});
  });
  it('zoom-punch peaks in the middle with the theme punchScale', () => {
    expect(Math.abs(scaleOf(cameraStyle([punch()], 2.5, s1)) - 1.06)).toBeLessThan(0.001);
    expect(Math.abs(scaleOf(cameraStyle([punch()], 2.5, m1)) - 1.12)).toBeLessThan(0.001);
  });
  it('zoom-punch eases in: 12.5% into the layer it is below the linear value of 0.25', () => {
    const s = scaleOf(cameraStyle([punch()], 2.125, m1));
    expect(s).toBeLessThan(1 + 0.12 * 0.25);
    expect(s).toBeGreaterThan(1);
  });
  it('uses an explicit scale and focus', () => {
    const s = cameraStyle([punch({ scale: 1.3, focus: { x: 0.3, y: 0.6 } })], 2.5, s1);
    expect(Math.abs(scaleOf(s) - 1.3)).toBeLessThan(0.001);
    expect(s.transformOrigin).toBe('30% 60%');
  });
  it('shake is deterministic and larger for intensity 3 than 1', () => {
    const a = cameraStyle([shake(1)], 2.3, s1), b = cameraStyle([shake(1)], 2.3, s1);
    expect(a).toEqual(b);
    expect(shift(cameraStyle([shake(3)], 2.5, s1))).toBeGreaterThan(shift(cameraStyle([shake(1)], 2.5, s1)));
    expect(shift(a)).toBeGreaterThan(0);
  });
  it('overlapping punch and shake combine into one transform string with both parts', () => {
    const t = String(cameraStyle([punch(), shake(2)], 2.5, s1).transform);
    expect(t).toMatch(/scale\(/);
    expect(t).toMatch(/translate\(/);
  });
  it('a layer that runs past the end of the video still gives finite numbers (Review Focus 3)', () => {
    const t = String(cameraStyle([punch({}, 40, 90)], 60, s1).transform);
    expect(t).not.toMatch(/NaN|Infinity/);
    expect(scaleOf(cameraStyle([punch({}, 40, 90)], 60, s1))).toBeGreaterThan(1);
  });
  it('an inverted or zero-length layer never produces NaN', () => {
    for (const l of [punch({}, 3, 3), punch({}, 3, 2)]) expect(JSON.stringify(cameraStyle([l], 3, s1))).not.toMatch(/NaN|Infinity/);
  });
});
