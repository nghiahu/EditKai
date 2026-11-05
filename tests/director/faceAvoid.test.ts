import { describe, expect, it } from 'vitest';
import { OVERLAP_LIMIT, placeAwayFromFaces } from '../../src/director/faceAvoid';
import { insertFootprint } from '../../src/plan/insertFootprint';
import { overlapShare, type Faces } from '../../src/media/faces';
import { loadTheme } from '../../src/style/theme';
import type { Layer } from '../../src/plan/types';

const theme = loadTheme('styles/m1');
const W = 1920;
const H = 1080;
const face = (y: number, h: number) => ({ x: 0.4, y, w: 0.2, h });
const faces = (b: ReturnType<typeof face>, from = 0, to = 20): Faces => ({ fps: 4, samples: Array.from({ length: (to - from) * 4 + 1 }, (_, i) => ({ t: from + i / 4, box: b, conf: 0.99 })) });
const layer = (id: string, type: string, start: number, end: number, props?: Record<string, unknown>): Layer => ({ id, track: 'graphic', type, start, end, props } as Layer);
const pos = (l: Layer) => (l.props as { position?: string } | undefined)?.position;

describe('placeAwayFromFaces', () => {
  it('a card over the face in the centre moves to the top or the bottom, wherever it covers the face least', () => {
    const f = faces(face(0.25, 0.3)); // the face fills the middle of the frame
    const [out] = placeAwayFromFaces([layer('a', 'stat-card', 2, 5, { rows: [{ value: '30 phút' }] })], f, theme, W, H);
    expect(['top', 'bottom']).toContain(pos(out));
    const fp = insertFootprint('stat-card', { rows: [{ value: '30 phút' }] }, pos(out) as 'top', theme, W, H)!;
    const centre = insertFootprint('stat-card', { rows: [{ value: '30 phút' }] }, 'center', theme, W, H)!;
    expect(overlapShare(face(0.25, 0.3), fp)).toBeLessThan(overlapShare(face(0.25, 0.3), centre));
  });
  it('picks the bottom when the face is high in the frame', () => {
    const [out] = placeAwayFromFaces([layer('a', 'logo-badge', 2, 4, { label: 'X' })], faces(face(0.05, 0.3)), theme, W, H);
    expect(pos(out)).not.toBe('top');
  });
  it('leaves a layer alone when it already clears the face, has a position of its own, has no position to set, or the face is not there then', () => {
    const f = faces(face(0.02, 0.15)); // a small face high up: the centre is free
    const clear = layer('a', 'logo-badge', 2, 4);
    const fixed = layer('b', 'stat-card', 2, 5, { rows: [{ value: 'x' }], position: 'center' });
    const title = layer('c', 'title-card', 2, 4, { title: 'T' });
    const elsewhere = layer('d', 'stat-card', 30, 33, { rows: [{ value: 'x' }] });
    const mid = faces(face(0.25, 0.3));
    expect(placeAwayFromFaces([clear], f, theme, W, H)).toEqual([clear]);
    expect(placeAwayFromFaces([fixed, title], mid, theme, W, H)).toEqual([fixed, title]);
    expect(placeAwayFromFaces([elsewhere], mid, theme, W, H)).toEqual([elsewhere]);
  });
  it('does not touch the input and does nothing without faces', () => {
    const l = layer('a', 'stat-card', 2, 5, { rows: [{ value: 'x' }] });
    const before = JSON.stringify(l);
    placeAwayFromFaces([l], faces(face(0.25, 0.3)), theme, W, H);
    expect(JSON.stringify(l)).toBe(before);
    expect(placeAwayFromFaces([l], undefined, theme, W, H)).toEqual([l]);
  });
  it('between two positions that clear the face, takes the one that does not sit on the captions', () => {
    // s1 keeps its captions at the bottom: a card at the bottom would cover them
    const s1 = loadTheme('styles/s1');
    const props = { rows: [{ value: '30 phút' }] };
    const fp = (p: 'top' | 'center' | 'bottom') => insertFootprint('stat-card', props, p, s1, W, H)!;
    const bottom = fp('bottom');
    const centre = fp('center');
    const top = fp('top');
    // a face that fills the centre and just reaches into the top position (a little less than the limit), never the bottom
    const y = top.y + top.h * 0.95;
    const f = faces({ x: 0.3, y, w: 0.4, h: centre.y + centre.h - y });
    const [out] = placeAwayFromFaces([layer('a', 'stat-card', 2, 5, props)], f, s1, W, H);
    expect(bottom.y + bottom.h).toBeGreaterThan(centre.y + centre.h); // the face does not reach the bottom
    expect(pos(out)).toBe('top');
  });
  it('the limit is 15 percent of the face', () => {
    expect(OVERLAP_LIMIT).toBe(0.15);
  });
});
