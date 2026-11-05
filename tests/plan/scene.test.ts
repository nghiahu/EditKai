import { describe, expect, it } from 'vitest';
import { LAYER_TYPES } from '../../src/plan/layerTypes';
import { MAX_NODES, sceneProblem, type SceneNode } from '../../src/plan/scene';

const card = (id: string, extra: Partial<SceneNode> = {}): SceneNode => ({ id, kind: 'box', w: 300, h: 120, fill: 'panel', radius: 24, ...extra });
const scene = (root: SceneNode, extra: Record<string, unknown> = {}) => ({ anchor: 'top', w: 0.9, h: 0.3, root, ...extra });
const grid = (children: SceneNode[]): SceneNode => ({ id: 'g', kind: 'grid', cols: 2, gap: 20, children });

describe('sceneProblem: a valid scene', () => {
  it('a grid of cards with a title, an icon and a highlight on one of them', () => {
    const p = scene(grid([
      card('a', { children: [{ id: 'a-i', kind: 'icon', name: 'sparkles', size: 56 }, { id: 'a-t', kind: 'text', text: 'Typography', size: 40, weight: 800, color: 'white' }] }),
      card('b', { enter: { kind: 'pop', at: 0.4 }, highlight: { at: { word: 12, offset: -0.1 }, until: { word: 14, edge: 'end' }, to: { stroke: 'accent', scale: 1.05 } } }),
    ]));
    expect(sceneProblem(p)).toBeUndefined();
  });
  it('keyframes with numbers and with words, in order, with an ease', () => {
    const p = scene(card('a', { keys: { opacity: [{ at: 0, v: 0 }, { at: 0.4, v: 1, ease: 'spring' }], scale: [{ at: { word: 3 }, v: 1 }, { at: { word: 4, offset: 0.2 }, v: 1.1, ease: 'out' }] } }));
    expect(sceneProblem(p)).toBeUndefined();
  });
  it('lines with 2 to 8 points, images with a src, texts up to 80 characters, colours as tokens or #rrggbb', () => {
    const p = scene({ id: 'r', kind: 'column', children: [
      { id: 'l', kind: 'line', points: [[0, 0], [100, 10], [200, 0]], stroke: '#FFD83A', strokeWidth: 6 },
      { id: 'im', kind: 'image', src: 'assets/logo.png', w: 80, h: 80 },
      { id: 't', kind: 'text', text: 'x'.repeat(80), color: 'accent' },
    ] });
    expect(sceneProblem(p)).toBeUndefined();
  });
});

describe('sceneProblem: it says where the mistake is', () => {
  const bad = (p: unknown) => sceneProblem(p as Record<string, unknown>) ?? '';
  it('the scene itself: root, anchor, size', () => {
    expect(bad({})).toMatch(/root/);
    expect(bad(scene(card('a'), { anchor: 'middle' }))).toMatch(/anchor/);
    expect(bad(scene(card('a'), { w: 0 }))).toMatch(/props\.w/);
    expect(bad(scene(card('a'), { h: 1.5 }))).toMatch(/props\.h/);
    expect(bad({ anchor: 'top', root: card('a') })).toMatch(/props\.w/);
  });
  it('nodes: id, kind, children of a leaf, text without text', () => {
    expect(bad(scene({ kind: 'box' } as SceneNode))).toMatch(/root\.id/);
    expect(bad(scene(card('a', { kind: 'blob' as never })))).toMatch(/root\.kind/);
    expect(bad(scene(grid([card('a'), card('a')])))).toMatch(/children\[1\]\.id.*trùng|duplicate|trùng/);
    expect(bad(scene({ id: 't', kind: 'text', children: [card('c')] } as SceneNode))).toMatch(/root\.children|text/);
    expect(bad(scene({ id: 't', kind: 'text' }))).toMatch(/root\.text/);
    expect(bad(scene({ id: 't', kind: 'text', text: 'x'.repeat(81) }))).toMatch(/root\.text/);
    expect(bad(scene({ id: 'i', kind: 'icon' }))).toMatch(/root\.name/);
    expect(bad(scene({ id: 'i', kind: 'image' }))).toMatch(/root\.src/);
    expect(bad(scene({ id: 'l', kind: 'line', points: [[0, 0]] }))).toMatch(/root\.points/);
    expect(bad(scene({ id: 'g', kind: 'grid', cols: 9, children: [card('a')] }))).toMatch(/root\.cols/);
  });
  it('style values: colours, numbers out of range', () => {
    expect(bad(scene(card('a', { fill: 'red' })))).toMatch(/root\.fill/);
    expect(bad(scene(card('a', { stroke: '#FFF' })))).toMatch(/root\.stroke/);
    expect(bad(scene(card('a', { opacity: 2 })))).toMatch(/root\.opacity/);
    expect(bad(scene(card('a', { scale: 0 })))).toMatch(/root\.scale/);
    expect(bad(scene(card('a', { radius: -1 })))).toMatch(/root\.radius/);
    expect(bad(scene(card('a', { w: Infinity })))).toMatch(/root\.w/);
  });
  it('depth and size limits: 6 levels (a grid of cards that hold a row and a column of text needs 5), at most 40 nodes', () => {
    const deep = (n: number): SceneNode => (n === 0 ? card(`d${n}`) : { id: `d${n}`, kind: 'column', children: [deep(n - 1)] });
    expect(sceneProblem(scene(deep(5)))).toBeUndefined(); // 6 levels
    expect(bad(scene(deep(6)))).toMatch(/cấp|6/);
    const many = (n: number) => scene({ id: 'r', kind: 'column', children: Array.from({ length: n }, (_, i) => card(`n${i}`)) });
    expect(sceneProblem(many(MAX_NODES - 1))).toBeUndefined();
    expect(bad(many(MAX_NODES))).toMatch(/phần tử|40/);
  });
  it('keyframes: unknown property, wrong value kind, too few or unordered', () => {
    expect(bad(scene(card('a', { keys: { wobble: [{ at: 0, v: 1 }, { at: 1, v: 2 }] } as never })))).toMatch(/root\.keys\.wobble/);
    expect(bad(scene(card('a', { keys: { opacity: [{ at: 0, v: 'x' }, { at: 1, v: 1 }] } })))).toMatch(/root\.keys\.opacity\[0\]\.v/);
    expect(bad(scene(card('a', { keys: { fill: [{ at: 0, v: 5 }, { at: 1, v: 'accent' }] } })))).toMatch(/root\.keys\.fill\[0\]\.v/);
    expect(bad(scene(card('a', { keys: { opacity: [{ at: 0, v: 0 }] } })))).toMatch(/root\.keys\.opacity/);
    expect(bad(scene(card('a', { keys: { opacity: [{ at: 1, v: 0 }, { at: 0.5, v: 1 }] } })))).toMatch(/root\.keys\.opacity\[1\]\.at/);
    expect(bad(scene(card('a', { keys: { opacity: [{ at: -1, v: 0 }, { at: 1, v: 1 }] } })))).toMatch(/root\.keys\.opacity\[0\]\.at/);
    expect(bad(scene(card('a', { keys: { opacity: [{ at: 0, v: 0, ease: 'bounce' as never }, { at: 1, v: 1 }] } })))).toMatch(/ease/);
    expect(bad(scene(card('a', { keys: { opacity: [{ at: { word: -2 }, v: 0 }, { at: 1, v: 1 }] } })))).toMatch(/at/);
  });
  it('presets: enter kind and time, highlight needs at, until and to', () => {
    expect(bad(scene(card('a', { enter: { kind: 'explode' as never } })))).toMatch(/root\.enter\.kind/);
    expect(bad(scene(card('a', { enter: { kind: 'pop', duration: 9 } })))).toMatch(/root\.enter\.duration/);
    expect(bad(scene(card('a', { highlight: { at: 1, to: { scale: 1.1 } } as never })))).toMatch(/root\.highlight\.until/);
    expect(bad(scene(card('a', { highlight: { at: 1, until: 2, to: { wobble: 1 } } as never })))).toMatch(/root\.highlight\.to/);
    expect(bad(scene(card('a', { stagger: 99 })))).toMatch(/root\.stagger/);
  });
});

describe('scene is a graphic layer type', () => {
  it('uses the same check', () => {
    expect(LAYER_TYPES.scene.track).toBe('graphic');
    expect(LAYER_TYPES.scene.check(scene(card('a')))).toBeUndefined();
    expect(LAYER_TYPES.scene.check({})).toMatch(/root/);
  });
});
