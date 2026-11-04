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
    expect(types(out[1])).toHaveLength(1); // the type itself rotates now (see the playbook tests)
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

import { DEFAULT_PLAYBOOK, fillProps, loadPlaybook, type Playbook, type Recipe } from '../../src/director/playbook';

const recipe = (id: string, type: string, props: Record<string, unknown> = { title: '{TEXT}' }, duration = 2): Recipe => ({ id, type, duration, props });
const withPlaybook = (pb: Partial<Playbook>): Playbook => ({ situations: { ...DEFAULT_PLAYBOOK.situations, ...pb.situations }, variety: { ...DEFAULT_PLAYBOOK.variety, ...pb.variety } });
const runPb = (spans: BeatSpan[], cues: Cue[][], playbook: Playbook, director = m1) =>
  suggestTreatments({ spans, cues, matches: spans.map(() => undefined), words: words(Math.max(...spans.map(s => s.lastWord)) + 1), director, fps: FPS, playbook });

describe('playbook: section and cta', () => {
  it('a section cue is a title card that says the label; a cta cue too (default playbook)', () => {
    const [a] = run([span(0, 5)], [[cue('section', 1, { text: 'MỞ BÀI' })]]);
    expect(a.inserts[0]).toMatchObject({ type: 'title-card', props: { title: 'MỞ BÀI' }, duration: 2.6 });
    expect(a.inserts[0].at).toBeCloseTo(0.4, 5);
    const [b] = run([span(0, 5)], [[cue('cta', 2, { text: 'ĐĂNG KÝ KÊNH' })]], { director: s1 });
    expect(b.inserts[0]).toMatchObject({ type: 'title-card', props: { title: 'ĐĂNG KÝ KÊNH' } });
  });
  it('a section wins over a tool cue in the same beat (priority), and the tool insert is dropped by the min gap', () => {
    const [t] = run([span(0, 7)], [[cue('tool', 1, { text: 'Claude' }), cue('section', 2, { text: 'KẾT BÀI' })]]);
    expect(t.inserts.map(i => i.type)).toEqual(['title-card']);
  });
});

describe('playbook: variety', () => {
  const far = (n: number) => Array.from({ length: n }, (_, i) => span(i * 40, i * 40 + 5)); // beats 16 s apart
  const tool = (s: BeatSpan, text = 'Claude') => [cue('tool', s.firstWord + 1, { text })];
  it('rotates: the same situation twice gives different recipes, the third goes back to the first', () => {
    const spans = far(3);
    const out = run(spans, spans.map(s => tool(s)));
    expect(out.map(t => t.inserts[0].type)).toEqual(['logo-badge', 'title-card', 'logo-badge']);
  });
  it('rotation can be turned off: the first recipe every time', () => {
    const spans = far(3);
    const out = runPb(spans, spans.map(s => tool(s)), withPlaybook({ variety: { rotate: false, maxShare: {}, sameTypeGapSec: 0 } }));
    expect(out.map(t => t.inserts[0].type)).toEqual(['logo-badge', 'logo-badge', 'logo-badge']);
  });
  it('maxShare: a type that already holds more than its share of the inserts is skipped once there are enough inserts', () => {
    const spans = far(6);
    const pb = withPlaybook({ situations: { tool: [recipe('only', 'title-card')] }, variety: { rotate: true, maxShare: { 'title-card': 0.5 }, sameTypeGapSec: 0 } });
    const out = runPb(spans, spans.map(s => tool(s)), pb);
    const total = out.reduce((n, t) => n + t.inserts.filter(i => !i.maybe).length, 0); // fillers are another matter
    expect(total).toBe(4); // the first four are kept (too few inserts to judge), the others would push the share over 50%
  });
  it('sameTypeGapSec: two inserts of one type closer than the gap use another recipe, or are skipped when there is none', () => {
    const spans = [span(0, 5), span(10, 15)]; // 4 s apart, the first ends at 0.4 + 2 s
    const two = withPlaybook({ situations: { tool: [recipe('a', 'title-card'), recipe('b', 'logo-badge', { label: '{text}' })] }, variety: { rotate: false, maxShare: {}, sameTypeGapSec: 10 } });
    expect(runPb(spans, spans.map(s => tool(s)), two, { ...m1, insertMinGapSec: 0.5 }).map(t => t.inserts.map(i => i.type))).toEqual([['title-card'], ['logo-badge']]);
    const one = withPlaybook({ situations: { tool: [recipe('a', 'title-card')] }, variety: { rotate: false, maxShare: {}, sameTypeGapSec: 10 } });
    expect(runPb(spans, spans.map(s => tool(s)), one, { ...m1, insertMinGapSec: 0.5 }).map(t => t.inserts.length)).toEqual([1, 0]);
  });
  it('a recipe whose type the style does not allow is never chosen', () => {
    const spans = far(2);
    const pb = withPlaybook({ situations: { tool: [recipe('a', 'prompt-box', { text: 'x' }), recipe('b', 'logo-badge', { label: '{text}' })] } });
    const out = runPb(spans, spans.map(s => tool(s)), pb, s1); // s1 does not allow prompt-box
    expect(out.map(t => t.inserts[0].type)).toEqual(['logo-badge', 'logo-badge']);
  });
  it('the number situation rotates too, and the title version says the number in capitals', () => {
    const spans = far(2);
    const out = run(spans, [[cue('number', 1, { text: '2-3%' })], [cue('number', 41, { text: '30 phút' })]]);
    expect(out[0].inserts[0].type).toBe('stat-card');
    expect(out[1].inserts[0]).toMatchObject({ type: 'title-card', props: { title: '30 PHÚT' } });
  });
  it('without a playbook argument the default playbook is used', () => {
    const spans = far(2);
    expect(suggestTreatments({ spans, cues: spans.map(s => tool(s)), matches: [undefined, undefined], words: words(50), director: m1, fps: FPS }))
      .toEqual(runPb(spans, spans.map(s => tool(s)), DEFAULT_PLAYBOOK));
  });
});

describe('playbook: every recipe says something', () => {
  it('the second recipe of a section (a badge) carries the section text as its label, not an empty string', () => {
    const spans = [span(0, 5), span(40, 45)];
    const out = run(spans, [[cue('section', 1, { text: 'MỞ BÀI' })], [cue('section', 41, { text: 'THÂN BÀI' })]]);
    expect(out[1].inserts[0]).toMatchObject({ type: 'logo-badge', props: { label: 'THÂN BÀI' } });
  });
  it('no shipped recipe fills a prop with an empty string for any situation', () => {
    for (const [name, pb] of [['default', DEFAULT_PLAYBOOK], ['m1', loadPlaybook('styles/m1')], ['s1', loadPlaybook('styles/s1')]] as const) {
      for (const [situation, recipes] of Object.entries(pb.situations)) {
        for (const rec of recipes.filter(x => x.props)) {
          const filled = JSON.stringify(fillProps(rec.props!, { text: 'Chữ', label: situation === 'tool' ? 'công cụ' : undefined }));
          expect(filled, `${name} ${rec.id}`).not.toMatch(/":""/);
        }
      }
    }
  });
});

describe('gap filler (insert-gap, suggested with maybe: true)', () => {
  const NAMES = ['một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười'];
  /** n beats of 5 words (2 s each), real words so the filler's title can be checked. */
  const timeline = (n: number) => {
    const w = Array.from({ length: n * 5 }, (_, i) => ({ t: NAMES[i % NAMES.length] + (i < 100 ? '' : ''), s: i * 0.4, e: i * 0.4 + 0.3 }));
    const spans = Array.from({ length: n }, (_, i): BeatSpan => ({ firstWord: i * 5, lastWord: i * 5 + 4, start: i * 2, end: i * 2 + 1.9, text: w.slice(i * 5, i * 5 + 5).map(x => x.t).join(' ') }));
    return { w, spans };
  };
  const go = (n: number, cues: Cue[][] = [], opts: { director?: typeof m1; playbook?: Playbook } = {}) => {
    const { w, spans } = timeline(n);
    const out = suggestTreatments({ spans, cues: spans.map((_, i) => cues[i] ?? []), matches: spans.map(() => undefined), words: w, director: opts.director ?? m1, fps: FPS, playbook: opts.playbook });
    return { out, w, spans, inserts: out.flatMap(t => t.inserts).sort((a, b) => a.at - b.at) };
  };
  const biggestGap = (inserts: { at: number; duration: number }[], end: number) => {
    let cursor = 0, worst = 0;
    for (const i of inserts) { worst = Math.max(worst, i.at - cursor); cursor = Math.max(cursor, i.at + i.duration); }
    return Math.max(worst, end - cursor);
  };

  it('a long talk with no cues gets fillers so that no stretch is longer than insertGapMaxSec, each marked maybe', () => {
    const { inserts, w } = go(15); // 30 s, m1 allows 10 s
    expect(inserts.length).toBeGreaterThanOrEqual(2);
    expect(inserts.every(i => i.maybe === true)).toBe(true);
    expect(biggestGap(inserts, w[w.length - 1].e + 0.5)).toBeLessThanOrEqual(m1.insertGapMaxSec + 1e-6);
  });
  it('no filler where there is no gap: a short talk, or inserts already close enough', () => {
    expect(go(4).inserts).toEqual([]); // 8 s
    const cues = Array.from({ length: 15 }, (_, i) => (i % 3 === 0 ? [cue('tool', i * 5 + 1, { text: 'Claude' })] : [])); // a real insert every 6 s
    const { inserts } = go(15, cues);
    expect(inserts.filter(i => i.maybe)).toEqual([]);
  });
  it('s1 tolerates 35 s, so 30 s of talk gets none', () => {
    expect(go(15, [], { director: s1 }).inserts).toEqual([]);
  });
  it('a filler keeps insertMinGapSec from the inserts around it, and a different type waits sameTypeGapSec after the same type', () => {
    const { inserts } = go(30, [[cue('tool', 40, { text: 'Claude' })]]);
    inserts.forEach((i, k) => { if (k) expect(i.at).toBeGreaterThanOrEqual(inserts[k - 1].at + inserts[k - 1].duration + m1.insertMinGapSec - 1e-6); });
  });
  it('the title is made of the beat\'s own words in capitals, short, and never empty', () => {
    const { inserts, spans, w } = go(15);
    for (const i of inserts) {
      const title = String((i.props as { title?: string; label?: string }).title ?? (i.props as { label?: string }).label);
      expect(title.length).toBeGreaterThan(0);
      expect(title.length).toBeLessThanOrEqual(30);
      expect(title).toBe(title.toUpperCase());
      const beat = spans.find(s => s.start <= i.at + 1e-6 && i.at <= s.end + 1e-6)!;
      const own = w.slice(beat.firstWord, beat.lastWord + 1).map(x => x.t.toUpperCase());
      expect(title.split(' ').every(word => own.includes(word))).toBe(true);
    }
  });
  it('an emphasised word of the beat is what the title is built around', () => {
    const emph: Cue[][] = Array.from({ length: 15 }, (_, i) => [cue('emphasis', i * 5 + 2, { text: NAMES[(i * 5 + 2) % 10] })]);
    const { inserts, spans, w } = go(15, emph);
    const filler = inserts.filter(i => i.maybe);
    expect(filler.length).toBeGreaterThan(0);
    for (const i of filler) {
      const beat = spans.find(s => s.start <= i.at + 1e-6 && i.at <= s.end + 1e-6)!;
      const word = w[beat.firstWord + 2].t.toUpperCase();
      expect(String((i.props as { title?: string; label?: string }).title ?? (i.props as { label?: string }).label)).toContain(word);
    }
  });
  it('uses another allowed type when title-card is not allowed, and nothing when no recipe fits', () => {
    const badge = go(15, [], { director: { ...m1, allowedInserts: ['logo-badge'] } }).inserts;
    expect(badge.length).toBeGreaterThan(0);
    expect(badge.every(i => i.type === 'logo-badge')).toBe(true);
    expect(go(15, [], { director: { ...m1, allowedInserts: ['stat-card'] } }).inserts).toEqual([]);
    expect(go(15, [], { playbook: withPlaybook({ situations: { filler: [] } }) }).inserts).toEqual([]);
  });
  it('a long talk (400 beats) finishes at once and still leaves no long gap', () => {
    const t0 = Date.now();
    const { inserts, w } = go(400);
    expect(Date.now() - t0).toBeLessThan(3000);
    expect(biggestGap(inserts, w[w.length - 1].e + 0.5)).toBeLessThanOrEqual(m1.insertGapMaxSec + 1e-6);
  });
  it('no beats, no crash', () => {
    expect(suggestTreatments({ spans: [], cues: [], matches: [], words: [], director: m1, fps: FPS })).toEqual([]);
  });
});

describe('gap filler placed before a later insert of the same type', () => {
  it('a title-card later in the talk does not forbid a title-card filler earlier (the same-type gap counts in both directions)', () => {
    const NAMES = ['một', 'hai', 'ba', 'bốn', 'năm'];
    const w = Array.from({ length: 75 }, (_, i) => ({ t: NAMES[i % 5], s: i * 0.4, e: i * 0.4 + 0.3 }));
    const spans = Array.from({ length: 15 }, (_, i): BeatSpan => ({ firstWord: i * 5, lastWord: i * 5 + 4, start: i * 2, end: i * 2 + 1.9, text: '' }));
    const cues: Cue[][] = spans.map((_, i) => (i === 10 ? [cue('section', 51, { text: 'KẾT BÀI' })] : []));
    const pb = withPlaybook({ variety: { rotate: false, maxShare: {}, sameTypeGapSec: 6 }, situations: { filler: [recipe('f', 'title-card', { title: '{TEXT}' }, 2)] } });
    const out = suggestTreatments({ spans, cues, matches: spans.map(() => undefined), words: w, director: m1, fps: FPS, playbook: pb });
    const inserts = out.flatMap(t => t.inserts).sort((a, b) => a.at - b.at);
    expect(inserts.some(i => i.maybe && i.at < 18)).toBe(true);
  });
});
