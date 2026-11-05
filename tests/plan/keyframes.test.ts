import { describe, expect, it } from 'vitest';
import { easeValue, expandScene, mixColor, parseColor, valueAt } from '../../src/plan/keyframes';
import type { SceneNode } from '../../src/plan/scene';

const palette = { accent: '#FFD83A', white: '#FFFFFF', ink: '#0A0A0A', panel: 'rgba(10,10,10,0.88)', dim: 'rgba(255,255,255,0.35)' };

describe('easeValue', () => {
  it('goes from 0 to 1 for every ease, and stays inside the range except the spring, which may overshoot a little', () => {
    for (const ease of ['linear', 'out', 'inOut', 'spring'] as const) {
      expect(easeValue(0, ease)).toBe(0);
      expect(easeValue(1, ease)).toBe(1);
    }
    expect(easeValue(0.5, 'linear')).toBe(0.5);
    expect(easeValue(0.5, 'out')).toBeGreaterThan(0.5); // fast at first
    expect(easeValue(0.5, 'inOut')).toBeCloseTo(0.5, 5);
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => easeValue(i / 100, 'spring')));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.2);
  });
  it('clamps outside 0-1', () => {
    expect(easeValue(-1, 'out')).toBe(0);
    expect(easeValue(2, 'out')).toBe(1);
  });
});

describe('colours', () => {
  it('parses #rrggbb, rgba() and tokens, and mixes in RGB', () => {
    expect(parseColor('#FFD83A', palette)).toEqual([255, 216, 58, 1]);
    expect(parseColor('rgba(10,10,10,0.88)', palette)).toEqual([10, 10, 10, 0.88]);
    expect(parseColor('accent', palette)).toEqual([255, 216, 58, 1]);
    expect(mixColor([0, 0, 0, 1], [200, 100, 50, 1], 0.5)).toEqual([100, 50, 25, 1]);
  });
});

describe('valueAt', () => {
  const k = (at: number, v: number | string, ease?: 'linear' | 'out' | 'inOut' | 'spring') => ({ at, v, ...(ease ? { ease } : {}) });
  it('holds the first value before the first keyframe and the last after the last', () => {
    const keys = [k(1, 0), k(2, 10, 'linear')];
    expect(valueAt(keys, 0, palette)).toBe(0);
    expect(valueAt(keys, 3, palette)).toBe(10);
  });
  it('between two keyframes it follows the ease of the later one', () => {
    expect(valueAt([k(0, 0), k(2, 10, 'linear')], 1, palette)).toBe(5);
    expect(valueAt([k(0, 0), k(2, 10, 'out')], 1, palette) as number).toBeGreaterThan(5);
    expect(valueAt([k(0, 0), k(1, 10), k(2, 0, 'linear')], 1.5, palette)).toBe(5);
  });
  it('mixes colours and returns an rgba() string; a colour token works', () => {
    const v = valueAt([k(0, '#000000'), k(1, '#FFFFFF', 'linear')], 0.5, palette);
    expect(v).toBe('rgba(128,128,128,1)');
    expect(valueAt([k(0, 'white'), k(1, 'accent', 'linear')], 1, palette)).toBe('rgba(255,216,58,1)');
  });
  it('a single keyframe or none: that value or undefined', () => {
    expect(valueAt([k(1, 7)], 5, palette)).toBe(7);
    expect(valueAt([], 5, palette)).toBeUndefined();
  });
});

const FPS = 30;
const box = (id: string, extra: Partial<SceneNode> = {}): SceneNode => ({ id, kind: 'box', w: 100, h: 50, ...extra });
const resolved = (root: SceneNode, duration = 4) => expandScene(root, { durationSec: duration, fps: FPS, staggerFrames: 3, exitFrames: 6 });
const find = (n: SceneNode, id: string): SceneNode => (n.id === id ? n : (n.children ?? []).map(c => find(c, id)).find(Boolean)!) as SceneNode;

describe('expandScene: presets become keyframes', () => {
  it('fade, rise, pop, slide, draw each animate what they promise, starting at their time', () => {
    const at = (kind: string) => find(resolved(box('a', { enter: { kind: kind as never, at: 1, duration: 0.5 } })), 'a').keys!;
    expect(at('fade').opacity!.map(f => [f.at, f.v])).toEqual([[1, 0], [1.5, 1]]);
    expect(at('rise').y!.map(f => f.v)).toEqual([40, 0]);
    expect(at('rise').opacity).toBeDefined();
    expect(at('pop').scale!.map(f => f.v)).toEqual([0.7, 1]);
    expect(at('pop').scale![1].ease).toBe('spring');
    expect(at('slide-left').x![0].v).toBeLessThan(0);
    expect(at('slide-right').x![0].v).toBeGreaterThan(0);
    expect(at('draw').progress!.map(f => f.v)).toEqual([0, 1]);
  });
  it('a node with no enter and no keys has no keys: it stands still', () => {
    expect(find(resolved(box('a')), 'a').keys ?? {}).toEqual({});
  });
  it('a container with stagger gives each child its enter, one stagger later than the one before', () => {
    const root: SceneNode = { id: 'r', kind: 'grid', cols: 2, stagger: 3, enter: { kind: 'fade', at: 0.5, duration: 0.3 }, children: [box('a'), box('b'), box('c')] };
    const out = resolved(root);
    const start = (id: string) => find(out, id).keys!.opacity![0].at as number;
    expect(start('a')).toBeCloseTo(0.5, 9);
    expect(start('b')).toBeCloseTo(0.5 + 3 / FPS, 9);
    expect(start('c')).toBeCloseTo(0.5 + 6 / FPS, 9);
  });
  it('a child with its own enter keeps it', () => {
    const root: SceneNode = { id: 'r', kind: 'column', stagger: 3, enter: { kind: 'fade' }, children: [box('a', { enter: { kind: 'pop', at: 2 } }), box('b')] };
    const out = resolved(root);
    expect(find(out, 'a').keys!.scale).toBeDefined();
    expect(find(out, 'a').keys!.opacity![0].at).toBeGreaterThanOrEqual(2);
  });
  it('exit: true fades the node out over exitFrames at the end of the scene; { at } at that time', () => {
    const end = (n: SceneNode) => find(resolved(n, 4), 'a').keys!.opacity!;
    const a = end(box('a', { exit: true }));
    expect(a[a.length - 1].v).toBe(0);
    expect(a[a.length - 1].at).toBeCloseTo(4, 9);
    expect(a[a.length - 2].at).toBeCloseTo(4 - 6 / FPS, 9);
    const b = end(box('a', { exit: { at: 2 } }));
    expect(b[b.length - 2].at).toBe(2);
  });
  it('highlight: the value goes to the given one at the start, holds until the end, and comes back', () => {
    const out = find(resolved(box('a', { highlight: { at: 1, until: 2, to: { scale: 1.1, stroke: 'accent' } } })), 'a').keys!;
    expect(out.scale!.map(f => [Math.round(f.at as number * 100) / 100, f.v])).toEqual([[0.88, 1], [1, 1.1], [2, 1.1], [2.12, 1]]);
    expect(out.stroke!.map(f => f.v)).toEqual(['rgba(0,0,0,0)', 'accent', 'accent', 'rgba(0,0,0,0)']);
  });
  it('highlight combines with an enter on the same property, in time order', () => {
    const out = find(resolved(box('a', { enter: { kind: 'pop', at: 0, duration: 0.4 }, highlight: { at: 2, until: 3, to: { scale: 1.1 } } })), 'a').keys!.scale!;
    const times = out.map(f => f.at as number);
    expect(times).toEqual([...times].sort((x, y) => x - y));
    expect(out[0].v).toBe(0.7);
    expect(out.at(-1)!.v).toBe(1);
  });
  it('explicit keys are kept and win over presets for the same property', () => {
    const out = find(resolved(box('a', { enter: { kind: 'fade' }, keys: { opacity: [{ at: 0, v: 0.2 }, { at: 1, v: 0.9 }] } })), 'a').keys!;
    expect(out.opacity!.map(f => f.v)).toEqual([0.2, 0.9]);
  });
});
