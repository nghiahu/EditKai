import { describe, it, expect } from 'vitest';
import { cameraLayers, insertLayers } from '../../src/director/inserts';
import { loadTheme } from '../../src/style/theme';
import type { CameraSpec, InsertSpec, Storyboard } from '../../src/director/types';
import { beatOf } from '../helpers/beat';

const m1 = loadTheme('styles/m1').director;
const badge = (at: number, duration = 2, extra: Partial<InsertSpec> = {}): InsertSpec => ({ type: 'logo-badge', props: { label: 'Claude', icon: 'sparkles' }, at, duration, ...extra });
const stat = (at: number, duration = 3): InsertSpec => ({ type: 'stat-card', props: { rows: [{ value: '30 phút', icon: 'clock' }] }, at, duration });
const footage = (at: number, duration = 4): InsertSpec => ({ type: 'footage', props: { src: 'assets/a.mp4', frame: 'window' }, at, duration });
const inserts = (...list: InsertSpec[]): Storyboard => ({ version: 1, style: 'm1', beats: [beatOf({}, { inserts: list })] });
const punches = (...list: CameraSpec[]): Storyboard => ({ version: 1, style: 'm1', beats: [beatOf({}, { camera: list })] });

describe('insertLayers', () => {
  it('maps types to their tracks (footage → footage, stat-card → graphic, logo-badge → graphic) with ids i1…', () => {
    const { layers } = insertLayers(inserts(badge(0), footage(10), stat(20)), 60);
    expect(layers.map(l => [l.id, l.track, l.type])).toEqual([['i1', 'graphic', 'logo-badge'], ['i2', 'footage', 'footage'], ['i3', 'graphic', 'stat-card']]);
    expect(layers[1]).toMatchObject({ start: 10, end: 14, props: { src: 'assets/a.mp4' } });
  });
  it('a later overlapping layer on the same track moves to the earlier end plus 0.1 s when it keeps 60% of its length', () => {
    const r = insertLayers(inserts(stat(0, 3), badge(2, 2)), 60);
    expect(r.layers[1]).toMatchObject({ start: 3.1, end: 5.1 });
    expect(r.moved).toEqual([{ id: 'i2', from: 2, to: 3.1 }]);
    expect(r.dropped).toEqual([]);
  });
  it('is dropped when it would keep less than 60% of its length, both reported', () => {
    const near = insertLayers(inserts(stat(0, 3), badge(2.5, 2)), 3.8); // moves to 3.1, only 0.7 of 2 s fits
    expect(near.layers.map(l => l.type)).toEqual(['stat-card']);
    expect(near.dropped).toHaveLength(1);
    expect(near.dropped[0]).toMatchObject({ type: 'logo-badge', at: 2.5 });
    expect(near.moved).toEqual([]);
  });
  it('layers on different tracks do not collide', () => {
    const r = insertLayers(inserts(footage(0, 4), stat(1, 3)), 60);
    expect(r.layers.map(l => [l.start, l.end])).toEqual([[0, 4], [1, 4]]);
    expect(r.moved).toEqual([]);
  });
  it('an unknown type, a negative duration and at beyond the video are dropped with a reason and never throw', () => {
    const r = insertLayers(inserts({ ...badge(1), type: 'confetti' }, badge(1, -1), badge(99), badge(4, 2, { type: 'title-card', props: {} })), 30);
    expect(r.layers).toEqual([]);
    expect(r.dropped).toHaveLength(4);
    expect(r.dropped.every(d => d.reason.startsWith('invalid: '))).toBe(true);
  });
  it('a layer partly past the video end is clamped, one with less than 0.3 s left is dropped', () => {
    const r = insertLayers(inserts(badge(9, 2), badge(29.8, 2, {})), 10);
    expect(r.layers).toHaveLength(1);
    expect(r.layers[0]).toMatchObject({ start: 9, end: 10 });
    expect(r.dropped).toEqual([{ type: 'logo-badge', at: 29.8, reason: expect.stringMatching(/^invalid/) }]);
    const s = insertLayers(inserts(badge(9.8, 2)), 10);
    expect(s.layers).toEqual([]);
    expect(s.dropped[0].reason).toBe('out-of-range');
  });
  it('same-track layers never overlap in the output, whatever order the beats list them', () => {
    const sb: Storyboard = { version: 1, style: 'm1', beats: [beatOf({ id: 'b1' }, { inserts: [badge(5)] }), beatOf({ id: 'b2' }, { inserts: [badge(4.5), badge(5.5)] })] };
    const { layers } = insertLayers(sb, 60);
    const sorted = [...layers].sort((a, b) => a.start - b.start);
    sorted.forEach((l, i) => { if (i) expect(l.start).toBeGreaterThanOrEqual(sorted[i - 1].end); });
  });
});

describe('cameraLayers', () => {
  const punch = (at: number, duration = 1.2): CameraSpec => ({ type: 'zoom-punch', at, duration });
  it('keeps punches apart by punchSpacingSec and reports the rest', () => {
    const r = cameraLayers(punches(punch(1), punch(4), punch(8)), m1, 60); // m1 spacing 6
    expect(r.layers.map(l => [l.id, l.track, l.type, l.start])).toEqual([['z1', 'camera', 'zoom-punch', 1], ['z2', 'camera', 'zoom-punch', 8]]);
    expect(r.dropped).toHaveLength(1);
    expect(r.dropped[0]).toMatchObject({ type: 'zoom-punch', at: 4 });
  });
  it('camera layers never overlap even with a spacing of zero', () => {
    const r = cameraLayers(punches(punch(1, 3), punch(2, 1)), { ...m1, punchSpacingSec: 0 }, 60);
    expect(r.layers).toHaveLength(1);
    expect(r.dropped).toHaveLength(1);
  });
  it('drops an invalid camera entry with a reason and clamps to the video end', () => {
    const r = cameraLayers(punches({ type: 'spin' as 'shake', at: 1, duration: 1 }, punch(-3), punch(9.5, 2)), m1, 10);
    expect(r.layers).toHaveLength(1);
    expect(r.layers[0]).toMatchObject({ start: 9.5, end: 10 });
    expect(r.dropped).toHaveLength(2);
  });
});
