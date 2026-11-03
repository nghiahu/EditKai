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
    for (const kind of ['zoom', 'blur', 'slide', 'push', 'flash']) {
      const p = plan();
      p.layers.push({ id: 'tr', track: 'graphic', type: 'transition', start: 6, end: 6.5, props: { kind } });
      expect(codes(p)).toEqual([]);
    }
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
});
