import { describe, it, expect } from 'vitest';
import { suggestTreatments } from '../../src/director/suggest';
import { strikeDoneFrame, typingDoneFrame } from '../../remotion/promptTyping';
import { loadTheme } from '../../src/style/theme';
import type { Asset } from '../../src/assets/manifest';
import type { BeatSpan, Cue, Treatment } from '../../src/director/types';

const m1 = loadTheme('styles/m1').director;
const s1 = loadTheme('styles/s1').director;
const FPS = 30;

/** Global transcript: n words, 0.4 s apart; beats are given as [first, last] word index pairs. */
const words = (n: number) => Array.from({ length: n }, (_, i) => ({ t: `w${i}`, s: i * 0.4, e: i * 0.4 + 0.3 }));
const span = (first: number, last: number): BeatSpan => ({ firstWord: first, lastWord: last, start: first * 0.4, end: last * 0.4 + 0.3, text: `beat ${first}-${last} có vài từ` });
const cue = (kind: Cue['kind'], word: number, extra: Partial<Cue> = {}): Cue => ({ kind, text: extra.text ?? `t${word}`, word, ...extra });
const screen: Asset = { file: 'assets/screen.mp4', description: 'quay màn hình editor', kind: 'screen' };
const phone: Asset = { file: 'assets/phone.mp4', description: 'video dọc', kind: 'phone' };

function run(spans: BeatSpan[], cues: Cue[][], opts: { director?: typeof m1; matches?: (Asset | undefined)[]; n?: number } = {}): Treatment[] {
  const n = opts.n ?? Math.max(...spans.map(s => s.lastWord)) + 1;
  return suggestTreatments({ spans, cues, matches: opts.matches ?? spans.map(() => undefined), words: words(n), director: opts.director ?? m1, fps: FPS });
}
const types = (t: Treatment) => t.inserts.map(i => i.type);

describe('inserts from cues', () => {
  it('a tool cue gives a logo-badge at the word start with the term as label, and a label caption for a beat of 3+ words', () => {
    const [t] = run([span(0, 5)], [[cue('tool', 2, { text: 'Claude', label: 'mô hình' })]]);
    expect(t.inserts[0]).toMatchObject({ type: 'logo-badge', props: { label: 'Claude' }, at: 0.8, duration: 2 });
    expect(t.caption).toMatchObject({ variant: 'label', label: 'mô hình' });
    expect(t.caption.hl).toContain(2);
  });
  it('a number cue gives a one-row stat-card, with a clock icon for a time and a gauge for a percentage', () => {
    const [a] = run([span(0, 5)], [[cue('number', 3, { text: '30 phút' })]]);
    expect(a.inserts[0]).toMatchObject({ type: 'stat-card', duration: 3.5 });
    expect(a.inserts[0].at).toBeCloseTo(1.2, 5); // word 3 starts at 3 x 0.4 s
    expect(a.inserts[0].props).toMatchObject({ rows: [{ value: '30 phút', icon: 'clock' }] });
    const [b] = run([span(0, 5)], [[cue('number', 3, { text: '2-3%' })]]);
    expect(b.inserts[0].props).toMatchObject({ rows: [{ value: '2-3%', icon: 'gauge' }] });
  });
  it('a prompt cue gives a prompt-box; a negating emphasis cue turns the strike on, another emphasis word does not', () => {
    const base = cue('prompt', 2, { text: 'sửa chữ này to hơn' });
    const [neg] = run([span(0, 6)], [[cue('emphasis', 0, { text: 'Đừng' }), base]]);
    const [pos] = run([span(0, 6)], [[cue('emphasis', 0, { text: 'rất' }), base]]);
    expect(neg.inserts.find(i => i.type === 'prompt-box')!.props).toMatchObject({ text: 'sửa chữ này to hơn', strike: true });
    expect(pos.inserts.find(i => i.type === 'prompt-box')!.props).toMatchObject({ strike: false });
  });
  it('the prompt-box lasts long enough to type the text and draw the strike', () => {
    const text = 'sửa chữ này to hơn nhé bạn ơi';
    const [t] = run([span(0, 6)], [[cue('emphasis', 0, { text: 'đừng' }), cue('prompt', 2, { text })]]);
    const box = t.inserts.find(i => i.type === 'prompt-box')!;
    expect(box.duration).toBeGreaterThanOrEqual(strikeDoneFrame(text, FPS) / FPS);
    const [plain] = run([span(0, 6)], [[cue('prompt', 2, { text })]]);
    expect(plain.inserts[0].duration).toBeGreaterThanOrEqual(typingDoneFrame(text, FPS) / FPS);
    expect(plain.inserts[0].duration).toBeLessThan(box.duration);
  });
  it('a list cue gives a chip-stack for m1 and an explainer-scene list for s1', () => {
    const list = cue('list', 1, { items: ['Typography', 'Graphic', 'Motion'] });
    const [a] = run([span(0, 7)], [[list]]);
    expect(a.inserts[0].type).toBe('chip-stack');
    expect(a.inserts[0].props).toMatchObject({ chips: [{ label: 'Typography' }, { label: 'Graphic' }, { label: 'Motion' }] });
    const [b] = run([span(0, 7)], [[list]], { director: s1 });
    expect(b.inserts[0].type).toBe('explainer-scene');
    expect(b.inserts[0].props).toMatchObject({ body: { kind: 'list', items: ['Typography', 'Graphic', 'Motion'] } });
    expect(String((b.inserts[0].props as { title: unknown }).title).length).toBeGreaterThan(0);
  });
  it('a matched screen asset with a ui cue gives a window footage with zoom-in, a phone asset with a shortvideo cue a phone footage', () => {
    const [a] = run([span(0, 7)], [[cue('ui', 2, { text: 'giao diện' })]], { matches: [screen] });
    expect(a.inserts[0]).toMatchObject({ type: 'footage', props: { src: 'assets/screen.mp4', frame: 'window', motion: 'zoom-in' } });
    const [b] = run([span(0, 7)], [[cue('shortvideo', 3, { text: 'TikTok' })]], { matches: [phone] });
    expect(b.inserts[0]).toMatchObject({ type: 'footage', props: { src: 'assets/phone.mp4', frame: 'phone' } });
  });
  it('a matched asset without a ui or shortvideo cue still becomes footage at the beat start', () => {
    const [a] = run([span(2, 8)], [[]], { matches: [screen], n: 9 });
    expect(a.inserts[0]).toMatchObject({ type: 'footage', at: 0.8 });
  });
  it('a beat with no cues gets a plain phrase treatment with no inserts and no camera', () => {
    expect(run([span(0, 4)], [[]])[0]).toEqual({ caption: { variant: 'phrase', hl: [], bigRange: null }, inserts: [], camera: [] });
  });
});

describe('style filtering and spacing', () => {
  it('s1 drops prompt-box suggestions because they are not allowed', () => {
    const [t] = run([span(0, 6)], [[cue('prompt', 2, { text: 'sửa chữ này to hơn' })]], { director: s1 });
    expect(types(t)).not.toContain('prompt-box');
  });
  it('an insert closer than insertMinGapSec to the previous one is dropped', () => {
    const spans = [span(0, 5), span(6, 11)];
    const out = run(spans, [[cue('tool', 1, { text: 'Claude' })], [cue('tool', 7, { text: 'Opus' })]]);
    expect(types(out[0])).toEqual(['logo-badge']);
    expect(types(out[1])).toEqual([]); // 2.8 s start vs previous end 0.4+2=2.4: 0.4 s < 2.5 s
  });
  it('an insert far enough after the previous one is kept', () => {
    const out = run([span(0, 5), span(20, 25)], [[cue('tool', 1, { text: 'Claude' })], [cue('tool', 21, { text: 'Opus' })]]); // 8.4 s start vs previous end 2.4 s + 2.5 s
    expect(types(out[1])).toEqual(['logo-badge']);
  });
  it('within one beat the higher priority insert wins (footage over logo-badge)', () => {
    const [t] = run([span(0, 7)], [[cue('tool', 1, { text: 'Claude' }), cue('ui', 2, { text: 'giao diện' })]], { matches: [screen] });
    expect(types(t)).toEqual(['footage']);
  });
});

describe('caption and camera suggestions', () => {
  it('hl holds the word indexes of emphasis and tool cues', () => {
    const [t] = run([span(0, 7)], [[cue('emphasis', 1, { text: 'rất' }), cue('tool', 4, { text: 'Claude' })]]);
    expect([...t.caption.hl].sort()).toEqual([1, 4]);
  });
  it('label captions respect captionMix.label (m1 at most 20% of beats, s1 at most one in ten)', () => {
    const spans = Array.from({ length: 10 }, (_, i) => span(i * 20, i * 20 + 5));
    const cues = spans.map(s => [cue('tool', s.firstWord + 1, { text: 'Claude' })]);
    const labels = (d: typeof m1) => run(spans, cues, { director: d }).filter(t => t.caption.variant === 'label').length;
    expect(labels(m1)).toBeGreaterThanOrEqual(1);
    expect(labels(m1)).toBeLessThanOrEqual(2);
    expect(labels(s1)).toBe(1);
  });
  it('bigRange is at most 3 words and inside the beat', () => {
    const [t] = run([span(10, 18)], [[cue('emphasis', 14, { text: 'đừng' })]], { n: 19 });
    const [a, b] = t.caption.bigRange!;
    expect(b - a + 1).toBeLessThanOrEqual(3);
    expect(a).toBeGreaterThanOrEqual(10);
    expect(b).toBeLessThanOrEqual(18);
    expect(a).toBeLessThanOrEqual(14);
    expect(b).toBeGreaterThanOrEqual(14);
  });
  it('bigRange at the edge of a beat stays inside it', () => {
    const [t] = run([span(0, 5)], [[cue('emphasis', 0, { text: 'đừng' })]]);
    expect(t.caption.bigRange).toEqual([0, 1]);
  });
  it('big captions are spaced by bigSpacingSec and never appear for s1', () => {
    const spans = [span(0, 5), span(10, 15), span(30, 35)]; // beats start at 0 s, 4 s, 12 s
    const cues = spans.map(s => [cue('emphasis', s.firstWord + 1, { text: 'đừng' })]);
    const out = run(spans, cues);
    expect(out.map(t => t.caption.bigRange !== null)).toEqual([true, false, true]);
    expect(run(spans, cues, { director: s1 }).every(t => t.caption.bigRange === null)).toBe(true);
  });
  it('punches are spaced by punchSpacingSec and sit just before the emphasis word', () => {
    const spans = [span(0, 5), span(6, 11), span(20, 25)]; // emphasis words at 0.4 s, 2.8 s, 8.4 s
    const cues = [[cue('emphasis', 1, { text: 'rất' })], [cue('emphasis', 7, { text: 'rất' })], [cue('emphasis', 21, { text: 'rất' })]];
    const out = run(spans, cues);
    expect(out.map(t => t.camera.length)).toEqual([1, 0, 1]);
    expect(out[0].camera[0]).toMatchObject({ type: 'zoom-punch', duration: 1.2 });
    expect(out[0].camera[0].at).toBeCloseTo(0.35, 5);
  });
});
