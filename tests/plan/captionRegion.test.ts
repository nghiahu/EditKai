import { describe, expect, it } from 'vitest';
import { captionBottomFraction, captionRegion } from '../../src/plan/captionRegion';

const m1 = { name: 'm1', limits: { safeZone: { top: 0.1, bottom: 0.2, left: 0.06, right: 0.06 } } };
const s1 = { name: 's1', limits: { safeZone: { top: 0.1, bottom: 0.2, left: 0.06, right: 0.06 } } };

describe('captionRegion', () => {
  it('the bottom caption sits at the offset the renderer uses (28% for m1, the safe zone for s1)', () => {
    expect(captionBottomFraction(m1)).toBe(0.28);
    expect(captionBottomFraction(s1)).toBe(0.2);
    const r = captionRegion('bottom', m1);
    expect(r.y + r.h).toBeCloseTo(1 - 0.28, 5);
  });
  it('spans the safe zone horizontally', () => {
    const r = captionRegion('bottom', s1);
    expect(r.x).toBeCloseTo(0.06, 5);
    expect(r.w).toBeCloseTo(0.88, 5);
  });
  it('top starts at the safe zone and center is around the middle; all stay inside the frame', () => {
    expect(captionRegion('top', m1).y).toBeCloseTo(0.1, 5);
    const c = captionRegion('center', m1);
    expect(c.y + c.h / 2).toBeCloseTo(0.5, 5);
    for (const p of ['top', 'center', 'bottom'] as const) {
      const r = captionRegion(p, m1);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y + r.h).toBeLessThanOrEqual(1);
    }
  });
});
