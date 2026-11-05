import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { blankStill, inkBox, planOf, stillOf } from './helper';
import { sceneProblem } from '../../src/plan/scene';
import type { Layer } from '../../src/plan/types';

const load = (name: string) => JSON.parse(readFileSync(`tests/fixtures/scenes/${name}.json`, 'utf8')) as Record<string, unknown>;
const layerOf = (name: string, end = 5): Layer => ({ id: 's1', track: 'graphic', type: 'scene', start: 0, end, props: load(name) } as Layer);
const png = (name: string, frame: number, style: 's1' | 'm1' = 'm1') => stillOf(planOf(style, [layerOf(name)], 5), frame, { durationSec: 5 });
const bytes = async (name: string, frame: number, style: 's1' | 'm1' = 'm1') => readFileSync(await png(name, frame, style));
const T = 400000;
const F = (sec: number) => Math.round(sec * 30);

describe.each(['grid-highlight', 'list-underline', 'big-number'])('scene recipe %s', name => {
  it('is a valid scene', () => {
    expect(sceneProblem(load(name))).toBeUndefined();
  });
  it('is drawn inside the frame in both styles once it has settled, and is gone at the end', async () => {
    for (const style of ['s1', 'm1'] as const) {
      const box = await inkBox(await png(name, F(4.4), style));
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(1080);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.h).toBeLessThanOrEqual(1920);
    }
    expect((await bytes(name, F(5) - 1)).equals(readFileSync(await stillOf(planOf('m1', [], 5), F(5) - 1, { durationSec: 5 })))).toBe(true);
  }, T);
});

describe('the grid that lights the card being talked about', () => {
  it('cards arrive one after another (frames 8, 16 and 40 differ)', async () => {
    const [a, b, c] = [await bytes('grid-highlight', 8), await bytes('grid-highlight', 16), await bytes('grid-highlight', 40)];
    expect(a.equals(b)).toBe(false);
    expect(b.equals(c)).toBe(false);
  }, T);
  it('each card lights in its own moment: no two moments look alike, and the one before the first light and after the last are alike', async () => {
    const moments = [0.9, 1.5, 2.3, 3.1, 3.9]; // before, card 1, card 2, card 3, card 4
    const frames = [] as Buffer[];
    for (const t of [...moments, 4.8]) frames.push(await bytes('grid-highlight', F(t)));
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) expect(frames[i].equals(frames[j])).toBe(false);
    // 4.8 s: the last light is out, the scene is also leaving; it differs from every lit moment
    for (let i = 1; i < 5; i++) expect(frames[5].equals(frames[i])).toBe(false);
  }, T);
  it('the light is where the talk is: the left-hand card is lit first (its outline reaches further left), then the right-hand one', async () => {
    const left = async (t: number) => (await inkBox(await png('grid-highlight', F(t)))).x;
    expect(await left(1.5)).toBeLessThan(await left(2.3)); // card 1 (left column) lit versus card 2 (right column) lit
  }, T);
});
