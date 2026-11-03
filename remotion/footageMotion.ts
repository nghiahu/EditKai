import type React from 'react';
import type { FootageMotion } from '../src/plan/insertProps';

/**
 * Slow Ken Burns style for footage media at `progress` (0 → 1 over the layer): zoom 1 ↔ 1.12, or a horizontal pan of 4%
 * at a fixed scale of 1.08 so no edge shows. Non-finite progress counts as 0; values outside 0..1 are clamped.
 */
export function footageMotion(motion: FootageMotion, progress: number, focus: { x: number; y: number }): React.CSSProperties {
  if (motion === 'none') return {};
  const p = Number.isNaN(progress) ? 0 : Math.min(1, Math.max(0, progress));
  const transformOrigin = `${focus.x * 100}% ${focus.y * 100}%`;
  switch (motion) {
    case 'zoom-in': return { transform: `scale(${(1 + 0.12 * p).toFixed(4)})`, transformOrigin };
    case 'zoom-out': return { transform: `scale(${(1.12 - 0.12 * p).toFixed(4)})`, transformOrigin };
    case 'pan-left': return { transform: `translateX(${(2 - 4 * p).toFixed(3)}%) scale(1.0800)`, transformOrigin };
    case 'pan-right': return { transform: `translateX(${(-2 + 4 * p).toFixed(3)}%) scale(1.0800)`, transformOrigin };
  }
}
