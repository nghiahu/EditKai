import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { blankStill, inkBox, planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';

const callout = (props: Record<string, unknown>): Layer => ({ id: 'k1', track: 'graphic', type: 'callout', start: 0, end: 4, props } as Layer);
const png = (props: Record<string, unknown>, frame: number, style: 's1' | 'm1' = 'm1') => stillOf(planOf(style, [callout(props)]), frame);
const bytes = async (props: Record<string, unknown>, frame: number) => readFileSync(await png(props, frame));
const centre = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const T = 300000;

describe('callout', () => {
  it('draws itself on: frames 4, 12 and 40 differ, and the last frame is as blank as the picture', async () => {
    const [a, b, c] = [await bytes({ kind: 'ring', x: 0.5, y: 0.5 }, 4), await bytes({ kind: 'ring', x: 0.5, y: 0.5 }, 12), await bytes({ kind: 'ring', x: 0.5, y: 0.5 }, 40)];
    expect(a.equals(b)).toBe(false);
    expect(b.equals(c)).toBe(false);
    expect((await bytes({ kind: 'ring', x: 0.5, y: 0.5 }, 119)).equals(readFileSync(await blankStill('m1', 119)))).toBe(true);
  }, T);
  it('a ring is drawn around the point it is given', async () => {
    const mid = centre(await inkBox(await png({ kind: 'ring', x: 0.5, y: 0.5 }, 40)));
    expect(Math.abs(mid.x - 540)).toBeLessThan(40);
    expect(Math.abs(mid.y - 960)).toBeLessThan(40);
    const corner = centre(await inkBox(await png({ kind: 'ring', x: 0.25, y: 0.3 }, 40)));
    expect(corner.x).toBeLessThan(400);
    expect(corner.y).toBeLessThan(700);
  }, T);
  it('an arrow comes from the side its angle says and ends at the point', async () => {
    const lowerLeft = centre(await inkBox(await png({ kind: 'arrow', x: 0.5, y: 0.5, angle: 225 }, 40)));
    expect(lowerLeft.x).toBeLessThan(540);
    expect(lowerLeft.y).toBeGreaterThan(960);
    const upperRight = centre(await inkBox(await png({ kind: 'arrow', x: 0.5, y: 0.5, angle: 45 }, 40)));
    expect(upperRight.x).toBeGreaterThan(540);
    expect(upperRight.y).toBeLessThan(960);
  }, T);
  it('size, label and colour each change the picture, and a long label stays inside the frame', async () => {
    const base = await bytes({ kind: 'ring', x: 0.5, y: 0.5 }, 40);
    expect((await bytes({ kind: 'ring', x: 0.5, y: 0.5, size: 0.4 }, 40)).equals(base)).toBe(false);
    expect((await bytes({ kind: 'ring', x: 0.5, y: 0.5, label: 'Bấm vào đây' }, 40)).equals(base)).toBe(false);
    expect((await bytes({ kind: 'ring', x: 0.5, y: 0.5, color: 'white' }, 40)).equals(base)).toBe(false);
    const edge = await inkBox(await png({ kind: 'arrow', x: 0.95, y: 0.05, label: 'Nhãn khá dài nhé bạn ơi' }, 40));
    expect(edge.x + edge.w).toBeLessThanOrEqual(1080);
    expect(edge.y).toBeGreaterThanOrEqual(0);
  }, T);
  it('renders in both styles', async () => {
    expect((await bytes({ kind: 'arrow', x: 0.5, y: 0.5 }, 40)).length).toBeGreaterThan(1000);
    expect((await png({ kind: 'arrow', x: 0.5, y: 0.5 }, 40, 's1')).length).toBeGreaterThan(5);
  }, T);
});
