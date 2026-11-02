import { describe, it, expect } from 'vitest';
import { loadTheme } from '../../src/style/theme';

describe('loadTheme', () => {
  it('loads s1', () => {
    const t = loadTheme('styles/s1');
    expect(t.name).toBe('s1');
    expect(t.colors.navy).toBe('#0B1530');
    expect(t.colors.teal).toBe('#2DE2D0');
    expect(t.colors.orange).toBe('#FF9A3C');
    expect(t.limits.maxCaptionWords).toBe(8);
    expect(t.limits.minSceneSec).toBe(1.5);
  });
  it('loads m1', () => {
    const t = loadTheme('styles/m1');
    expect(t.name).toBe('m1');
    expect(t.colors.black).toBe('#0A0A0A');
    expect(t.colors.yellow).toBe('#FFD93D');
    expect(t.limits.maxCaptionWords).toBe(4);
    expect(t.limits.minSceneSec).toBe(1.0);
    expect(t.limits.safeZone).toEqual({ top: 0.08, bottom: 0.18, left: 0.06, right: 0.06 });
  });
  it('throws a clear error for a missing style', () => {
    expect(() => loadTheme('styles/nope')).toThrow(/styles\/nope/);
  });
});
