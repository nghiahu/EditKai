import { describe, it, expect } from 'vitest';
import { mergeRegenerated } from '../../src/plan/merge';
import type { Plan, Layer } from '../../src/plan/types';

const base = (layers: Layer[], scenes: Plan['scenes'] = []): Plan => ({
  version: 1, meta: { source: 'c.mp4', fps: 30, width: 1080, height: 1920, style: 's1' }, scenes, layers,
});
const L = (id: string, track: Layer['track'], start: number, end: number, locked = false): Layer => ({ id, track, start, end, locked });

describe('mergeRegenerated', () => {
  it('keeps locked layers and takes regenerated unlocked ones', () => {
    const existing = base([L('a', 'title', 0, 2, true), L('b', 'title', 5, 7)]);
    const regen = base([L('c', 'title', 10, 12)]);
    expect(mergeRegenerated(existing, regen).layers.map(l => l.id).sort()).toEqual(['a', 'c']);
  });
  it('drops a regenerated layer that overlaps a locked layer on the same track', () => {
    const existing = base([L('a', 'title', 0, 4, true)]);
    const regen = base([L('c', 'title', 3, 6), L('d', 'caption', 3, 6)]);
    expect(mergeRegenerated(existing, regen).layers.map(l => l.id).sort()).toEqual(['a', 'd']);
  });
  it('keeps scenes from regenerated', () => {
    const existing = base([], [{ id: 's1', start: 0, end: 1, role: 'talking-head' }]);
    const regen = base([], [{ id: 's2', start: 0, end: 2, role: 'explainer' }]);
    expect(mergeRegenerated(existing, regen).scenes.map(s => s.id)).toEqual(['s2']);
  });
  it('drops a regenerated layer whose id equals a locked layer id', () => {
    const existing = base([L('c1', 'caption', 0, 2, true)]);
    const regen = base([L('c1', 'title', 5, 6)]);
    expect(mergeRegenerated(existing, regen).layers.map(l => l.id)).toEqual(['c1']);
  });
});
