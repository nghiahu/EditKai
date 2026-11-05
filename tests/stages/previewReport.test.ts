import { describe, expect, it } from 'vitest';
import { previewReport } from '../../src/stages/previewReport';
import type { Issue, Layer } from '../../src/plan/types';

const frames = [
  { t: 1.2, label: 'logo-badge', file: 'preview/f01.png' },
  { t: 6.5, label: 'caption', file: 'preview/f02.png' },
  { t: 12, label: 'title-card', file: 'preview/f03.png' },
];
const layers = [
  { id: 'g1', track: 'graphic', type: 'logo-badge', start: 1, end: 3 },
  { id: 'c9', track: 'caption', start: 6, end: 7 },
  { id: 't1', track: 'title', type: 'title-card', start: 11, end: 13 },
] as Layer[];
const words = Array.from({ length: 30 }, (_, i) => ({ t: `từ${i}`, s: i * 0.5, e: i * 0.5 + 0.4 }));
const issues: Issue[] = [
  { severity: 'warning', code: 'insert-on-face', layerId: 'g1', message: 'g1: che 40% mặt người nói' },
  { severity: 'warning', code: 'insert-gap', message: 'không có insert nào từ 20s đến 40s' },
];

describe('previewReport', () => {
  const md = previewReport({ frames, layers, words, issues });
  it('has one table row per frame, in order, with the picture file, the time, the kind and the words said around it', () => {
    const rows = md.split('\n').filter(l => /^\| \d+ \|/.test(l));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('f01.png');
    expect(rows[0]).toContain('1.2');
    expect(rows[0]).toContain('logo-badge');
    expect(rows[0]).toContain('từ1'); // said around 1.2 s
    expect(rows[1]).toContain('từ12'); // around 6.5 s
  });
  it('puts a layer\'s warning on the frames where that layer is up, and only there', () => {
    const rows = md.split('\n').filter(l => /^\| \d+ \|/.test(l));
    expect(rows[0]).toContain('insert-on-face');
    expect(rows[1]).not.toContain('insert-on-face');
    expect(rows[2]).not.toContain('insert-on-face');
  });
  it('lists warnings that belong to no layer once, at the end', () => {
    expect(md).toMatch(/insert-gap/);
    expect(md.indexOf('insert-gap')).toBeGreaterThan(md.lastIndexOf('f03.png'));
  });
  it('does not break on no words, no issues, no frames, or a pipe in the text', () => {
    expect(() => previewReport({ frames: [], layers: [], words: [], issues: [] })).not.toThrow();
    const row = previewReport({ frames: [frames[0]], layers, words: [{ t: 'a|b', s: 1, e: 1.5 }], issues: [] }).split('\n').find(l => /^\| 1 \|/.test(l))!;
    expect(row.split('|').length).toBe(9); // six columns make seven pipes, plus the escaped one in the word
  });
});
