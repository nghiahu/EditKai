import { describe, expect, it } from 'vitest';
import { sfxCues } from '../../src/audio/cues';
import type { Layer, Plan } from '../../src/plan/types';

const plan = (layers: Layer[], sfx?: unknown): Plan => ({
  version: 1,
  meta: { source: 'cleaned.mp4', fps: 30, width: 1080, height: 1920, style: 'm1', ...(sfx ? { sfx } : {}) } as Plan['meta'],
  scenes: [],
  layers,
});
const L = (id: string, track: Layer['track'], type: string | undefined, start: number, end: number, props?: Record<string, unknown>): Layer => ({ id, track, type, start, end, props } as Layer);

describe('sfxCues', () => {
  it('a transition gets a whoosh just before its middle; dip gets a swell', () => {
    const [a] = sfxCues(plan([L('t1', 'graphic', 'transition', 10, 10.4, { kind: 'zoom' })]));
    expect(a).toMatchObject({ sound: 'whoosh', layerId: 't1' });
    expect(a.t).toBeCloseTo(10.05, 5);
    const [b] = sfxCues(plan([L('t2', 'graphic', 'transition', 20, 20.4, { kind: 'dip' })]));
    expect(b.sound).toBe('swell');
  });
  it('a card gets a pop at its start', () => {
    for (const [type, track] of [['logo-badge', 'graphic'], ['stat-card', 'graphic'], ['title-card', 'title'], ['chip-stack', 'graphic'], ['quote-card', 'graphic'], ['explainer-scene', 'graphic'], ['prompt-box', 'graphic'], ['step-number', 'graphic'], ['callout', 'graphic']] as const) {
      expect(sfxCues(plan([L('a', track, type, 5, 7)]))).toEqual([{ t: 5, sound: 'pop', gain: 0.8, layerId: 'a' }]);
    }
  });
  it('footage gets a pop, a zoom-punch gets a thud', () => {
    expect(sfxCues(plan([L('f', 'footage', 'footage', 3, 6)]))[0].sound).toBe('pop');
    expect(sfxCues(plan([L('c', 'camera', 'zoom-punch', 3, 4)]))[0]).toMatchObject({ sound: 'thud', t: 3 });
  });
  it('shake and captions make no sound', () => {
    expect(sfxCues(plan([L('s', 'camera', 'shake', 3, 4), L('cap', 'caption', undefined, 1, 2)]))).toEqual([]);
  });
  it('a counter ticks evenly, at most 8 times, and fewer on a short layer', () => {
    const long = sfxCues(plan([L('n', 'graphic', 'counter', 4, 8)]));
    expect(long).toHaveLength(8);
    expect(long.every(c => c.sound === 'tick')).toBe(true);
    expect(long[1].t - long[0].t).toBeCloseTo(0.15, 5);
    expect(sfxCues(plan([L('n', 'graphic', 'counter', 4, 4.5)])).length).toBeLessThan(8);
    expect(sfxCues(plan([L('n', 'graphic', 'counter', 4, 4.5)])).length).toBeGreaterThanOrEqual(1);
  });
  it('two sounds closer than 0.35 s keep the more important one', () => {
    const cues = sfxCues(plan([L('a', 'graphic', 'stat-card', 10, 12), L('t', 'graphic', 'transition', 9.9, 10.3, { kind: 'whip' })]));
    expect(cues.map(c => c.sound)).toEqual(['whoosh']); // whoosh at 10.0; the pop at 10.0 is dropped
  });
  it('a tick next to a card is dropped, ticks among themselves stay', () => {
    const cues = sfxCues(plan([L('a', 'graphic', 'stat-card', 10, 12), L('n', 'graphic', 'counter', 10.1, 14)]));
    expect(cues.filter(c => c.sound === 'pop')).toHaveLength(1);
    expect(cues.filter(c => c.sound === 'tick').every(c => c.t >= 10.35 - 1e-9)).toBe(true);
    expect(cues.filter(c => c.sound === 'tick').length).toBeGreaterThan(3);
  });
  it('props.sound false silences one layer, meta.sfx.enabled false silences everything', () => {
    expect(sfxCues(plan([L('a', 'graphic', 'stat-card', 10, 12, { sound: false })]))).toEqual([]);
    expect(sfxCues(plan([L('a', 'graphic', 'stat-card', 10, 12)], { enabled: false }))).toEqual([]);
  });
  it('the result is in time order, an empty plan gives nothing', () => {
    const cues = sfxCues(plan([L('b', 'graphic', 'stat-card', 20, 22), L('a', 'graphic', 'logo-badge', 5, 7), L('c', 'camera', 'zoom-punch', 12, 13)]));
    expect(cues.map(c => c.t)).toEqual([5, 12, 20]);
    expect(sfxCues(plan([]))).toEqual([]);
  });
});
