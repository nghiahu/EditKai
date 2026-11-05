import type { Plan } from '../plan/types';
import { sfxCues } from './cues';
import { SFX_VOLUME, sfxVolume } from './gain';
import { levelAround } from './voiceLevel';

/** The volume of each sound effect of `plan` (same order as `sfxCues`), from the loudness of the voice around it, the plan's density and its ceiling (meta.sfx.volume). */
export function cueVolumes(plan: Plan, voiceLevels: number[]): number[] {
  const cap = plan.meta.sfx?.volume ?? SFX_VOLUME;
  const density = plan.meta.sfx?.density ?? 'standard';
  return sfxCues(plan).map(c => sfxVolume(levelAround(voiceLevels, c.t), density, cap));
}
