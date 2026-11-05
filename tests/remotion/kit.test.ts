import { describe, expect, it } from 'vitest';
import * as kit from '../../remotion/kit';

describe('@kit (what a project component may import from the skill)', () => {
  it('offers the documented helpers and nothing is undefined', () => {
    for (const k of ['easeValue', 'valueAt', 'pop', 'enterExit', 'breathe', 'drawProgress', 'clamp01', 'Icon', 'assetUrl']) expect(kit, k).toHaveProperty(k);
    for (const [k, v] of Object.entries(kit)) expect(v, k).toBeDefined();
  });
  it('the helpers work: easing reaches 1, assetUrl joins the base and the path', () => {
    expect(kit.easeValue(1, 'out')).toBe(1);
    expect(kit.clamp01(3)).toBe(1);
    expect(kit.assetUrl('http://x', 'assets/a.png')).toContain('assets/a.png');
  });
});
