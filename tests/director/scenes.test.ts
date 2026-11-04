import { describe, it, expect } from 'vitest';
import { buildScenes } from '../../src/director/scenes';
import type { Layer } from '../../src/plan/types';
import type { Storyboard } from '../../src/director/types';
import { beatOf } from '../helpers/beat';

const LIMITS = { minSceneSec: 2 };
const beats = (...spans: [number, number][]): Storyboard => ({ version: 1, style: 'm1', beats: spans.map(([start, end], i) => beatOf({ id: `b${i + 1}`, start, end })) });
const layer = (track: Layer['track'], type: string, start: number, end: number): Layer => ({ id: type, track, type, start, end });

describe('buildScenes', () => {
  it('roles follow footage and explainer layers, the rest is talking-head', () => {
    const scenes = buildScenes(beats([0, 4], [4, 8], [8, 12]), [layer('footage', 'footage', 4.5, 7), layer('graphic', 'explainer-scene', 9, 11)], LIMITS, 12);
    expect(scenes.map(s => s.role)).toEqual(['talking-head', 'insert', 'explainer']);
  });
  it('adjacent beats of one role merge', () => {
    const scenes = buildScenes(beats([0, 4], [4, 8], [8, 12]), [], LIMITS, 12);
    expect(scenes).toEqual([{ id: 's1', start: 0, end: 12, role: 'talking-head' }]);
  });
  it('scenes are contiguous and cover 0 to the video end, with pauses split at their midpoint', () => {
    const scenes = buildScenes(beats([0.5, 3], [4, 8.5], [10, 11]), [layer('footage', 'footage', 4, 8)], LIMITS, 12);
    expect(scenes[0].start).toBe(0);
    expect(scenes[scenes.length - 1].end).toBe(12);
    scenes.forEach((s, i) => { if (i) expect(s.start).toBe(scenes[i - 1].end); expect(s.end).toBeGreaterThan(s.start); });
    expect(scenes.map(s => s.role)).toEqual(['talking-head', 'insert', 'talking-head']);
    expect(scenes[0].end).toBeCloseTo(3.5, 5);
  });
  it('a scene shorter than minSceneSec merges into the previous one', () => {
    const scenes = buildScenes(beats([0, 5], [5, 5.8], [5.8, 12]), [layer('footage', 'footage', 5, 5.8)], LIMITS, 12);
    expect(scenes).toEqual([{ id: 's1', start: 0, end: 12, role: 'talking-head' }]);
  });
  it('a short first scene merges into the next one', () => {
    const scenes = buildScenes(beats([0, 1], [1, 12]), [layer('footage', 'footage', 0, 1)], LIMITS, 12);
    expect(scenes).toHaveLength(1);
    expect(scenes[0]).toMatchObject({ start: 0, end: 12 });
  });
  it('an empty storyboard gives one talking-head scene covering the video', () => {
    expect(buildScenes(beats(), [], LIMITS, 9)).toEqual([{ id: 's1', start: 0, end: 9, role: 'talking-head' }]);
  });
  it('ids are s1, s2 … in order', () => {
    const scenes = buildScenes(beats([0, 4], [4, 8], [8, 12]), [layer('footage', 'footage', 4, 8)], LIMITS, 12);
    expect(scenes.map(s => s.id)).toEqual(['s1', 's2', 's3']);
  });
});
