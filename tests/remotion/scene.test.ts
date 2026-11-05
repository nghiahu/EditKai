import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { blankStill, inkBox, planOf, stillOf } from './helper';
import type { Layer } from '../../src/plan/types';
import type { SceneNode } from '../../src/plan/scene';

const scene = (root: SceneNode, extra: Record<string, unknown> = {}): Layer => ({ id: 's1', track: 'graphic', type: 'scene', start: 0, end: 4, props: { anchor: 'top', w: 0.9, h: 0.3, root, ...extra } } as Layer);
const png = (layer: Layer, frame: number, style: 's1' | 'm1' = 'm1') => stillOf(planOf(style, [layer]), frame);
const bytes = async (layer: Layer, frame: number, style: 's1' | 'm1' = 'm1') => readFileSync(await png(layer, frame, style));
const T = 300000;
const solid = (id: string, extra: Partial<SceneNode> = {}): SceneNode => ({ id, kind: 'box', w: 200, h: 120, fill: 'accent', radius: 20, ...extra });

describe('Scene: the blocks', () => {
  it('a box sits where the anchor says: top, centre, bottom, left, right', async () => {
    const at = async (anchor: string) => inkBox(await png(scene(solid('a'), { anchor, w: 0.4 }), 40)); // a narrow scene, so left and right are far from the middle
    const [top, centre, bottom, left, right] = [await at('top'), await at('center'), await at('bottom'), await at('left'), await at('right')];
    expect(top.y + top.h / 2).toBeLessThan(500);
    expect(Math.abs(centre.y + centre.h / 2 - 960)).toBeLessThan(80);
    expect(bottom.y + bottom.h / 2).toBeGreaterThan(1200);
    expect(left.x + left.w).toBeLessThan(540);
    expect(right.x).toBeGreaterThan(540);
  }, T);
  it('text, an icon and a line each draw something, and a bad icon name falls back instead of failing', async () => {
    const blank = readFileSync(await blankStill('m1', 40));
    for (const node of [
      { id: 't', kind: 'text', text: 'Typography', size: 60 } as SceneNode,
      { id: 'i', kind: 'icon', name: 'sparkles', size: 80, color: 'accent' } as SceneNode,
      { id: 'i2', kind: 'icon', name: 'khong-co-icon-nay', size: 80, color: 'accent' } as SceneNode,
      { id: 'l', kind: 'line', points: [[0, 0], [200, 40], [400, 0]], stroke: 'accent', strokeWidth: 8, w: 400, h: 60 } as SceneNode,
    ]) expect((await bytes(scene(node), 40)).equals(blank)).toBe(false);
  }, T);
  it('a row, a column and a grid place their children side by side, one under another, and in columns', async () => {
    const kids = () => ['a', 'b', 'c', 'd'].map(id => solid(id, { w: 160, h: 100 }));
    const dims = async (kind: string, extra: Partial<SceneNode> = {}) => inkBox(await png(scene({ id: 'r', kind, gap: 20, children: kids(), ...extra } as SceneNode, { h: 0.6 }), 40));
    const row = await dims('row');
    const column = await dims('column');
    const grid = await dims('grid', { cols: 2 });
    expect(row.w).toBeGreaterThan(row.h * 3);
    expect(column.h).toBeGreaterThan(column.w * 2);
    expect(grid.w).toBeLessThan(row.w); // two columns instead of four
    expect(grid.h).toBeLessThan(column.h); // two rows instead of four
    expect(grid.w).toBeGreaterThan(column.w); // wider than one column
    expect(grid.h).toBeGreaterThan(row.h); // taller than one row
  }, T);
  it('colours are tokens of the style or #rrggbb, and the two styles differ', async () => {
    expect((await bytes(scene(solid('a', { fill: '#FF0000' })), 40)).equals(await bytes(scene(solid('a', { fill: '#0000FF' })), 40))).toBe(false);
    expect((await bytes(scene(solid('a')), 40, 'm1')).equals(await bytes(scene(solid('a')), 40, 's1'))).toBe(false);
  }, T);
});

describe('Scene: animation', () => {
  it('before its enter a node is not there at all; after it, it is', async () => {
    const layer = scene(solid('a', { enter: { kind: 'fade', at: 1, duration: 0.5 } }));
    const blank = readFileSync(await blankStill('m1', 15));
    expect((await bytes(layer, 15)).equals(blank)).toBe(true); // 0.5 s: not yet
    expect((await bytes(layer, 90)).equals(blank)).toBe(false); // 3 s: there
  }, T);
  it('a node is fully faded at the last frame of the scene (the scene leaves on its own)', async () => {
    expect((await bytes(scene(solid('a')), 119)).equals(readFileSync(await blankStill('m1', 119)))).toBe(true);
  }, T);
  it('stagger: children arrive one after another', async () => {
    const root: SceneNode = { id: 'r', kind: 'row', gap: 20, stagger: 6, enter: { kind: 'pop', at: 0.2 }, children: ['a', 'b', 'c'].map(id => solid(id, { w: 120, h: 100 })) };
    const widthAt = async (frame: number) => (await inkBox(await png(scene(root), frame))).w;
    const [w1, w2, w3] = [await widthAt(10), await widthAt(16), await widthAt(60)];
    expect(w1).toBeLessThan(w2);
    expect(w2).toBeLessThan(w3);
  }, T);
  it('highlight: a stroke and a bigger size between two moments, back to normal afterwards', async () => {
    const layer = scene(solid('a', { highlight: { at: 1, until: 2, to: { stroke: 'white', strokeWidth: 8, scale: 1.15 } } }));
    const [before, during, after] = [await bytes(layer, 15), await bytes(layer, 45), await bytes(layer, 90)];
    expect(before.equals(during)).toBe(false);
    expect(during.equals(after)).toBe(false);
    expect(before.equals(after)).toBe(true); // the same as before it
  }, T);
  it('a line draws itself (progress), and keys move a node', async () => {
    const line = scene({ id: 'l', kind: 'line', points: [[0, 0], [300, 60]], stroke: 'accent', strokeWidth: 10, w: 300, h: 60, enter: { kind: 'draw', at: 0.2, duration: 1 } });
    const [a, b, c] = [await bytes(line, 12), await bytes(line, 30), await bytes(line, 60)];
    expect(a.equals(b)).toBe(false);
    expect(b.equals(c)).toBe(false);
    const moving = scene(solid('a', { keys: { x: [{ at: 0, v: 0 }, { at: 1, v: 300, ease: 'linear' }] } }));
    const before = await inkBox(await png(moving, 3));
    const after = await inkBox(await png(moving, 45));
    expect(after.x).toBeGreaterThan(before.x + 100);
  }, T);
});
