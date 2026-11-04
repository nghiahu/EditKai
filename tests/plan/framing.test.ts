import { describe, expect, it } from 'vitest';
import { aspectNote, FIT_MODES, framingProblem, framingStyle, resolveFraming } from '../../src/plan/framing';
import { validatePlanSchema } from '../../src/plan/schema';

describe('resolveFraming', () => {
  it('defaults to cover, centred: a source that is not the shape of the frame fills it', () => {
    expect([...FIT_MODES]).toEqual(['cover', 'contain']);
    expect(resolveFraming(undefined)).toEqual({ fit: 'cover', focus: { x: 0.5, y: 0.5 } });
    expect(resolveFraming({})).toEqual({ fit: 'cover', focus: { x: 0.5, y: 0.5 } });
  });
  it('keeps a good fit and focus; anything else falls back instead of throwing', () => {
    expect(resolveFraming({ fit: 'contain', focus: { x: 0.3, y: 0.6 } })).toEqual({ fit: 'contain', focus: { x: 0.3, y: 0.6 } });
    expect(resolveFraming({ fit: 'Cover', focus: { x: 2, y: 'a' } } as never)).toEqual({ fit: 'cover', focus: { x: 0.5, y: 0.5 } });
    expect(resolveFraming({ focus: { x: 0.2 } } as never).focus).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe('framingProblem', () => {
  it('names an unknown fit and a focus outside 0-1', () => {
    expect(framingProblem({ fit: 'stretch' })).toMatch(/fit/);
    expect(framingProblem({ focus: { x: 1.5, y: 0.5 } })).toMatch(/focus/);
    expect(framingProblem({ focus: { x: 0.5 } })).toMatch(/focus/);
    expect(framingProblem({ fit: 'contain', focus: { x: 0, y: 1 } })).toBeUndefined();
    expect(framingProblem({})).toBeUndefined();
  });
});

describe('framingStyle', () => {
  it('cover crops around the focus point, contain keeps the whole picture', () => {
    expect(framingStyle({ fit: 'cover', focus: { x: 0.25, y: 0.5 } })).toEqual({ objectFit: 'cover', objectPosition: '25% 50%' });
    expect(framingStyle({ fit: 'contain', focus: { x: 0.25, y: 0.5 } })).toEqual({ objectFit: 'contain', objectPosition: '50% 50%' });
  });
});

describe('aspectNote', () => {
  it('says what happens when the source is not the shape of the frame, and nothing when it is', () => {
    const wide = aspectNote(1920, 1080, 1080, 1920);
    expect(wide).toMatch(/16:9/);
    expect(wide).toMatch(/9:16/);
    expect(wide).toMatch(/cắt|cover/);
    expect(aspectNote(1080, 1920, 1080, 1920)).toBeUndefined();
    expect(aspectNote(1920, 1080, 1920, 1080)).toBeUndefined();
    expect(aspectNote(1920, 1080, 1080, 1080)).toMatch(/1:1/); // a square frame from a wide source
  });
  it('a slight difference (a few percent) is not worth a note', () => {
    expect(aspectNote(1920, 1088, 1920, 1080)).toBeUndefined();
  });
});

describe('plan schema accepts the framing fields', () => {
  const base = { version: 1, scenes: [], layers: [] };
  const meta = { source: 'cleaned.mp4', fps: 30, width: 1080, height: 1920, style: 'm1' };
  it('fit and focus are optional in meta, and a bad one is a schema error', () => {
    expect(validatePlanSchema({ ...base, meta }).ok).toBe(true);
    expect(validatePlanSchema({ ...base, meta: { ...meta, fit: 'contain', focus: { x: 0.4, y: 0.5 } } }).ok).toBe(true);
    expect(validatePlanSchema({ ...base, meta: { ...meta, fit: 'blur' } }).ok).toBe(false); // blur-fill is not available (see the backlog)
    expect(validatePlanSchema({ ...base, meta: { ...meta, fit: 'stretch' } }).ok).toBe(false);
    expect(validatePlanSchema({ ...base, meta: { ...meta, focus: { x: 3, y: 0 } } }).ok).toBe(false);
  });
});
