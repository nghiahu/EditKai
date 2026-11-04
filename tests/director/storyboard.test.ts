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

import { normalizeStoryboard } from '../../src/director/storyboard';

describe('normalizeStoryboard (a hand-edited storyboard of any shape never throws)', () => {
  const norm = (raw: unknown) => normalizeStoryboard(raw);
  it('a good storyboard passes through unchanged with no issues', () => {
    const good = sb(beatOf({}, { inserts: [badge] }));
    expect(norm(good)).toEqual({ sb: good, issues: [] });
  });
  it('beats that is not an array, or a storyboard that is not an object, gives an empty storyboard and an issue', () => {
    for (const raw of [{}, { beats: {} }, null, 7, 'x']) {
      const r = norm(raw);
      expect(r.sb.beats).toEqual([]);
      expect(r.issues).toHaveLength(1);
    }
  });
  it('fills missing treatment, caption, inserts, camera, cues and bad hl/bigRange with safe defaults and says so', () => {
    const raw = { version: 1, style: 'm1', beats: [
      { id: 'b1', start: 0, end: 1, firstWord: 2, lastWord: 4 },
      { id: 'b2', start: 1, end: 2, firstWord: 5, lastWord: 6, cues: null, treatment: { caption: { variant: 'phrase', hl: 3, bigRange: 3 }, inserts: null } },
      { id: 'b3', start: 2, end: 3, firstWord: 7, lastWord: 8, treatment: { caption: null, inserts: [null, 5, { type: 'logo-badge', props: { label: 'x' }, at: 1, duration: 1 }], camera: [] } },
    ] };
    const { sb: out, issues } = norm(raw);
    expect(out.beats).toHaveLength(3);
    for (const b of out.beats) {
      expect(b.cues).toEqual([]);
      expect(Array.isArray(b.treatment.inserts) && Array.isArray(b.treatment.camera)).toBe(true);
      expect(b.treatment.caption).toMatchObject({ variant: 'phrase', hl: [], bigRange: null });
    }
    expect(out.beats[2].treatment.inserts).toHaveLength(1);
    for (const id of ['b1', 'b2', 'b3']) expect(issues.some(i => i.startsWith(id))).toBe(true);
  });
  it('a beat whose firstWord or lastWord is not an integer is skipped with an issue naming it', () => {
    const mk = (firstWord: unknown, lastWord: unknown, id: string) => ({ id, start: 0, end: 1, firstWord, lastWord, cues: [], treatment: { caption: { variant: 'phrase', hl: [], bigRange: null }, inserts: [], camera: [] } });
    const { sb: out, issues } = norm({ version: 1, style: 'm1', beats: [mk(null, 3, 'b1'), mk(1.5, 3, 'b2'), mk('2', '5', 'b3'), mk(1, 2, 'b4')] });
    expect(out.beats.map(b => b.id)).toEqual(['b4']);
    expect(issues.filter(i => /^b[123]:/.test(i))).toHaveLength(3);
  });
});
