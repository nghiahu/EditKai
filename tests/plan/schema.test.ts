import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validatePlanSchema } from '../../src/plan/schema';

const load = () => JSON.parse(readFileSync('tests/fixtures/plan.valid.json', 'utf8'));

describe('validatePlanSchema', () => {
  it('accepts a valid plan', () => {
    expect(validatePlanSchema(load())).toEqual({ ok: true, issues: [] });
  });
  it('rejects unknown track', () => {
    const p = load(); p.layers[0].track = 'music';
    const r = validatePlanSchema(p);
    expect(r.ok).toBe(false);
    expect(r.issues[0].code).toBe('schema');
  });
  it('rejects end <= start', () => {
    const p = load(); p.layers[1].end = p.layers[1].start;
    const r = validatePlanSchema(p);
    expect(r.ok).toBe(false);
    expect(r.issues[0].layerId).toBe('l2');
  });
  it('rejects missing meta.fps', () => {
    const p = load(); delete p.meta.fps;
    expect(validatePlanSchema(p).ok).toBe(false);
  });
});
