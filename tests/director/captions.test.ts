import { describe, it, expect } from 'vitest';
import { captionLayers } from '../../src/director/captions';
import type { Beat, CaptionSpec, Storyboard } from '../../src/director/types';

type W = { t: string; s: number; e: number };
const LIMITS = { maxCaptionWords: 4 };

/** n words w0..w(n-1), 0.4 s apart, 0.3 s long; `texts` overrides word text by index. */
const words = (n: number, texts: Record<number, string> = {}): W[] =>
  Array.from({ length: n }, (_, i) => ({ t: texts[i] ?? `w${i}`, s: i * 0.4, e: i * 0.4 + 0.3 }));

const beat = (id: string, first: number, last: number, caption: Partial<CaptionSpec> = {}, cues: Beat['cues'] = []): Beat => ({
  id, start: first * 0.4, end: last * 0.4 + 0.3, firstWord: first, lastWord: last, text: '', cues, reviewed: false,
  treatment: { caption: { variant: 'phrase', hl: [], bigRange: null, ...caption }, inserts: [], camera: [] },
});
const board = (...beats: Beat[]): Storyboard => ({ version: 1, style: 'm1', beats });
const run = (sb: Storyboard, w: W[], duration = 100, limits = LIMITS) => captionLayers(sb, w, limits, duration);
const texts = (l: { words?: { t: string }[] }) => (l.words ?? []).map(x => x.t);

describe('chunking', () => {
  it('splits a long beat into chunks of at most maxCaptionWords words', () => {
    const { layers } = run(board(beat('b1', 0, 9)), words(10));
    expect(layers.map(l => l.words!.length)).toEqual([4, 4, 2]);
    expect(layers.every(l => l.track === 'caption')).toBe(true);
  });
  it('breaks at punctuation once a chunk has 2 words, but not after the first word', () => {
    const w = words(8, { 0: 'à,', 1: 'xin,', 4: 'nữa.' });
    const { layers } = run(board(beat('b1', 0, 7)), w);
    expect(layers.map(texts)).toEqual([['à,', 'xin,'], ['w2', 'w3', 'nữa.'], ['w5', 'w6', 'w7']]);
  });
  it('ids are c1, c2 … in order across beats', () => {
    const { layers } = run(board(beat('b1', 0, 3), beat('b2', 4, 7)), words(8));
    expect(layers.map(l => l.id)).toEqual(['c1', 'c2']);
  });
  it('an empty beat list gives no layers', () => {
    expect(run(board(), words(3))).toEqual({ layers: [], issues: [] });
  });
});

describe('timing', () => {
  it('start is the first word s minus 0.05 and end the last word e plus 0.4, never past the next start minus 0.05', () => {
    const { layers } = run(board(beat('b1', 0, 7)), words(8));
    expect(layers[0].start).toBe(0); // 0 - 0.05 clamped to 0
    expect(layers[1].start).toBeCloseTo(4 * 0.4 - 0.05, 5);
    expect(layers[0].end).toBeCloseTo(layers[1].start - 0.05, 5); // 3 x 0.4 + 0.3 + 0.4 = 1.9 > 1.5
    expect(layers[1].end).toBeCloseTo(7 * 0.4 + 0.3 + 0.4, 5);
  });
  it('the last caption ends at most at the video end', () => {
    const { layers } = run(board(beat('b1', 0, 3)), words(4), 1.6);
    expect(layers[0].end).toBeLessThanOrEqual(1.6);
  });
  it('repeated or backwards word times never make captions overlap and every caption lasts at least 0.1 s', () => {
    const w = words(12);
    w[4] = { t: 'x', s: 0.2, e: 0.5 }; // backwards
    w[5] = { ...w[4] };               // repeated
    w[8] = { t: 'y', s: 0, e: 0 };
    const { layers } = run(board(beat('b1', 0, 5), beat('b2', 6, 11)), w);
    layers.forEach((l, i) => {
      expect(l.end - l.start).toBeGreaterThanOrEqual(0.1 - 1e-9);
      expect(l.start).toBeGreaterThanOrEqual(0);
      if (i > 0) expect(l.start).toBeGreaterThanOrEqual(layers[i - 1].end - 1e-9);
    });
  });
});

describe('bigRange', () => {
  it('becomes its own big chunk with phrase chunks around it', () => {
    const { layers } = run(board(beat('b1', 0, 7, { bigRange: [3, 4] })), words(8));
    expect(layers.map(texts)).toEqual([['w0', 'w1', 'w2'], ['w3', 'w4'], ['w5', 'w6', 'w7']]);
    expect(layers.map(l => l.props)).toEqual([undefined, { variant: 'big' }, undefined]);
  });
  it('a bigRange of 4 words, or outside the beat, is ignored with an issue (Review Focus 3)', () => {
    const a = run(board(beat('b1', 0, 7, { bigRange: [2, 5] })), words(8));
    expect(a.issues.join()).toMatch(/b1/);
    expect(a.layers.some(l => l.props)).toBe(false);
    const b = run(board(beat('b1', 2, 5, { bigRange: [0, 1] })), words(8));
    expect(b.issues.join()).toMatch(/b1/);
    expect(b.layers.some(l => l.props)).toBe(false);
    const c = run(board(beat('b1', 0, 3, { bigRange: [3, 1] })), words(8));
    expect(c.issues.join()).toMatch(/b1/);
  });
});

describe('highlights and labels', () => {
  it('hl indexes mark words, indexes outside the beat are ignored with an issue', () => {
    const { layers, issues } = run(board(beat('b1', 2, 5, { hl: [3, 9, -1] })), words(10));
    expect(layers[0].words!.map(x => x.hl)).toEqual([false, true, false, false]);
    expect(issues.join()).toMatch(/b1/);
  });
  it('the label lands on the chunk with the tool cue word', () => {
    const cues: Beat['cues'] = [{ kind: 'tool', text: 'Claude', word: 5 }];
    const { layers } = run(board(beat('b1', 0, 7, { variant: 'label', label: 'mô hình' }, cues)), words(8));
    expect(layers.map(l => l.props)).toEqual([undefined, { variant: 'label', label: 'mô hình' }]);
  });
  it('the label goes on the first chunk when there is no tool cue', () => {
    const { layers } = run(board(beat('b1', 0, 7, { variant: 'label', label: 'công cụ' })), words(8));
    expect(layers[0].props).toEqual({ variant: 'label', label: 'công cụ' });
    expect(layers[1].props).toBeUndefined();
  });
  it('a label variant without label degrades to phrase with an issue', () => {
    const { layers, issues } = run(board(beat('b1', 0, 3, { variant: 'label' })), words(4));
    expect(layers[0].props).toBeUndefined();
    expect(issues.join()).toMatch(/b1/);
  });
});
