import { describe, it, expect } from 'vitest';
import { LAYER_TYPES } from '../../src/plan/layerTypes';
import { registry } from '../../remotion/registry';

describe('LAYER_TYPES', () => {
  it('matches the Remotion registry (plus caption)', () => {
    expect(Object.keys(LAYER_TYPES).sort()).toEqual(Object.keys(registry).filter(k => k !== 'caption').sort());
  });
});
