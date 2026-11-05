import { describe, expect, it } from 'vitest';
import { LAYER_TYPES } from '../../src/plan/layerTypes';
import { MAX_DATA_BYTES, customBox, customProblem } from '../../src/plan/custom';

const ok = { component: 'hat-bay', data: { n: 3 }, anchor: 'center', w: 0.5, h: 0.3 };

describe('customProblem', () => {
  it('a name only, a name with data, and a name with a box are valid', () => {
    expect(customProblem({ component: 'hat' })).toBeUndefined();
    expect(customProblem({ component: 'bieu-do-2', data: { a: [1, 2], b: 'x' } })).toBeUndefined();
    expect(customProblem(ok)).toBeUndefined();
  });
  it('the name is required and is lower case letters, digits and single hyphens, up to 40 characters', () => {
    expect(customProblem({})).toMatch(/^props\.component/);
    for (const bad of ['', 'Hat', 'hat_bay', '-hat', 'hat-', 'hat--bay', 'a/b', '../x', 'hạt', 'x'.repeat(41), 7]) expect(customProblem({ component: bad }), String(bad)).toMatch(/^props\.component/);
    expect(customProblem({ component: 'x'.repeat(40) })).toBeUndefined();
  });
  it('data must be a plain object and at most 8 KB of JSON', () => {
    for (const bad of [[1], 'x', 3, null]) expect(customProblem({ component: 'a', data: bad })).toMatch(/^props\.data/);
    expect(customProblem({ component: 'a', data: { s: 'x'.repeat(MAX_DATA_BYTES) } })).toMatch(/^props\.data.*8 KB/);
  });
  it('w and h come together, between 0.05 and 1; anchor and offset as in a scene', () => {
    expect(customProblem({ component: 'a', w: 0.5 })).toMatch(/^props\.h/);
    expect(customProblem({ component: 'a', h: 0.5 })).toMatch(/^props\.w/);
    expect(customProblem({ component: 'a', w: 0.01, h: 0.5 })).toMatch(/^props\.w/);
    expect(customProblem({ component: 'a', w: 0.5, h: 1.2 })).toMatch(/^props\.h/);
    expect(customProblem({ component: 'a', anchor: 'middle' })).toMatch(/^props\.anchor/);
    expect(customProblem({ component: 'a', offset: { x: 0.9 } })).toMatch(/^props\.offset\.x/);
    expect(customProblem({ component: 'a', offset: 3 })).toMatch(/^props\.offset/);
  });
});

describe('customBox and the layer type', () => {
  it('has a box only when w and h are given, and it is the scene box', () => {
    expect(customBox({ component: 'a' }, { top: 0.1, bottom: 0.2, left: 0.05, right: 0.05 })).toBeUndefined();
    const b = customBox({ component: 'a', anchor: 'bottom', w: 0.5, h: 0.2, offset: { y: -0.1 } }, { top: 0.1, bottom: 0.2, left: 0.05, right: 0.05 })!;
    expect(b.x).toBeCloseTo(0.25);
    expect(b.y).toBeCloseTo(1 - 0.2 - 0.2 - 0.1);
  });
  it('custom is a graphic-track type checked by customProblem', () => {
    expect(LAYER_TYPES.custom.track).toBe('graphic');
    expect(LAYER_TYPES.custom.check({})).toMatch(/^props\.component/);
    expect(LAYER_TYPES.custom.check({ component: 'a' })).toBeUndefined();
  });
});
