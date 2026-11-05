import { describe, expect, it } from 'vitest';
import { FOOTPRINT_TYPES, insertFootprint } from '../../src/plan/insertFootprint';
import { loadTheme } from '../../src/style/theme';

const theme = loadTheme('styles/m1');
const sz = theme.limits.safeZone;

describe('insertFootprint', () => {
  it('covers the types that have a position', () => {
    expect([...FOOTPRINT_TYPES].sort()).toEqual(['chart', 'counter', 'logo-badge', 'prompt-box', 'quote-card', 'stat-card']);
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
  it('left and right sit at the sides of the safe zone, vertically centred, as tall as in the centre', () => {
    const centre = insertFootprint('logo-badge', { label: 'X' }, 'center', theme, 1920, 1080)!;
    const left = insertFootprint('logo-badge', { label: 'X' }, 'left', theme, 1920, 1080)!;
    const right = insertFootprint('logo-badge', { label: 'X' }, 'right', theme, 1920, 1080)!;
    expect(left.h).toBeCloseTo(centre.h, 9);
    expect(left.y).toBeCloseTo(centre.y, 9);
    expect(left.x).toBeGreaterThanOrEqual(sz.left - 1e-9);
    expect(left.x + left.w).toBeLessThan(0.5);
    expect(right.x).toBeGreaterThan(0.5);
    expect(right.x + right.w).toBeLessThanOrEqual(1 - sz.right + 1e-9);
    expect(left.w).toBeCloseTo(right.w, 9);
  });
  it('a card at the side is squeezed into the side column, a counter keeps most of it', () => {
    const wide = insertFootprint('quote-card', { quote: 'x' }, 'center', theme, 1920, 1080)!;
    expect(insertFootprint('quote-card', { quote: 'x' }, 'left', theme, 1920, 1080)!.w).toBeLessThan(wide.w / 1.5);
    expect(insertFootprint('counter', { to: 5 }, 'left', theme, 1920, 1080)!.w).toBeGreaterThan(0.3);
  });
  it('a type without a position has no footprint', () => {
    expect(insertFootprint('title-card', { title: 'x' }, 'center', theme, 1920, 1080)).toBeUndefined();
    expect(insertFootprint('transition', { kind: 'zoom' }, 'center', theme, 1920, 1080)).toBeUndefined();
  });
});

function card(w: number, h: number) { return insertFootprint('quote-card', { quote: 'x' }, 'center', theme, w, h)!; }
