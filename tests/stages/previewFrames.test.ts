import { describe, expect, it } from 'vitest';
import { previewFrames } from '../../src/stages/previewFrames';
import type { Layer, Plan } from '../../src/plan/types';

const plan = (layers: Layer[], end = 60): Plan => ({
  version: 1, meta: { source: 'cleaned.mp4', fps: 30, width: 1080, height: 1920, style: 'm1' },
  scenes: [{ id: 's1', start: 0, end, role: 'talking-head' }], layers,
});
const L = (id: string, track: Layer['track'], type: string | undefined, start: number, end: number, props?: Record<string, unknown>): Layer => ({ id, track, type, start, end, props });
const caption = (id: string, start: number, end: number, props?: Record<string, unknown>): Layer => ({ id, track: 'caption', start, end, props, words: [{ t: 'x', s: start, e: end, hl: false }] });

describe('previewFrames', () => {
  it('a transition is looked at in the middle (where the effect peaks), an insert once it has settled (60% in)', () => {
    const f = previewFrames(plan([L('t', 'graphic', 'transition', 10, 10.4, { kind: 'whip' }), L('s', 'graphic', 'stat-card', 20, 23.5, { rows: [{ value: '1' }] })]));
    expect(f.find(x => x.label.includes('whip'))!.t).toBeCloseTo(10.2, 5);
    expect(f.find(x => x.label.includes('stat-card'))!.t).toBeCloseTo(22.1, 5);
  });
  it('labels say what is on the frame', () => {
    const f = previewFrames(plan([L('t', 'graphic', 'transition', 10, 10.4, { kind: 'dip' }), L('c', 'title', 'title-card', 20, 23, { title: 'X' })]));
    expect(f.map(x => x.label)).toEqual(expect.arrayContaining(['chuyển cảnh dip', 'title-card']));
  });
  it('frames come out in time order', () => {
    const f = previewFrames(plan([L('a', 'graphic', 'stat-card', 30, 33, { rows: [{ value: '1' }] }), L('b', 'title', 'title-card', 5, 8, { title: 'X' }), L('t', 'graphic', 'transition', 15, 15.4, { kind: 'zoom' })]));
    expect(f.map(x => x.t)).toEqual([...f.map(x => x.t)].sort((x, y) => x - y));
  });
  it('captions are sampled a few times, the first one with a plate included', () => {
    const caps = Array.from({ length: 30 }, (_, i) => caption(`c${i}`, i * 2, i * 2 + 1.8, i === 7 ? { backdrop: 'plate' } : undefined));
    const f = previewFrames(plan(caps));
    expect(f.filter(x => x.label.startsWith('caption')).length).toBeGreaterThanOrEqual(3);
    expect(f.length).toBeLessThanOrEqual(8);
    expect(f.some(x => x.label.includes('nền mờ'))).toBe(true);
  });
  it('two frames closer than minGapSec become one, the more important one wins', () => {
    const f = previewFrames(plan([L('t', 'graphic', 'transition', 10, 10.4, { kind: 'zoom' }), L('c', 'title', 'title-card', 8, 10.9, { title: 'X' })])); // the title card settles at 9.74, 0.46 s from the join
    const near = f.filter(x => Math.abs(x.t - 10.2) < 0.6);
    expect(near).toHaveLength(1);
    expect(near[0].label).toContain('chuyển cảnh');
  });
  it('at most max frames: transitions and inserts first, captions give way', () => {
    const layers: Layer[] = [];
    for (let i = 0; i < 12; i++) layers.push(L(`t${i}`, 'graphic', 'transition', 5 + i * 4, 5.4 + i * 4, { kind: 'zoom' }));
    for (let i = 0; i < 12; i++) layers.push(L(`i${i}`, 'title', 'title-card', 6 + i * 4, 8.5 + i * 4, { title: 'X' }));
    for (let i = 0; i < 30; i++) layers.push(caption(`c${i}`, i * 2, i * 2 + 1.8));
    const f = previewFrames(plan(layers, 70), { max: 20 });
    expect(f).toHaveLength(20);
    expect(f.filter(x => x.label.startsWith('caption'))).toHaveLength(0);
    expect(f.filter(x => x.label.startsWith('chuyển cảnh')).length).toBe(12);
  });
  it('an empty plan still gives a frame or two (start and end of the video), never throws', () => {
    expect(() => previewFrames(plan([]))).not.toThrow();
    const f = previewFrames(plan([]));
    expect(f.length).toBeGreaterThanOrEqual(1);
    f.forEach(x => { expect(x.t).toBeGreaterThanOrEqual(0); expect(x.t).toBeLessThan(60); });
  });
  it('camera layers are not frames of their own and nothing falls outside the video', () => {
    const f = previewFrames(plan([L('z', 'camera', 'zoom-punch', 5, 6.2), L('late', 'title', 'title-card', 59.5, 60, { title: 'X' })]));
    expect(f.some(x => x.label.includes('zoom-punch'))).toBe(false);
    f.forEach(x => expect(x.t).toBeLessThan(60));
  });
});
