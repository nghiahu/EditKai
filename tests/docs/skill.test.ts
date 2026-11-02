import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { LAYER_TYPES } from '../../src/plan/layerTypes';
import { iconNames } from '../../remotion/icons';

const skill = readFileSync('SKILL.md', 'utf8');
const missing = (names: string[]) => names.filter(n => !skill.includes(n));

describe('SKILL.md covers the plan vocabulary', () => {
  it('mentions every layer type', () => expect(missing(Object.keys(LAYER_TYPES))).toEqual([]));
  it('mentions every icon name', () => expect(missing(iconNames)).toEqual([]));
  it('mentions every explainer body kind and mode', () => expect(missing(['list', 'card', 'waveform', 'progress', 'phone', 'overlay', 'full'])).toEqual([]));
  it('mentions every transition kind', () => expect(missing(['zoom', 'blur', 'slide', 'push', 'flash'])).toEqual([]));
  it('mentions the camera track', () => expect(missing(['camera'])).toEqual([]));
});

describe('style rules mention the motion pass features', () => {
  it('m1 rules use zoom-punch and overlay', () => {
    const r = readFileSync('styles/m1/rules.md', 'utf8');
    expect(r).toContain('zoom-punch');
    expect(r).toContain('overlay');
  });
  it('s1 rules mention waveform or progress and camera', () => {
    const r = readFileSync('styles/s1/rules.md', 'utf8');
    expect(/waveform|progress/.test(r)).toBe(true);
    expect(r).toContain('camera');
  });
});
