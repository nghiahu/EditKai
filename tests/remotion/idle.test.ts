import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

const layers: Record<string, Layer> = {
  'stat-card': { id: 'l', track: 'graphic', type: 'stat-card', start: 0, end: 4, props: { rows: [{ value: '30 phút' }] } } as Layer,
  'quote-card': { id: 'l', track: 'graphic', type: 'quote-card', start: 0, end: 4, props: { quote: 'Không cần hoàn hảo khi bắt đầu' } } as Layer,
  chart: { id: 'l', track: 'graphic', type: 'chart', start: 0, end: 4, props: { kind: 'bar', points: [{ label: 'a', value: 1 }, { label: 'b', value: 3 }] } } as Layer,
  'step-number': { id: 'l', track: 'graphic', type: 'step-number', start: 0, end: 4, props: { number: 2, title: 'MỞ MÁY' } } as Layer,
};

describe('a card that is held on screen keeps moving a little (it breathes), once it has settled', () => {
  for (const [type, layer] of Object.entries(layers)) {
    it(`${type}: frames 60 and 75 differ`, async () => {
      const at = async (f: number) => readFileSync(await stillOf(planOf('m1', [layer]), f));
      expect((await at(60)).equals(await at(75))).toBe(false);
    }, 300000);
  }
});
