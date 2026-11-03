import type React from 'react';
import type { Layer } from '../src/plan/types';
import { insertDims } from '../src/plan/insertProps';
import type { Motion } from '../src/style/motion';
import { easeInOut } from './motion/ease';

const RAMP_SEC = 0.25;
const BRIGHTNESS_DROP = 0.45; // 1 → 0.55
const BLUR_PX = 6;

/**
 * Darkens and blurs the base video while a card sits over it (see insertDims for which layers do).
 * Ramps in and out over 0.25 s; several dimming layers at once use the strongest, never stacking.
 */
export function baseDim(layers: Layer[], tSec: number, _motion: Motion): React.CSSProperties {
  let a = 0;
  for (const l of layers) {
    if (!insertDims(l) || !(l.end > l.start) || tSec < l.start || tSec >= l.end) continue;
    a = Math.max(a, Math.min(easeInOut((tSec - l.start) / RAMP_SEC), easeInOut((l.end - tSec) / RAMP_SEC)));
  }
  return a > 0 ? { filter: `brightness(${(1 - BRIGHTNESS_DROP * a).toFixed(3)}) blur(${(BLUR_PX * a).toFixed(2)}px)` } : {};
}

/** Combines styles: `transform` and `filter` strings are concatenated, any other key is last-wins. */
export function mergeStyles(...styles: React.CSSProperties[]): React.CSSProperties {
  const out: Record<string, unknown> = {};
  for (const s of styles) {
    for (const [k, v] of Object.entries(s)) out[k] = (k === 'transform' || k === 'filter') && out[k] ? `${out[k]} ${v}` : v;
  }
  return out as React.CSSProperties;
}
