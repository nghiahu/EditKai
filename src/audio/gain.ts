import { PEAK } from './synth';

/** The ceiling of a sound effect's volume when meta.sfx.volume is not set. */
export const SFX_VOLUME = 0.12;

export const DENSITIES = ['restrained', 'standard', 'rich'] as const;
export type Density = (typeof DENSITIES)[number];

/**
 * How far the peak of a sound effect sits BELOW the voice's loudest 0.1 s around it (RMS dB). An effect must stay well under the voice: a first
 * version put it 3 dB above and it hurt a listener on headphones (voice and effect together reached full scale). Still not tuned by ear.
 */
export const DENSITY_OFFSET_DB: Record<Density, number> = { restrained: -18, standard: -12, rich: -6 };

const SILENT_BELOW_DB = -60; // a voice quieter than this is silence: nothing to follow

/** The volume (0-1) for a sound effect over a voice of `voiceDb` (undefined: not measured): the voice's level plus the density's offset, never above `cap`. */
export function sfxVolume(voiceDb: number | undefined, density: Density, cap: number): number {
  if (voiceDb === undefined || voiceDb < SILENT_BELOW_DB) return cap;
  return Math.min(cap, 10 ** ((voiceDb + DENSITY_OFFSET_DB[density]) / 20) / PEAK);
}
