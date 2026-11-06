import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Plan, Layer } from '../../src/plan/types';
import { diffPlan, describePlanDiff } from '../../src/harness/diff';

const loadValidPlan = (): Plan => JSON.parse(readFileSync('tests/fixtures/plan.valid.json', 'utf8'));

describe('plan diffing', () => {
  it('detects no changes when plans are identical', () => {
    const orig = loadValidPlan();
    const draft = loadValidPlan();

    const diff = diffPlan(orig, draft);
    expect(diff.hasChanges).toBe(false);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.updated).toHaveLength(0);
    expect(describePlanDiff(diff)).toEqual(['Không có thay đổi']);
  });

  it('detects added layers', () => {
    const orig = loadValidPlan();
    const draft = loadValidPlan();
    const newLayer: Layer = {
      id: 'brand-new',
      track: 'graphic',
      type: 'card',
      start: 1,
      end: 3,
      props: { text: 'Hello' },
    };
    draft.layers.push(newLayer);

    const diff = diffPlan(orig, draft);
    expect(diff.hasChanges).toBe(true);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].id).toBe('brand-new');
    expect(diff.removed).toHaveLength(0);
    expect(diff.updated).toHaveLength(0);

    const desc = describePlanDiff(diff);
    expect(desc.some(d => d.includes('Thêm layer') && d.includes('brand-new'))).toBe(true);
  });

  it('detects removed layers', () => {
    const orig = loadValidPlan();
    const draft = loadValidPlan();
    const removedId = draft.layers[0].id;
    draft.layers.shift();

    const diff = diffPlan(orig, draft);
    expect(diff.hasChanges).toBe(true);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0].id).toBe(removedId);

    const desc = describePlanDiff(diff);
    expect(desc.some(d => d.includes('Xóa layer') && d.includes(removedId))).toBe(true);
  });

  it('detects modified properties in updated layers', () => {
    const orig = loadValidPlan();
    const draft = loadValidPlan();
    const target = draft.layers[0];
    target.start = 0.5;
    target.props = { ...(target.props ?? {}), highlightColor: '#ffff00' };

    const diff = diffPlan(orig, draft);
    expect(diff.hasChanges).toBe(true);
    expect(diff.updated).toHaveLength(1);
    expect(diff.updated[0].id).toBe(target.id);

    const paths = diff.updated[0].changes.map(c => c.path);
    expect(paths).toContain('start');
    expect(paths).toContain('props.highlightColor');

    const desc = describePlanDiff(diff);
    expect(desc.some(d => d.includes(`Sửa layer "${target.id}"`))).toBe(true);
  });
});
