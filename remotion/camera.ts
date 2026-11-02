import type React from 'react';
import type { Layer } from '../src/plan/types';
import type { Motion } from '../src/style/motion';
import { easeInOut } from './motion/ease';

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/**
 * Transform for the base video at `tSec` from the active camera layers (`zoom-punch`, `shake`); `{}` when none is active.
 * Intensity rises and falls with easeInOut over the layer. Everything is a pure function of time (no randomness).
 */
export function cameraStyle(layers: Layer[], tSec: number, motion: Motion): React.CSSProperties {
  const parts: string[] = [];
  let origin: string | undefined;
  for (const l of layers) {
    if (l.type !== 'zoom-punch' && l.type !== 'shake') continue;
    if (!(l.end > l.start) || tSec < l.start || tSec >= l.end) continue;
    const p = (tSec - l.start) / (l.end - l.start);
    const i = easeInOut(1 - Math.abs(2 * p - 1));
    if (l.type === 'zoom-punch') {
      const target = num(l.props?.scale) ?? motion.punchScale;
      parts.push(`scale(${(1 + (target - 1) * i).toFixed(4)})`);
      const f = l.props?.focus as { x?: unknown; y?: unknown } | undefined;
      origin = `${(num(f?.x) ?? 0.5) * 100}% ${(num(f?.y) ?? 0.4) * 100}%`;
    } else {
      const k = num(l.props?.intensity) ?? 1;
      parts.push(`translate(${(k * 4 * Math.sin(tSec * 47) * i).toFixed(2)}px, ${(k * 3 * Math.cos(tSec * 61) * i).toFixed(2)}px)`);
    }
  }
  return parts.length ? { transform: parts.join(' '), ...(origin ? { transformOrigin: origin } : {}) } : {};
}
