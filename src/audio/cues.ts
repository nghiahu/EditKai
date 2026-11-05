import type { Layer, Plan } from '../plan/types';
import type { Sound } from './synth';

export interface SfxCue { t: number; sound: Sound; gain: number; layerId: string }

const MIN_GAP_SEC = 0.35;
const TRANSITION_LEAD_SEC = 0.15;
const TICK_STEP_SEC = 0.15;
const TICK_MAX = 8;
const CARDS = new Set(['logo-badge', 'stat-card', 'title-card', 'chip-stack', 'quote-card', 'explainer-scene', 'prompt-box', 'footage', 'step-number', 'callout']);
const GAIN: Record<Sound, number> = { whoosh: 1, swell: 1, pop: 0.8, tick: 0.5, thud: 0.9 };
const PRIORITY: Record<Sound, number> = { whoosh: 0, swell: 0, pop: 1, thud: 2, tick: 3 };

/**
 * The sound effects a plan asks for, in time order: a whoosh (swell for `dip`) just before the middle of a transition, a pop where a card
 * appears, a tick every 0.15 s (at most 8) as a counter starts, a thud on a zoom-punch. Two sounds closer than 0.35 s keep the more important
 * one; ticks only compete with other kinds. `meta.sfx.enabled: false` or `props.sound: false` on a layer turns sound off.
 */
export function sfxCues(plan: Plan): SfxCue[] {
  if (plan.meta.sfx?.enabled === false) return [];
  const all: SfxCue[] = [];
  const add = (l: Layer, t: number, sound: Sound) => all.push({ t, sound, gain: GAIN[sound], layerId: l.id });
  for (const l of plan.layers) {
    if ((l.props as { sound?: unknown } | undefined)?.sound === false) continue;
    if (l.type === 'transition') add(l, Math.max(l.start, (l.start + l.end) / 2 - TRANSITION_LEAD_SEC), (l.props as { kind?: unknown } | undefined)?.kind === 'dip' ? 'swell' : 'whoosh');
    else if (l.type && CARDS.has(l.type)) add(l, l.start, 'pop');
    else if (l.type === 'counter') {
      const n = Math.max(1, Math.min(TICK_MAX, Math.floor((l.end - l.start) / TICK_STEP_SEC)));
      for (let i = 0; i < n; i++) add(l, l.start + i * TICK_STEP_SEC, 'tick');
    } else if (l.track === 'camera' && l.type === 'zoom-punch') add(l, l.start, 'thud');
  }
  const kept: SfxCue[] = [];
  for (const c of [...all].sort((a, b) => PRIORITY[a.sound] - PRIORITY[b.sound] || a.t - b.t)) {
    const clash = kept.some(k => Math.abs(k.t - c.t) < MIN_GAP_SEC && !(k.sound === 'tick' && c.sound === 'tick'));
    if (!clash) kept.push(c);
  }
  return kept.sort((a, b) => a.t - b.t);
}
