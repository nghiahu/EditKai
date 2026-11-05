import { describe, expect, it } from 'vitest';
import { cueVolumes } from '../../src/audio/volumes';
import { SFX_VOLUME } from '../../src/audio/gain';
import type { Layer, Plan } from '../../src/plan/types';

const plan = (layers: Layer[], sfx?: Plan['meta']['sfx']): Plan => ({
  version: 1, meta: { source: 'cleaned.mp4', fps: 30, width: 1080, height: 1920, style: 'm1', ...(sfx ? { sfx } : {}) }, scenes: [], layers,
});
const card = (id: string, start: number): Layer => ({ id, track: 'graphic', type: 'stat-card', start, end: start + 2, props: { rows: [{ value: 'x' }] } } as Layer);
const levels = (loud: Record<number, number>, n = 100) => Array.from({ length: n }, (_, i) => loud[i] ?? -80); // chunk i is 0.1 s: 10 s of -80 dB with some chunks louder

describe('cueVolumes', () => {
  it('one volume per sound effect, in the order sfxCues gives them', () => {
    const p = plan([card('a', 2), card('b', 8)]);
    expect(cueVolumes(p, levels({}))).toHaveLength(2);
    expect(cueVolumes(plan([]), levels({}))).toEqual([]);
  });
  it('an effect over a louder voice is louder than one over a quieter voice, and silence gives the ceiling', () => {
    const p = plan([card('a', 2), card('b', 5), card('c', 8)]);
    const v = cueVolumes(p, levels({ 20: -30, 21: -30, 22: -30, 50: -22, 51: -22, 52: -22 }));
    expect(v[0]).toBeLessThan(v[1]);
    expect(v[2]).toBe(SFX_VOLUME); // nothing but silence around 8 s
  });
  it('meta.sfx.volume is the ceiling and meta.sfx.density sets how far above the voice', () => {
    const loud = levels({ 20: -10, 21: -10, 22: -10 });
    const p = (sfx: Plan['meta']['sfx']) => plan([card('a', 2)], sfx);
    expect(cueVolumes(p({ volume: 0.1 }), loud)[0]).toBe(0.1);
    const [restrained] = cueVolumes(p({ density: 'restrained', volume: 1 }), levels({ 20: -30, 21: -30, 22: -30 }));
    const [rich] = cueVolumes(p({ density: 'rich', volume: 1 }), levels({ 20: -30, 21: -30, 22: -30 }));
    expect(restrained).toBeLessThan(rich);
  });
  it('sound switched off gives no volumes at all', () => {
    expect(cueVolumes(plan([card('a', 2)], { enabled: false }), levels({}))).toEqual([]);
  });
});
