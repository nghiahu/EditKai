import { describe, expect, it } from 'vitest';
import { legibleShadow } from '../../remotion/components/caption/legibility';

describe('legibleShadow', () => {
  it('draws a dark ring of 8 hard shadows plus a soft one, so light text stays readable on a light picture', () => {
    const parts = legibleShadow(3).split(/,\s*(?![^(]*\))/);
    expect(parts).toHaveLength(9);
    const offsets = parts.slice(0, 8).map(p => p.trim().split(/\s+/).slice(0, 2).join(' '));
    expect(new Set(offsets).size).toBe(8);
    expect(parts[0]).toMatch(/rgba\(0, ?0, ?0/);
  });
  it('the ring grows with the width', () => {
    expect(legibleShadow(6)).toContain('6px');
    expect(legibleShadow(2)).not.toContain('6px');
  });
});
