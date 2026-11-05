import { PEAK } from './synth';

export const DENSITIES = ['restrained', 'standard', 'rich'] as const;
export type Density = (typeof DENSITIES)[number];

/**
 * How far the peak of a sound effect sits above the voice's loudest 0.1 s around it (RMS dB): a quiet bed under the voice, the usual level, a
 * lively one. Worked out so that `standard` on an ordinary speaking voice (about -20 dB) lands near the fixed 0.25 used before; not tuned by ear.
 */
export const DENSITY_OFFSET_DB: Record<Density, number> = { restrained: -3, standard: 3, rich: 9 };

const SILENT_BELOW_DB = -60; // a voice quieter than this is silence: nothing to follow

/** The volume (0-1) for a sound effect over a voice of `voiceDb` (undefined: not measured): the voice's level plus the density's offset, never above `cap`. */
export function sfxVolume(voiceDb: number | undefined, density: Density, cap: number): number {
  if (voiceDb === undefined || voiceDb < SILENT_BELOW_DB) return cap;
  return Math.min(cap, 10 ** ((voiceDb + DENSITY_OFFSET_DB[density]) / 20) / PEAK);
}
