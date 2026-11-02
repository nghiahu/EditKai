import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

const card = (icon: string, title = 'EDIT VIDEO'): Layer => ({
  id: 't1', track: 'title', type: 'title-card', start: 0, end: 4, props: { icon, title, sub: 'Quy trình có sẵn' },
});
const chips = (labels: string[]): Layer => ({
  id: 'k1', track: 'graphic', type: 'chip-stack', start: 0, end: 4,
  props: { chips: labels.map(label => ({ icon: 'typography', label })) },
});
const bytes = async (p: ReturnType<typeof planOf>) => readFileSync(await stillOf(p, 20));

describe('TitleCard', () => {
  for (const style of ['s1', 'm1'] as const) {
    it(`renders in ${style}`, async () => {
      expect(statSync(await stillOf(planOf(style, [card('video')]), 20)).size).toBeGreaterThan(1000);
    }, 240000);
  }
  it('different titles give different pictures', async () => {
    expect((await bytes(planOf('s1', [card('video', 'A')]))).equals(await bytes(planOf('s1', [card('video', 'B')])))).toBe(false);
  }, 240000);
  it('unknown icon falls back to the check icon', async () => {
    expect((await bytes(planOf('s1', [card('zzz')]))).equals(await bytes(planOf('s1', [card('check')])))).toBe(true);
  }, 240000);
});

describe('ChipStack', () => {
  for (const style of ['s1', 'm1'] as const) {
    it(`renders in ${style}`, async () => {
      expect(statSync(await stillOf(planOf(style, [chips(['Typography', 'Graphic', 'Motion'])]), 20)).size).toBeGreaterThan(1000);
    }, 240000);
  }
  it('more chips give a different picture', async () => {
    expect((await bytes(planOf('m1', [chips(['A'])]))).equals(await bytes(planOf('m1', [chips(['A', 'B'])])))).toBe(false);
  }, 240000);
});
