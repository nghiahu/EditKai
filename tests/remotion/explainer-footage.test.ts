import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { planOf, stillOf } from './helper';
import { transitionStyle } from '../../remotion/transition';
import type { Layer } from '../../src/plan/types';

const explainer = (over: Record<string, unknown> = {}): Layer => ({
  id: 'e1', track: 'graphic', type: 'explainer-scene', start: 0, end: 4,
  props: { label: 'TỪ FOOTAGE GỐC', title: 'EDIT TỪNG LỚP', body: { kind: 'list', items: ['Làm gọn lời nói'] }, avatar: false, ...over },
});
const bytes = async (layers: Layer[], style: 's1' | 'm1' = 's1') => readFileSync(await stillOf(planOf(style, layers), 20));

describe('ExplainerScene', () => {
  for (const style of ['s1', 'm1'] as const) {
    it(`renders in ${style}`, async () => {
      expect(statSync(await stillOf(planOf(style, [explainer()]), 20)).size).toBeGreaterThan(1000);
    }, 240000);
  }
  it('body items change the picture', async () => {
    const a = await bytes([explainer()]);
    const b = await bytes([explainer({ body: { kind: 'list', items: ['Làm gọn lời nói', 'Phụ đề sát giọng'] } })]);
    expect(a.equals(b)).toBe(false);
  }, 240000);
  it('avatar toggles a circle', async () => {
    expect((await bytes([explainer({ avatar: false })])).equals(await bytes([explainer({ avatar: true })]))).toBe(false);
  }, 240000);
});

describe('Footage', () => {
  it('renders a placeholder frame (no throw) when the file cannot be loaded', async () => {
    const l: Layer = { id: 'f1', track: 'footage', type: 'footage', start: 0, end: 4, props: { src: 'http://127.0.0.1:1/none.png' } };
    expect(statSync(await stillOf(planOf('s1', [l]), 20)).size).toBeGreaterThan(1000);
  }, 240000);
});

describe('transitionStyle', () => {
  const tr = (kind: string): Layer => ({ id: 't', track: 'graphic', type: 'transition', start: 2, end: 3, props: { kind } });
  it('is identity outside any transition', () => {
    expect(transitionStyle([tr('zoom')], 1)).toEqual({});
    expect(transitionStyle([tr('zoom')], 3.5)).toEqual({});
  });
  it('zoom scales up in the middle', () => {
    expect(transitionStyle([tr('zoom')], 2.5).transform).toMatch(/scale\(1\.1/);
  });
  it('blur adds a blur filter in the middle', () => {
    expect(transitionStyle([tr('blur')], 2.5).filter).toMatch(/blur\(/);
  });
  it('slide translates in the middle', () => {
    expect(transitionStyle([tr('slide')], 2.5).transform).toMatch(/translateX\(/);
  });
});

describe('Transition layer', () => {
  it('renders a frame without throwing', async () => {
    const l: Layer = { id: 't', track: 'graphic', type: 'transition', start: 0, end: 4, props: { kind: 'blur' } };
    expect(statSync(await stillOf(planOf('m1', [l]), 20)).size).toBeGreaterThan(1000);
  }, 240000);
});
