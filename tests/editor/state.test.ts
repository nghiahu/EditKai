import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { initState, reduce } from '../../editor/src/state/editorState';
import type { Plan } from '../../src/plan/types';

const plan = (): Plan => JSON.parse(readFileSync('tests/fixtures/plan.valid.json', 'utf8'));
const layer = (s: ReturnType<typeof initState>, id: string) => s.plan.layers.find(l => l.id === id)!;

describe('editor reducer', () => {
  it('move marks the layer locked and the state dirty, keeping its duration', () => {
    const s = reduce(initState(plan()), { type: 'move', id: 'l2', start: 1 });
    expect(layer(s, 'l2')).toMatchObject({ start: 1, end: 4, locked: true });
    expect(s.dirty).toBe(true);
    expect(s.past).toHaveLength(1);
  });
  it('move never goes before 0', () => {
    expect(layer(reduce(initState(plan()), { type: 'move', id: 'l2', start: -5 }), 'l2').start).toBe(0);
  });
  it('resize clamps so end stays after start', () => {
    const s = reduce(initState(plan()), { type: 'resize', id: 'l2', edge: 'end', time: 0.2 });
    expect(layer(s, 'l2').end).toBeGreaterThan(layer(s, 'l2').start);
    const t = reduce(initState(plan()), { type: 'resize', id: 'l2', edge: 'start', time: 99 });
    expect(layer(t, 'l2').start).toBeLessThan(layer(t, 'l2').end);
  });
  it('split makes two layers covering the same span with copied props', () => {
    const s = reduce(initState(plan()), { type: 'split', id: 'l2', time: 2 });
    const a = layer(s, 'l2'), b = s.plan.layers.find(l => l.id !== 'l1' && l.id !== 'l2')!;
    expect([a.start, a.end, b.start, b.end]).toEqual([0.5, 2, 2, 3.5]);
    expect(b.props).toEqual(a.props);
    expect(a.locked && b.locked).toBe(true);
  });
  it('split outside the layer is a no-op', () => {
    const s0 = initState(plan());
    expect(reduce(s0, { type: 'split', id: 'l2', time: 9 })).toBe(s0);
  });
  it('update merges props and marks locked', () => {
    const s = reduce(initState(plan()), { type: 'update', id: 'l2', patch: { props: { title: 'MỚI' } } });
    expect(layer(s, 'l2').props).toEqual({ icon: 'video', title: 'MỚI' });
    expect(layer(s, 'l2').locked).toBe(true);
  });
  it('add and delete layers', () => {
    const added = reduce(initState(plan()), { type: 'add', layer: { id: 'n1', track: 'graphic', start: 1, end: 2 } });
    expect(layer(added, 'n1').locked).toBe(true);
    const removed = reduce({ ...added, selectedId: 'n1' }, { type: 'delete', id: 'n1' });
    expect(removed.plan.layers.find(l => l.id === 'n1')).toBeUndefined();
    expect(removed.selectedId).toBeUndefined();
  });
  it('undo then redo restores the plan', () => {
    const s0 = initState(plan());
    const s1 = reduce(s0, { type: 'move', id: 'l2', start: 1 });
    const u = reduce(s1, { type: 'undo' });
    expect(u.plan).toEqual(s0.plan);
    expect(reduce(u, { type: 'redo' }).plan).toEqual(s1.plan);
  });
  it('an edit after undo clears redo', () => {
    const s1 = reduce(initState(plan()), { type: 'move', id: 'l2', start: 1 });
    const u = reduce(s1, { type: 'undo' });
    expect(reduce(u, { type: 'move', id: 'l2', start: 2 }).future).toHaveLength(0);
  });
  it('select does not touch history; saved clears dirty', () => {
    const s1 = reduce(initState(plan()), { type: 'move', id: 'l2', start: 1 });
    const sel = reduce(s1, { type: 'select', id: 'l1' });
    expect(sel.past).toHaveLength(1);
    expect(sel.selectedId).toBe('l1');
    expect(reduce(sel, { type: 'saved' }).dirty).toBe(false);
  });
  it('reload replaces the plan and clears history', () => {
    const s1 = reduce(initState(plan()), { type: 'move', id: 'l2', start: 1 });
    const p = plan(); p.meta.style = 'm1';
    const r = reduce(s1, { type: 'reload', plan: p });
    expect(r.plan.meta.style).toBe('m1');
    expect(r.past).toHaveLength(0);
    expect(r.dirty).toBe(false);
  });
});
