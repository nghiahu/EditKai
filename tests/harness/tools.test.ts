import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Plan, Layer } from '../../src/plan/types';
import {
  getPlanSummary,
  getLayer,
  getTranscript,
  patchLayer,
  addLayer,
  removeLayer,
  executeHarnessTool,
  HARNESS_TOOLS,
} from '../../src/harness/tools';
import type { HarnessContext } from '../../src/harness/types';

const loadValidPlan = (): Plan => JSON.parse(readFileSync('tests/fixtures/plan.valid.json', 'utf8'));

describe('harness tools', () => {
  it('get_plan_summary produces a concise summary without full bloat', () => {
    const plan = loadValidPlan();
    const summary = getPlanSummary(plan);

    expect(summary.meta.style).toBe(plan.meta.style);
    expect(summary.meta.fps).toBe(plan.meta.fps);
    expect(summary.layers.length).toBe(plan.layers.length);
    expect(summary.layers[0]).toHaveProperty('id');
    expect(summary.layers[0]).toHaveProperty('track');
    expect(summary.layers[0]).toHaveProperty('type');
    expect(summary.layers[0]).toHaveProperty('start');
    expect(summary.layers[0]).toHaveProperty('end');
  });

  it('get_layer retrieves a specific layer by id or undefined', () => {
    const plan = loadValidPlan();
    const firstId = plan.layers[0].id;
    const layer = getLayer(plan, firstId);
    expect(layer).toBeDefined();
    expect(layer?.id).toBe(firstId);

    expect(getLayer(plan, 'non-existent-id')).toBeUndefined();
  });

  it('get_transcript filters words in the time range', () => {
    const transcript = {
      text: 'xin chào mọi người hôm nay chúng ta dựng video',
      words: [
        { t: 'xin', s: 0.5, e: 0.8, hl: false },
        { t: 'chào', s: 0.8, e: 1.2, hl: false },
        { t: 'mọi', s: 1.2, e: 1.5, hl: false },
        { t: 'người', s: 1.5, e: 2.0, hl: false },
        { t: 'hôm', s: 2.5, e: 2.8, hl: false },
      ],
    };

    const words = getTranscript(transcript, 0.7, 1.8);
    expect(words.map(w => w.t)).toEqual(['xin', 'chào', 'mọi', 'người']);
  });

  it('patch_layer modifies layer properties and deep-merges props', () => {
    const plan = loadValidPlan();
    const target = plan.layers[0];
    const originalId = target.id;

    const res = patchLayer(plan, originalId, {
      start: 0.2,
      props: { customColor: '#ff0000' },
    });

    expect(res.ok).toBe(true);
    expect(target.start).toBe(0.2);
    expect(target.props?.customColor).toBe('#ff0000');
  });

  it('patch_layer rejects invalid start/end or non-existent layer', () => {
    const plan = loadValidPlan();
    const resBadTime = patchLayer(plan, plan.layers[0].id, { start: 10, end: 5 });
    expect(resBadTime.ok).toBe(false);
    expect(resBadTime.error).toMatch(/end/);

    const resNotFound = patchLayer(plan, 'ghost-id', { start: 1 });
    expect(resNotFound.ok).toBe(false);
  });

  it('add_layer adds a valid layer and rejects duplicates or invalid times', () => {
    const plan = loadValidPlan();
    const newLayer: Layer = {
      id: 'brand-new-card',
      track: 'graphic',
      type: 'card',
      start: 1.0,
      end: 3.5,
      props: { text: 'Xin chao' },
    };

    const res = addLayer(plan, newLayer);
    expect(res.ok).toBe(true);
    expect(plan.layers.some(l => l.id === 'brand-new-card')).toBe(true);

    // duplicate
    const resDup = addLayer(plan, newLayer);
    expect(resDup.ok).toBe(false);
    expect(resDup.error).toMatch(/trùng/);

    // invalid time
    const resBad = addLayer(plan, { ...newLayer, id: 'brand-new-card-2', start: 5, end: 4 });
    expect(resBad.ok).toBe(false);
  });

  it('remove_layer removes an existing layer', () => {
    const plan = loadValidPlan();
    const idToRemove = plan.layers[0].id;
    const initialCount = plan.layers.length;

    const res = removeLayer(plan, idToRemove);
    expect(res.ok).toBe(true);
    expect(plan.layers.length).toBe(initialCount - 1);
    expect(plan.layers.find(l => l.id === idToRemove)).toBeUndefined();

    // removing again fails
    const res2 = removeLayer(plan, idToRemove);
    expect(res2.ok).toBe(false);
  });

  it('executeHarnessTool runs tool by name in context', async () => {
    const plan = loadValidPlan();
    const ctx: HarnessContext = {
      draftPlan: plan,
      projectDir: 'projects/demo',
    };

    const summary = (await executeHarnessTool(ctx, 'get_plan_summary', {})) as { meta: unknown; layers: unknown[] };
    expect(summary.layers).toBeDefined();

    const layerRes = await executeHarnessTool(ctx, 'get_layer', { id: plan.layers[0].id });
    expect(layerRes).toEqual(plan.layers[0]);

    await expect(executeHarnessTool(ctx, 'unknown_tool', {})).rejects.toThrow(/Không tìm thấy tool/);
  });

  it('HARNESS_TOOLS provides schema definition for LLM tool calling', () => {
    expect(Array.isArray(HARNESS_TOOLS)).toBe(true);
    const names = HARNESS_TOOLS.map(t => t.name);
    expect(names).toContain('get_plan_summary');
    expect(names).toContain('get_layer');
    expect(names).toContain('get_transcript');
    expect(names).toContain('patch_layer');
    expect(names).toContain('add_layer');
    expect(names).toContain('remove_layer');
    expect(names).toContain('validate_plan');
  });
});

