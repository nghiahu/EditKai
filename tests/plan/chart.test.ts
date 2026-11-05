import { describe, expect, it } from 'vitest';
import { chartProblem, resolveChart } from '../../src/plan/insertTypes';
import { LAYER_TYPES } from '../../src/plan/layerTypes';
import { insertFootprint } from '../../src/plan/insertFootprint';
import { loadTheme } from '../../src/style/theme';

const points = [{ label: '2023', value: 30 }, { label: '2024', value: 55 }];

describe('chart props', () => {
  it('a bar or line chart of 2 to 6 labelled numbers is valid; unit, title, source and position are optional', () => {
    expect(chartProblem({ kind: 'bar', points })).toBeUndefined();
    expect(chartProblem({ kind: 'line', points: [...points, { label: '2025', value: 80 }], unit: '%', title: 'Lượt xem', source: 'YouTube Studio', position: 'top' })).toBeUndefined();
  });
  it('names what is wrong', () => {
    expect(chartProblem({ points })).toMatch(/kind/);
    expect(chartProblem({ kind: 'pie', points })).toMatch(/kind/);
    expect(chartProblem({ kind: 'bar' })).toMatch(/points/);
    expect(chartProblem({ kind: 'bar', points: [points[0]] })).toMatch(/points/);
    expect(chartProblem({ kind: 'bar', points: Array.from({ length: 7 }, (_, i) => ({ label: `${i}`, value: i })) })).toMatch(/points/);
    expect(chartProblem({ kind: 'bar', points: [points[0], { label: '', value: 1 }] })).toMatch(/points\[1\]\.label/);
    expect(chartProblem({ kind: 'bar', points: [points[0], { label: 'x'.repeat(17), value: 1 }] })).toMatch(/label/);
    expect(chartProblem({ kind: 'bar', points: [points[0], { label: 'b', value: '5' }] })).toMatch(/points\[1\]\.value/);
    expect(chartProblem({ kind: 'bar', points: [points[0], { label: 'b', value: -1 }] })).toMatch(/value/);
    expect(chartProblem({ kind: 'bar', points: [points[0], { label: 'b', value: Infinity }] })).toMatch(/value/);
    expect(chartProblem({ kind: 'bar', points, unit: 'x'.repeat(13) })).toMatch(/unit/);
    expect(chartProblem({ kind: 'bar', points, title: 'x'.repeat(41) })).toMatch(/title/);
    expect(chartProblem({ kind: 'bar', points, source: '' })).toMatch(/source/);
    expect(chartProblem({ kind: 'bar', points, position: 'middle' })).toMatch(/position/);
  });
  it('resolveChart fills the defaults, drops bad points and never throws', () => {
    expect(resolveChart({ kind: 'bar', points })).toEqual({ kind: 'bar', points, position: 'center' });
    expect(resolveChart({ kind: 'line', points: [...points, { label: 'x', value: 'a' }, null], source: 'S' })).toMatchObject({ kind: 'line', points, source: 'S' });
    expect(() => resolveChart(undefined)).not.toThrow();
  });
  it('is a graphic layer type, and takes room like a card (a footprint)', () => {
    expect(LAYER_TYPES.chart.track).toBe('graphic');
    expect(LAYER_TYPES.chart.check({ kind: 'bar', points })).toBeUndefined();
    expect(LAYER_TYPES.chart.check({ kind: 'bar' })).toMatch(/points/);
    const fp = insertFootprint('chart', { kind: 'bar', points }, 'center', loadTheme('styles/m1'), 1080, 1920)!;
    expect(fp.h).toBeGreaterThan(0.15);
    expect(fp.y + fp.h / 2).toBeCloseTo(0.5, 5);
  });
});
