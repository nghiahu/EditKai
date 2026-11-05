import { describe, expect, it } from 'vitest';
import { calloutProblem, resolveCallout } from '../../src/plan/insertTypes';
import { LAYER_TYPES } from '../../src/plan/layerTypes';

describe('callout props', () => {
  const ok = { kind: 'ring', x: 0.4, y: 0.6 };
  it('a ring or an arrow with a point in the frame is valid; everything else about it is optional', () => {
    expect(calloutProblem(ok)).toBeUndefined();
    expect(calloutProblem({ kind: 'arrow', x: 0, y: 1, size: 0.3, angle: 90, label: 'Bấm vào đây', color: 'white' })).toBeUndefined();
  });
  it('names what is wrong: kind, the point, the size, the angle, the label, the colour', () => {
    expect(calloutProblem({ x: 0.5, y: 0.5 })).toMatch(/kind/);
    expect(calloutProblem({ kind: 'square', x: 0.5, y: 0.5 })).toMatch(/kind/);
    expect(calloutProblem({ kind: 'ring', y: 0.5 })).toMatch(/props\.x/);
    expect(calloutProblem({ kind: 'ring', x: 1.2, y: 0.5 })).toMatch(/props\.x/);
    expect(calloutProblem({ kind: 'ring', x: 0.5, y: -0.1 })).toMatch(/props\.y/);
    expect(calloutProblem({ ...ok, size: 0.01 })).toMatch(/size/);
    expect(calloutProblem({ ...ok, size: 0.9 })).toMatch(/size/);
    expect(calloutProblem({ ...ok, angle: 'xéo' })).toMatch(/angle/);
    expect(calloutProblem({ ...ok, label: '' })).toMatch(/label/);
    expect(calloutProblem({ ...ok, label: 'x'.repeat(25) })).toMatch(/label/);
    expect(calloutProblem({ ...ok, color: 'red' })).toMatch(/color/);
  });
  it('resolveCallout fills the defaults and never throws', () => {
    expect(resolveCallout(ok)).toEqual({ kind: 'ring', x: 0.4, y: 0.6, size: 0.18, angle: 225, color: 'accent' });
    expect(resolveCallout({ kind: 'arrow', x: 0.1, y: 0.2, label: 'A' })).toMatchObject({ kind: 'arrow', label: 'A' });
    expect(() => resolveCallout(undefined)).not.toThrow();
    expect(resolveCallout({ kind: 'ring', x: 9, y: 'a' })).toMatchObject({ kind: 'ring', x: 0.5, y: 0.5 });
  });
  it('is a graphic layer type, checked by the same function', () => {
    expect(LAYER_TYPES.callout.track).toBe('graphic');
    expect(LAYER_TYPES.callout.check(ok)).toBeUndefined();
    expect(LAYER_TYPES.callout.check({ kind: 'ring' })).toMatch(/props\.x/);
  });
});
