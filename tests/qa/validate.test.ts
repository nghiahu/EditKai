import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validatePlan, type Ctx } from '../../src/qa/validate';
import { loadTheme } from '../../src/style/theme';
import type { Plan, Layer } from '../../src/plan/types';

const theme = loadTheme('styles/s1');
const plan = (): Plan => JSON.parse(readFileSync('tests/fixtures/plan.valid.json', 'utf8'));
const ctx = (over: Partial<Ctx> = {}): Ctx => ({ durationSec: 10, fileExists: () => true, ...over });
const codes = (p: Plan, c: Ctx = ctx()) => validatePlan(p, theme, c).map(i => `${i.severity}:${i.code}`);
const word = (t: string, s: number) => ({ t, s, e: s + 0.2, hl: false });

describe('validatePlan', () => {
  it('returns no issues for the valid fixture', () => {
    expect(codes(plan())).toEqual([]);
  });
  it('reports schema errors and stops', () => {
    const p = plan(); (p.layers[0] as any).track = 'music';
    expect(codes(p)).toEqual(['error:schema']);
  });
  it('reports track-overlap', () => {
    const p = plan();
    p.layers.push({ id: 'l3', track: 'title', type: 'title-card', start: 1, end: 2, props: { icon: 'x', title: 'y' } });
    expect(codes(p)).toContain('error:track-overlap');
  });
  it('reports missing-file for footage', () => {
    const p = plan();
    p.layers.push({ id: 'l3', track: 'footage', type: 'footage', start: 5, end: 6, props: { src: 'assets/none.mp4' } });
    expect(codes(p, ctx({ fileExists: () => false }))).toContain('error:missing-file');
  });
  it('reports out-of-bounds', () => {
    expect(codes(plan(), ctx({ durationSec: 3 }))).toContain('error:out-of-bounds');
  });
  it('reports out-of-bounds for a layer past a 0.8 s video', () => {
    expect(codes(plan(), ctx({ durationSec: 0.8 }))).toContain('error:out-of-bounds');
  });
  it('warns caption-too-long above maxCaptionWords', () => {
    const p = plan();
    p.layers[0].words = Array.from({ length: 9 }, (_, i) => word(`w${i}`, i * 0.3));
    expect(codes(p)).toContain('warning:caption-too-long');
  });
  it('warns scene-too-short', () => {
    const p = plan();
    p.scenes.push({ id: 'sc2', start: 5, end: 5.5, role: 'explainer' });
    expect(codes(p)).toContain('warning:scene-too-short');
  });
  it('warns text-overflow for a caption wider than the safe frame', () => {
    const p = plan();
    p.layers[0].words = [word('x'.repeat(80), 0.1)];
    expect(codes(p)).toContain('warning:text-overflow');
  });
  it('warns caption-sync-drift when no transcript word matches near the time', () => {
    const transcript = { words: [{ t: 'khác', s: 5, e: 5.2 }] };
    expect(codes(plan(), ctx({ transcript }))).toContain('warning:caption-sync-drift');
  });
  it('matches NFC and NFD forms of the same Vietnamese word', () => {
    const p = plan();
    p.layers[0].words = [word('Đây'.normalize('NFD'), 0.1)];
    const transcript = { words: [{ t: 'Đây'.normalize('NFC'), s: 0.12, e: 0.3 }] };
    expect(codes(p, ctx({ transcript }))).not.toContain('warning:caption-sync-drift');
  });
  it('reports duplicate-id', () => {
    const p = plan(); p.layers.push({ id: 'l1', track: 'graphic', type: 'transition', start: 6, end: 6.5, props: { kind: 'blur' } });
    expect(codes(p)).toContain('error:duplicate-id');
  });
  it('reports unknown-layer-type for a typo or a type on the wrong track', () => {
    const typo = plan(); typo.layers[1].type = 'title_card';
    expect(codes(typo)).toContain('error:unknown-layer-type');
    const wrongTrack = plan(); wrongTrack.layers[1].track = 'graphic';
    expect(codes(wrongTrack)).toContain('error:unknown-layer-type');
    const missing = plan(); delete (missing.layers[1] as any).type;
    expect(codes(missing)).toContain('error:unknown-layer-type');
  });
  it('reports invalid-props when a required prop is missing', () => {
    const p = plan(); p.layers[1].props = { icon: 'video' };
    expect(codes(p)).toContain('error:invalid-props');
    const t = plan();
    t.layers.push({ id: 'x', track: 'graphic', type: 'transition', start: 6, end: 6.5, props: { kind: 'wobble' } });
    expect(codes(t)).toContain('error:invalid-props');
  });
  describe('explainer-scene props', () => {
    const withScene = (props: Record<string, unknown>) => {
      const p = plan();
      p.layers.push({ id: 'e1', track: 'graphic', type: 'explainer-scene', start: 5, end: 8, props });
      return p;
    };
    it('accepts an old-style scene without mode and with body.kind "list"', () => {
      expect(codes(withScene({ title: 'X', body: { kind: 'list', items: ['a'] } }))).toEqual([]);
    });
    it('accepts every new mode and body kind', () => {
      for (const kind of ['list', 'card', 'waveform', 'phone']) expect(codes(withScene({ title: 'X', mode: 'overlay', body: { kind, items: ['a'] } }))).toEqual([]);
      expect(codes(withScene({ title: 'X', body: { kind: 'progress', items: [{ label: 'a', value: 50 }] } }))).toEqual([]);
    });
    it('rejects mode "side"', () => {
      expect(codes(withScene({ title: 'X', mode: 'side' }))).toContain('error:invalid-props');
    });
    it('rejects body.kind "chart"', () => {
      expect(codes(withScene({ title: 'X', body: { kind: 'chart', items: [] } }))).toContain('error:invalid-props');
    });
    it('does not throw and reports invalid-props for body null or items that are not an array', () => {
      expect(codes(withScene({ title: 'X', body: null }))).toContain('error:invalid-props');
      for (const kind of ['list', 'card', 'waveform', 'phone'])
        expect(codes(withScene({ title: 'X', body: { kind, items: 'Một, Hai' } }))).toContain('error:invalid-props');
    });
    it('rejects progress items that are plain strings', () => {
      expect(codes(withScene({ title: 'X', body: { kind: 'progress', items: ['a'] } }))).toContain('error:invalid-props');
    });
  });
  describe('camera layers', () => {
    const cam = (type: string, props: Record<string, unknown>, track: string = 'camera') => {
      const p = plan();
      p.layers.push({ id: 'cam1', track: track as any, type, start: 5, end: 6, props });
      return p;
    };
    it('accepts zoom-punch and shake on the camera track', () => {
      expect(codes(cam('zoom-punch', {}))).toEqual([]);
      expect(codes(cam('zoom-punch', { scale: 1.2, focus: { x: 0.2, y: 0.8 } }))).toEqual([]);
      expect(codes(cam('shake', { intensity: 2 }))).toEqual([]);
    });
    it('rejects zoom-punch scale 0.9 and 2, and focus.x 1.5 (Review Focus 3)', () => {
      expect(codes(cam('zoom-punch', { scale: 0.9 }))).toContain('error:invalid-props');
      expect(codes(cam('zoom-punch', { scale: 2 }))).toContain('error:invalid-props');
      expect(codes(cam('zoom-punch', { focus: { x: 1.5, y: 0.5 } }))).toContain('error:invalid-props');
    });
    it('rejects shake intensity 5', () => {
      expect(codes(cam('shake', { intensity: 5 }))).toContain('error:invalid-props');
    });
    it('rejects a camera type on the graphic track', () => {
      expect(codes(cam('zoom-punch', {}, 'graphic'))).toContain('error:unknown-layer-type');
    });
  });
  it('accepts every transition kind, including push and flash', () => {
    for (const kind of ['zoom', 'blur', 'slide', 'push', 'flash', 'whip', 'dip']) {
      const p = plan();
      p.layers.push({ id: 'tr', track: 'graphic', type: 'transition', start: 6, end: 6.5, props: { kind } });
      expect(codes(p)).toEqual([]);
    }
  });
  describe('quote-card and counter props', () => {
    const add = (type: string, props: Record<string, unknown>) => { const p = plan(); p.layers.push({ id: 'n1', track: 'graphic', type, start: 5, end: 7, props }); return p; };
    it('good props give no issues', () => {
      expect(codes(add('quote-card', { quote: 'Một câu nói', author: 'Ai đó' }))).toEqual([]);
      expect(codes(add('counter', { to: 1250, suffix: ' triệu', label: 'lượt xem' }))).toEqual([]);
    });
    it('a missing quote or a missing target is an invalid-props error naming the layer', () => {
      const q = validatePlan(add('quote-card', {}), theme, ctx()).filter(i => i.code === 'invalid-props');
      expect(q).toHaveLength(1);
      expect(q[0].layerId).toBe('n1');
      expect(codes(add('counter', { suffix: '%' }))).toContain('error:invalid-props');
    });
  });
  describe('caption props', () => {
    const withCaption = (props: Record<string, unknown> | undefined, words?: number | string[], start?: number, end?: number) => {
      const p = plan();
      const l = p.layers[0];
      l.props = props;
      if (words !== undefined) l.words = (Array.isArray(words) ? words : Array.from({ length: words }, (_, i) => `w${i}`)).map((t, i) => ({ t, s: 0.1 + i * 0.2, e: 0.2 + i * 0.2, hl: false }));
      if (start !== undefined) l.start = start;
      if (end !== undefined) l.end = end;
      return p;
    };
    it('accepts every variant, position and emphasis', () => {
      for (const variant of ['phrase', 'word', 'big']) expect(codes(withCaption({ variant }))).toEqual([]);
      expect(codes(withCaption({ variant: 'label', label: 'nó mở thêm' }))).toEqual([]);
      for (const position of ['top', 'center', 'bottom']) expect(codes(withCaption({ position }, undefined, 3.5, 4.2))).toEqual([]);
      for (const emphasis of ['box', 'ink', 'underline']) expect(codes(withCaption({ emphasis }))).toEqual([]);
      expect(codes(withCaption({ variant: 'big', handles: true }))).toEqual([]);
    });
    it('rejects variant "Phrase", position "middle" and emphasis 5', () => {
      for (const props of [{ variant: 'Phrase' }, { position: 'middle' }, { emphasis: 5 }]) expect(codes(withCaption(props))).toContain('error:invalid-props');
    });
    it('the label variant needs a non-empty string label, and a label must be a string', () => {
      for (const props of [{ variant: 'label' }, { variant: 'label', label: '' }, { variant: 'label', label: 3 }, { variant: 'phrase', label: 3 }])
        expect(codes(withCaption(props))).toContain('error:invalid-props');
      expect(codes(withCaption({ variant: 'label', label: 'x' }))).toEqual([]);
    });
    it('handles must be a boolean and true only with big', () => {
      expect(codes(withCaption({ variant: 'big', handles: 'yes' }))).toContain('error:invalid-props');
      expect(codes(withCaption({ variant: 'phrase', handles: true }))).toContain('error:invalid-props');
      expect(codes(withCaption({ variant: 'phrase', handles: false }))).toEqual([]);
    });
    it('big with 4 words warns caption-too-long, phrase with 4 words does not', () => {
      expect(codes(withCaption({ variant: 'big' }, 4))).toContain('warning:caption-too-long');
      expect(codes(withCaption({ variant: 'big' }, 3))).not.toContain('warning:caption-too-long');
      expect(codes(withCaption({ variant: 'phrase' }, 4))).not.toContain('warning:caption-too-long');
    });
    it('a 30-character word overflows in big but not in phrase (Review Focus 2)', () => {
      const word = ['x'.repeat(30)];
      expect(codes(withCaption({ variant: 'big' }, word))).toContain('warning:text-overflow');
      expect(codes(withCaption({ variant: 'phrase' }, word))).not.toContain('warning:text-overflow');
    });
    it('a long caption made of several short words wraps, so it does not warn text-overflow; only an unbreakable long word does', () => {
      const words = ['x'.repeat(10), 'y'.repeat(10), 'z'.repeat(10)];
      expect(codes(withCaption({ variant: 'big' }, words))).not.toContain('warning:text-overflow');
      expect(codes(withCaption({ variant: 'phrase' }, ['w'.repeat(10), 'w'.repeat(10), 'w'.repeat(10), 'w'.repeat(10), 'w'.repeat(10), 'w'.repeat(10)]))).not.toContain('warning:text-overflow');
    });
    it('a top caption overlapping the title card warns caption-overlaps-card; bottom and later ones do not', () => {
      expect(codes(withCaption({ position: 'top' }))).toContain('warning:caption-overlaps-card');
      expect(codes(withCaption({ position: 'bottom' }))).not.toContain('warning:caption-overlaps-card');
      expect(codes(withCaption({ position: 'top' }, undefined, 3.5, 4.2))).not.toContain('warning:caption-overlaps-card');
    });
    it('a chip-stack also counts as a card', () => {
      const p = withCaption({ position: 'top' }, undefined, 5, 6);
      p.layers.push({ id: 'k', track: 'graphic', type: 'chip-stack', start: 5.5, end: 7, props: { chips: [{ label: 'a' }] } });
      expect(codes(p)).toContain('warning:caption-overlaps-card');
    });
    it('an old caption without props still has no issues', () => {
      expect(codes(plan())).toEqual([]);
    });
  });
  describe('footage props', () => {
    const withFootage = (props: Record<string, unknown>) => {
      const p = plan();
      p.layers.push({ id: 'f1', track: 'footage', type: 'footage', start: 5, end: 7, props });
      return p;
    };
    it('accepts window, motion, from and a title', () => {
      expect(codes(withFootage({ src: 'assets/a.mp4', frame: 'window', motion: 'zoom-in', from: 2, title: 'Editor' }))).toEqual([]);
    });
    it('rejects from -1 and a title on a phone frame', () => {
      expect(codes(withFootage({ src: 'assets/a.mp4', from: -1 }))).toContain('error:invalid-props');
      expect(codes(withFootage({ src: 'assets/a.mp4', frame: 'phone', title: 'T' }))).toContain('error:invalid-props');
    });
    it('an old footage layer (src and fit only) still has no issues', () => {
      expect(codes(withFootage({ src: 'assets/a.mp4', fit: 'contain' }))).toEqual([]);
    });
  });
  describe('assets manifest', () => {
    it('warns asset-missing for every manifest entry whose file does not exist', () => {
      const present = new Set(['assets/here.mp4']);
      const issues = validatePlan(plan(), theme, ctx({
        fileExists: p => present.has(p),
        assets: [{ file: 'assets/here.mp4' }, { file: 'assets/gone.mp4' }, { file: 'assets/gone2.mp4' }],
      }));
      expect(issues.filter(i => i.code === 'asset-missing').map(i => i.severity)).toEqual(['warning', 'warning']);
      expect(issues.filter(i => i.code === 'asset-missing').map(i => i.message).join(' ')).toMatch(/gone\.mp4[\s\S]*gone2\.mp4/);
    });
    it('no warning when every listed file exists, or when there is no manifest', () => {
      expect(codes(plan(), ctx({ assets: [{ file: 'assets/a.mp4' }] }))).toEqual(['warning:asset-unused']); // listed, exists, but nothing uses it
      expect(codes(plan(), ctx())).toEqual([]);
    });
  });
  describe('logo-badge props', () => {
    const withBadge = (props: Record<string, unknown>) => {
      const p = plan();
      p.layers.push({ id: 'lb', track: 'graphic', type: 'logo-badge', start: 5, end: 7, props });
      return p;
    };
    it('accepts a bare badge and a full one', () => {
      expect(codes(withBadge({}))).toEqual([]);
      expect(codes(withBadge({ icon: 'rocket', label: 'Claude Opus 5.5', sub: 'mô hình', position: 'top', dim: true }))).toEqual([]);
      expect(codes(withBadge({ src: 'assets/logo.png' }))).toEqual([]);
    });
    it('rejects position "left", icon 3, src 3, label 5, sub 5 and dim "yes"', () => {
      for (const props of [{ position: 'left' }, { icon: 3 }, { src: 3 }, { label: 5 }, { sub: 5 }, { dim: 'yes' }])
        expect(codes(withBadge(props))).toContain('error:invalid-props');
    });
  });
  describe('prompt-box props', () => {
    const withPrompt = (props: Record<string, unknown>) => {
      const p = plan();
      p.layers.push({ id: 'pb', track: 'graphic', type: 'prompt-box', start: 5, end: 7, props });
      return p;
    };
    it('accepts a valid prompt box', () => {
      expect(codes(withPrompt({ text: 'Sửa giúp mình' }))).toEqual([]);
      expect(codes(withPrompt({ text: 'x', placeholder: 'y', strike: true, position: 'bottom', dim: true }))).toEqual([]);
    });
    it('rejects missing or empty text, strike "yes", position "left", placeholder 3, dim "yes"', () => {
      for (const props of [{}, { text: '' }, { text: 3 }, { text: 'x', strike: 'yes' }, { text: 'x', position: 'left' }, { text: 'x', placeholder: 3 }, { text: 'x', dim: 'yes' }])
        expect(codes(withPrompt(props))).toContain('error:invalid-props');
    });
  });
  describe('stat-card props', () => {
    const withCard = (props: Record<string, unknown>) => {
      const p = plan();
      p.layers.push({ id: 'sc', track: 'graphic', type: 'stat-card', start: 5, end: 7, props });
      return p;
    };
    const row = (value: unknown = '30 phút') => ({ icon: 'clock', value, caption: 'chờ Claude làm' });
    it('accepts one to four rows with optional icon, caption and title', () => {
      expect(codes(withCard({ rows: [row()] }))).toEqual([]);
      expect(codes(withCard({ rows: [row(), row(), row(), row()], title: 'Thời gian', position: 'top', dim: false }))).toEqual([]);
      expect(codes(withCard({ rows: [{ value: '5–10 phút' }] }))).toEqual([]);
    });
    it('rejects no rows, five rows, a row without value, an empty value, rows as a string, a title of 3', () => {
      for (const props of [{}, { rows: [] }, { rows: [row(), row(), row(), row(), row()] }, { rows: [{ icon: 'clock' }] }, { rows: [row('')] }, { rows: [row(5)] }, { rows: 'abc' }, { rows: [row()], title: 3 }, { rows: [row()], position: 'left' }, { rows: [{ value: 'x', icon: 3 }] }, { rows: [{ value: 'x', caption: 3 }] }, { rows: [null] }])
        expect(codes(withCard(props))).toContain('error:invalid-props');
    });
  });
  describe('footage overrun and prompt timing', () => {
    const footageLayer = (from: number, start: number, end: number, src = 'assets/a.mp4'): Layer => ({ id: 'fo', track: 'footage', type: 'footage', start, end, props: { src, from } });
    const withLayer = (l: Layer) => { const p = plan(); p.layers.push(l); return p; };
    const known = [{ file: 'assets/a.mp4', durationSec: 10 }, { file: 'assets/img.png' }];
    it('warns footage-overrun when from + layer length passes the clip duration in assets.json', () => {
      expect(codes(withLayer(footageLayer(8, 5, 9)), ctx({ assets: known }))).toContain('warning:footage-overrun'); // 8 s + 4 s passes the 10 s clip
      expect(codes(withLayer(footageLayer(9.5, 5, 6)), ctx({ assets: known }))).toContain('warning:footage-overrun');
    });
    it('no footage-overrun when it fits, when the asset has no duration, or when the clip is not listed', () => {
      expect(codes(withLayer(footageLayer(2, 5, 7)), ctx({ assets: known }))).not.toContain('warning:footage-overrun');
      expect(codes(withLayer(footageLayer(8, 5, 7)), ctx({ assets: known }))).not.toContain('warning:footage-overrun'); // 8 s + 2 s ends exactly at the clip end
      expect(codes(withLayer(footageLayer(8, 5, 7, 'assets/img.png')), ctx({ assets: known }))).not.toContain('warning:footage-overrun');
      expect(codes(withLayer(footageLayer(8, 5, 7, 'assets/other.mp4')), ctx({ assets: known }))).not.toContain('warning:footage-overrun');
      expect(codes(withLayer(footageLayer(8, 5, 7)), ctx())).not.toContain('warning:footage-overrun');
    });
    const prompt = (text: string, strike: boolean, start: number, end: number): Layer => ({ id: 'pb', track: 'graphic', type: 'prompt-box', start, end, props: { text, strike } });
    it('warns prompt-too-long when the text cannot be typed (and struck) within the layer', () => {
      expect(codes(withLayer(prompt('x'.repeat(60), false, 5, 6.5)))).toContain('warning:prompt-too-long');
      expect(codes(withLayer(prompt('x'.repeat(40), true, 5, 7)))).toContain('warning:prompt-too-long');
    });
    it('no prompt-too-long when typing and strike fit', () => {
      expect(codes(withLayer(prompt('Sửa chữ này to hơn', true, 5, 6.7)))).not.toContain('warning:prompt-too-long');
      expect(codes(withLayer(prompt('x'.repeat(28), false, 5, 6.5)))).not.toContain('warning:prompt-too-long');
    });
  });
  describe('a hand-edited manifest never crashes validation', () => {
    it('entries without a string file are skipped by validatePlan', () => {
      expect(() => validatePlan(plan(), theme, ctx({ assets: [{} as any, { file: 3 } as any, null as any] }))).not.toThrow();
    });
  });
});

describe('density checks (director)', () => {
  const m1 = loadTheme('styles/m1');
  const badge = (id: string, start: number, end: number, props: Record<string, unknown> = { label: 'Claude' }, type = 'logo-badge', track: Layer['track'] = 'graphic'): Layer => ({ id, track, type, start, end, props });
  const issues = (p: Plan, t = theme, c: Ctx = ctx()) => validatePlan(p, t, c);
  const gaps = (p: Plan, t = theme, c: Ctx = ctx()) => issues(p, t, c).filter(i => i.code === 'insert-gap');
  /** A plan whose only inserts are the given layers (the fixture title is removed). */
  const only = (...layers: Layer[]): Plan => { const p = plan(); p.layers = [p.layers[0], ...layers]; return p; };

  it('a gap longer than the style limit warns insert-gap and a shorter one does not (m1 10 s vs s1 35 s, same plan)', () => {
    const p = only(badge('a', 0, 2), badge('b', 14, 16));
    expect(gaps(p, m1, ctx({ durationSec: 16 })).map(i => i.severity)).toEqual(['warning']);
    expect(gaps(p, theme, ctx({ durationSec: 16 }))).toEqual([]);
  });
  it('gaps are measured from the start and to the end of the video', () => {
    const p = only(badge('a', 12, 13));
    const g = gaps(p, m1, ctx({ durationSec: 25 }));
    expect(g).toHaveLength(2);
    expect(g[0].message).toMatch(/0/);
    expect(g[1].message).toMatch(/25/);
  });
  it('transition layers do not count as inserts, and overlapping inserts merge', () => {
    const t: Layer = { id: 't', track: 'graphic', type: 'transition', start: 5, end: 6, props: { kind: 'zoom' } };
    const p = only(badge('a', 0, 1), t);
    expect(gaps(p, m1, ctx({ durationSec: 13 }))).toHaveLength(1); // 1 s to 13 s; counting the transition would split it into 4 s and 7 s
    const q = only(badge('a', 0, 6), badge('b', 5, 12, { src: 'x' }, 'footage', 'footage'));
    expect(gaps(q, m1, ctx({ durationSec: 12 }))).toEqual([]);
  });
  it('only 5 gap warnings are listed, then a summary', () => {
    const layers = Array.from({ length: 9 }, (_, i) => badge('g' + i, i * 20, i * 20 + 1));
    const g = gaps(only(...layers), m1, ctx({ durationSec: 200 }));
    expect(g).toHaveLength(6);
    expect(g[5].message).toMatch(/khoảng trống khác/);
  });
  it('an unused asset warns and a used one does not (footage src and logo-badge src)', () => {
    const p = only(badge('f', 0, 3, { src: 'assets/a.mp4' }, 'footage', 'footage'), badge('l', 4, 6, { label: 'x', src: 'assets/logo.png' }));
    const assets = [{ file: 'assets/a.mp4' }, { file: 'assets/logo.png' }, { file: 'assets/b.mp4' }];
    const w = issues(p, theme, ctx({ assets })).filter(i => i.code === 'asset-unused');
    expect(w).toHaveLength(1);
    expect(w[0].message).toContain('assets/b.mp4');
  });
  it('a top caption over a top prompt-box warns, over a bottom one does not', () => {
    const mk = (position: string) => { const p = only(badge('p', 0, 3, { text: 'hi', position }, 'prompt-box')); p.layers[0].props = { position: 'top' }; return p; };
    expect(issues(mk('top')).map(i => i.code)).toContain('caption-overlaps-card');
    expect(issues(mk('bottom')).map(i => i.code)).not.toContain('caption-overlaps-card');
  });
  it('a centred big caption over a centred stat-card warns', () => {
    const p = only(badge('s', 0, 3, { rows: [{ value: '1' }] }, 'stat-card'));
    p.layers[0].props = { variant: 'big' };
    expect(issues(p).map(i => i.code)).toContain('caption-overlaps-card');
    p.layers[1].props = { rows: [{ value: '1' }], position: 'bottom' };
    expect(issues(p).map(i => i.code)).not.toContain('caption-overlaps-card');
  });
});

describe('caption legibility', () => {
  const bright = (id: string, v: number) => ({ captionBright: new Map([[id, v]]) });
  it('text over a near-white picture without a plate warns caption-low-contrast', () => {
    const w = validatePlan(plan(), theme, ctx(bright('l1', 0.5))).filter(i => i.code === 'caption-low-contrast');
    expect(w).toHaveLength(1);
    expect(w[0].severity).toBe('warning');
    expect(w[0].layerId).toBe('l1');
  });
  it('a plate, or a picture that is not mostly white behind the text, does not warn', () => {
    const p = plan(); p.layers[0].props = { backdrop: 'plate' };
    expect(validatePlan(p, theme, ctx(bright('l1', 0.5))).filter(i => i.code === 'caption-low-contrast')).toEqual([]);
    expect(validatePlan(plan(), theme, ctx(bright('l1', 0.05))).filter(i => i.code === 'caption-low-contrast')).toEqual([]);
    expect(validatePlan(plan(), theme, ctx()).filter(i => i.code === 'caption-low-contrast')).toEqual([]);
  });
});

describe("checks against the speaker's face", () => {
  const m1 = loadTheme('styles/m1');
  const face = (box: { x: number; y: number; w: number; h: number }, to = 10): Ctx['faces'] => ({ fps: 4, samples: Array.from({ length: to * 4 + 1 }, (_, i) => ({ t: i / 4, box, conf: 0.99 })) });
  const middle = { x: 0.4, y: 0.25, w: 0.2, h: 0.3 };
  const only = (...layers: Layer[]): Plan => { const p = plan(); p.layers = [p.layers[0], ...layers]; return p; };
  const card = (props: Record<string, unknown> = {}): Layer => ({ id: 'g1', track: 'graphic', type: 'stat-card', start: 2, end: 5, props: { rows: [{ value: '30 phút' }], ...props } } as Layer);
  const codes = (p: Plan, c: Ctx) => validatePlan(p, m1, c).filter(i => i.code.endsWith('-on-face'));

  it('a card over the face warns insert-on-face and suggests another position', () => {
    const [w] = codes(only(card()), ctx({ faces: face(middle) }));
    expect(w.code).toBe('insert-on-face');
    expect(w.layerId).toBe('g1');
    expect(w.severity).toBe('warning');
    expect(w.message).toMatch(/top|bottom/);
  });
  it('is quiet when the card clears the face, when the face is not there then, or when there are no faces', () => {
    expect(codes(only(card({ position: 'bottom' })), ctx({ faces: face({ x: 0.4, y: 0.02, w: 0.2, h: 0.2 }) }))).toEqual([]);
    expect(codes(only(card()), ctx({ faces: { fps: 4, samples: [{ t: 8, box: middle, conf: 0.99 }] } }))).toEqual([]);
    expect(codes(only(card()), ctx())).toEqual([]);
  });
  it('a caption over the face warns caption-on-face; a caption below it does not', () => {
    const cap = (position: string): Layer => ({ id: 'c9', track: 'caption', start: 1, end: 2, props: { position }, words: [{ t: 'xin', s: 1, e: 1.3, hl: false }] } as Layer);
    const base = plan();
    const withCap = (position: string): Plan => ({ ...base, layers: [...base.layers.filter(l => l.track !== 'caption'), cap(position)] });
    expect(codes(withCap('center'), ctx({ faces: face(middle) })).map(i => i.code)).toEqual(['caption-on-face']);
    expect(codes(withCap('bottom'), ctx({ faces: face({ x: 0.4, y: 0.05, w: 0.2, h: 0.3 }) }))).toEqual([]);
    // m1 puts its captions at chin height: covering the lowest part of the face box is normal, not "on the face"
    const lowerThird = { x: 0.4, y: 0.2, w: 0.2, h: 0.5 }; // the m1 band starts at 0.54 of the frame height: it covers the lowest third of this face box
    expect(codes(withCap('bottom'), ctx({ faces: face(lowerThird) }))).toEqual([]);
  });
});
