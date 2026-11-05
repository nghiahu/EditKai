import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { blankStill, inkBox, planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

const pts = (...values: number[]) => values.map((value, i) => ({ label: `${2020 + i}`, value }));
const chart = (props: Record<string, unknown>): Layer => ({ id: 'c1', track: 'graphic', type: 'chart', start: 0, end: 4, props } as Layer);
const png = (props: Record<string, unknown>, frame: number, style: 's1' | 'm1' = 'm1') => stillOf(planOf(style, [chart(props)]), frame);
const bytes = async (props: Record<string, unknown>, frame: number, style: 's1' | 'm1' = 'm1') => readFileSync(await png(props, frame, style));
const T = 300000;

describe('chart', () => {
  it('builds up (frames 4, 14 and 55 differ) and the last frame is as blank as the picture', async () => {
    const p = { kind: 'bar', points: pts(20, 50, 35), title: 'LƯỢT XEM', source: 'YouTube Studio' };
    const [a, b, c] = [await bytes(p, 4), await bytes(p, 14), await bytes(p, 55)];
    expect(a.equals(b)).toBe(false);
    expect(b.equals(c)).toBe(false);
    expect((await bytes(p, 119)).equals(readFileSync(await blankStill('m1', 119)))).toBe(true);
  }, T);
  it('bar and line charts, in both styles, draw something and differ from each other', async () => {
    for (const style of ['s1', 'm1'] as const) {
      const bar = await bytes({ kind: 'bar', points: pts(20, 50, 35) }, 55, style);
      const line = await bytes({ kind: 'line', points: pts(20, 50, 35) }, 55, style);
      expect(bar.length).toBeGreaterThan(1000);
      expect(bar.equals(line)).toBe(false);
    }
  }, T);
  it('the numbers matter: the same labels with other values give another picture, for both kinds', async () => {
    for (const kind of ['bar', 'line']) {
      expect((await bytes({ kind, points: pts(10, 40) }, 55)).equals(await bytes({ kind, points: pts(40, 10) }, 55))).toBe(false);
    }
  }, T);
  it('title, source, unit and position each change the picture', async () => {
    const base = await bytes({ kind: 'bar', points: pts(10, 40) }, 55);
    for (const extra of [{ title: 'DOANH THU' }, { source: 'Báo cáo nội bộ' }, { unit: '%' }, { position: 'top' }]) {
      expect((await bytes({ kind: 'bar', points: pts(10, 40), ...extra }, 55)).equals(base)).toBe(false);
    }
  }, T);
  it('six points with long labels stay inside the frame', async () => {
    const labels = ['Tháng một', 'Tháng hai', 'Tháng ba', 'Tháng tư', 'Tháng năm', 'Tháng sáu'];
    const box = await inkBox(await png({ kind: 'bar', points: labels.map((label, i) => ({ label, value: 10 + i * 7 })), title: 'x'.repeat(40), source: 'y'.repeat(60) }, 55));
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.w).toBeLessThanOrEqual(1080);
  }, T);
});
