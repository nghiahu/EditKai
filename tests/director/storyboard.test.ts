import { describe, it, expect } from 'vitest';
import { validateStoryboard } from '../../src/director/storyboard';
import type { Beat, Storyboard } from '../../src/director/types';
import { beatOf } from '../helpers/beat';

const sb = (...beats: Beat[]): Storyboard => ({ version: 1, style: 'm1', beats });
const check = (b: Beat) => validateStoryboard(sb(b), 20, 30);
const badge = { type: 'logo-badge', props: { label: 'Claude', icon: 'sparkles' }, at: 1, duration: 2 };

describe('validateStoryboard', () => {
  it('a clean storyboard gives no problems', () => {
    expect(check(beatOf({}, { inserts: [badge], camera: [{ type: 'zoom-punch', at: 2, duration: 1 }], caption: { variant: 'phrase', hl: [3], bigRange: [3, 5] } }))).toEqual([]);
  });
  it('reports an unknown insert type with the beat id', () => {
    const p = check(beatOf({ id: 'b9' }, { inserts: [{ ...badge, type: 'confetti' }] }));
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/b9.*confetti/);
  });
  it('reports a zero or negative duration, and at outside the video', () => {
    expect(check(beatOf({}, { inserts: [{ ...badge, duration: 0 }] }))).toHaveLength(1);
    expect(check(beatOf({}, { inserts: [{ ...badge, duration: -2 }] }))).toHaveLength(1);
    expect(check(beatOf({}, { inserts: [{ ...badge, at: -1 }] }))).toHaveLength(1);
    expect(check(beatOf({}, { inserts: [{ ...badge, at: 31 }] }))).toHaveLength(1);
    expect(check(beatOf({}, { inserts: [{ ...badge, at: Number.NaN }] }))).toHaveLength(1);
  });
  it('reports insert props the layer type rejects', () => {
    expect(check(beatOf({}, { inserts: [{ ...badge, type: 'title-card', props: {} }] }))).toHaveLength(1);
  });
  it('reports hl and bigRange indexes outside the beat, and a bigRange of more than 3 words', () => {
    expect(check(beatOf({}, { caption: { variant: 'phrase', hl: [1], bigRange: null } }))).toHaveLength(1);
    expect(check(beatOf({}, { caption: { variant: 'phrase', hl: [], bigRange: [1, 3] } }))).toHaveLength(1);
    expect(check(beatOf({}, { caption: { variant: 'phrase', hl: [], bigRange: [2, 5] } }))).toHaveLength(1);
    expect(check(beatOf({}, { caption: { variant: 'phrase', hl: [], bigRange: [5, 3] } }))).toHaveLength(1);
  });
  it('reports an unknown camera type and a bad camera time', () => {
    expect(check(beatOf({}, { camera: [{ type: 'spin' as 'shake', at: 1, duration: 1 }] }))).toHaveLength(1);
    expect(check(beatOf({}, { camera: [{ type: 'shake', at: 40, duration: 1 }] }))).toHaveLength(1);
  });
  it('reports a beat whose word range is outside the transcript', () => {
    expect(check(beatOf({ firstWord: 18, lastWord: 25 }))).toHaveLength(1);
  });
});
