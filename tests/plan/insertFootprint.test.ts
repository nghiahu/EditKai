import { describe, expect, it } from 'vitest';
import { FOOTPRINT_TYPES, insertFootprint } from '../../src/plan/insertFootprint';
import { loadTheme } from '../../src/style/theme';

const theme = loadTheme('styles/m1');
const sz = theme.limits.safeZone;

describe('insertFootprint', () => {
  it('covers the types that have a position', () => {
    expect([...FOOTPRINT_TYPES].sort()).toEqual(['counter', 'logo-badge', 'prompt-box', 'quote-card', 'stat-card']);
  });
  it('top starts at the safe zone, bottom ends at it, centre is in the middle of the frame', () => {
    const top = insertFootprint('stat-card', { rows: [{ value: '30 phút' }] }, 'top', theme, 1920, 1080)!;
    const bottom = insertFootprint('stat-card', { rows: [{ value: '30 phút' }] }, 'bottom', theme, 1920, 1080)!;
    const centre = insertFootprint('stat-card', { rows: [{ value: '30 phút' }] }, 'center', theme, 1920, 1080)!;
    expect(top.y).toBeCloseTo(sz.top, 5);
    expect(bottom.y + bottom.h).toBeCloseTo(1 - sz.bottom, 5);
    expect(centre.y + centre.h / 2).toBeCloseTo(0.5, 5);
    expect(top.h).toBeCloseTo(centre.h, 9);
  });
  it('a card is as wide as the safe zone and centred in it; a counter is narrower', () => {
    const card = insertFootprint('quote-card', { quote: 'x' }, 'center', theme, 1920, 1080)!;
    expect(card.x).toBeCloseTo(sz.left, 5);
    expect(card.w).toBeCloseTo(1 - sz.left - sz.right, 5);
    expect(insertFootprint('counter', { to: 5 }, 'center', theme, 1920, 1080)!.w).toBeLessThan(card.w);
  });
  it('more stat rows or a label and sub-line make it taller; the same pixels are a bigger share of a smaller frame', () => {
    const one = insertFootprint('stat-card', { rows: [{ value: 'a' }] }, 'center', theme, 1920, 1080)!;
    const three = insertFootprint('stat-card', { rows: [{ value: 'a' }, { value: 'b' }, { value: 'c' }] }, 'center', theme, 1920, 1080)!;
    expect(three.h).toBeGreaterThan(one.h);
    const bare = insertFootprint('logo-badge', {}, 'center', theme, 1080, 1920)!;
    const full = insertFootprint('logo-badge', { label: 'Claude', sub: 'mô hình' }, 'center', theme, 1080, 1920)!;
    expect(full.h).toBeGreaterThan(bare.h);
    const small = insertFootprint('quote-card', { quote: 'x' }, 'center', theme, 1280, 720)!;
    expect(small.h).toBeGreaterThan(card(1920, 1080).h);
  });
  it('a type without a position has no footprint', () => {
    expect(insertFootprint('title-card', { title: 'x' }, 'center', theme, 1920, 1080)).toBeUndefined();
    expect(insertFootprint('transition', { kind: 'zoom' }, 'center', theme, 1920, 1080)).toBeUndefined();
  });
});

function card(w: number, h: number) { return insertFootprint('quote-card', { quote: 'x' }, 'center', theme, w, h)!; }
