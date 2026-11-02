import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { blankStill, planOf, stillOf } from './helper';
import { clampPercent } from '../../remotion/components/ExplainerScene';
import type { Layer } from '../../src/plan/types';

const scene = (props: Record<string, unknown> = {}): Layer => ({
  id: 'e1', track: 'graphic', type: 'explainer-scene', start: 0, end: 4,
  props: { label: 'NHÃN', title: 'TIÊU ĐỀ', body: { kind: 'list', items: ['Một', 'Hai', 'Ba'] }, avatar: false, ...props },
});
const bytes = async (style: 's1' | 'm1', frame: number, layer: Layer) => readFileSync(await stillOf(planOf(style, [layer]), frame));
const body = (kind: string, items: unknown[]) => ({ body: { kind, items } });

describe('clampPercent', () => {
  it('clamps to 0..100 and treats NaN as 0', () => {
    expect([clampPercent(-20), clampPercent(250), clampPercent(42), clampPercent(NaN)]).toEqual([0, 100, 42, 0]);
  });
});

describe('ExplainerScene motion', () => {
  it('waveform, progress and phone each differ from list at frame 40', async () => {
    const list = await bytes('s1', 40, scene());
    for (const b of [body('waveform', ['nhãn']), body('progress', [{ label: 'A', value: 60 }, { label: 'B', value: 90 }]), body('phone', ['Xin chào', 'Chào bạn'])])
      expect((await bytes('s1', 40, scene(b))).equals(list)).toBe(false);
  }, 400000);
  it('overlay differs from full at frame 40, for both styles', async () => {
    for (const s of ['s1', 'm1'] as const)
      expect((await bytes(s, 40, scene({ mode: 'overlay' }))).equals(await bytes(s, 40, scene()))).toBe(false);
  }, 400000);
  it('overlay leaves the frame outside its card untouched (transparent background)', async () => {
    // a body-less overlay differs from blank only by the card, so frame 40 of overlay != blank, but is not a full-bleed fill:
    const overlay = await bytes('m1', 40, scene({ mode: 'overlay', body: undefined, label: undefined }));
    const full = await bytes('m1', 40, scene({ body: undefined, label: undefined }));
    expect(overlay.length).toBeLessThan(full.length); // a full-bleed gradient compresses worse than a small card on a flat background
  }, 240000);
  it('the full background drifts: frames 30 and 100 differ even with no items', async () => {
    const empty = scene({ body: undefined });
    expect((await bytes('s1', 30, empty)).equals(await bytes('s1', 100, empty))).toBe(false);
    expect((await bytes('m1', 30, empty)).equals(await bytes('m1', 100, empty))).toBe(false);
  }, 240000);
  it('progress with values -20 and 250, and scenes with an empty list or a missing label, render (Review Focus 5)', async () => {
    for (const l of [scene(body('progress', [{ label: 'neg', value: -20 }, { label: 'big', value: 250 }])), scene({ body: { kind: 'list', items: [] } }), scene({ label: undefined }), scene(body('waveform', []))])
      expect(statSync(await stillOf(planOf('m1', [l]), 40)).size).toBeGreaterThan(1000);
  }, 400000);
  it('the last frame equals a blank frame in both modes', async () => {
    for (const mode of ['full', 'overlay'])
      expect((await bytes('s1', 119, scene({ mode }))).equals(readFileSync(await blankStill('s1', 119)))).toBe(true);
  }, 400000);
});
