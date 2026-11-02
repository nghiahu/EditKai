import type React from 'react';
import type { Layer } from '../src/plan/types';

/** Style for the base video at time `t` (seconds) from the active `transition` layers; {} when none is active. */
export function transitionStyle(layers: Layer[], t: number): React.CSSProperties {
  let style: React.CSSProperties = {};
  for (const l of layers) {
    if (l.type !== 'transition' || t < l.start || t >= l.end) continue;
    const intensity = Math.sin(Math.PI * ((t - l.start) / (l.end - l.start)));
    const kind = (l.props?.kind as string) ?? 'zoom';
    if (kind === 'zoom') style = { transform: `scale(${(1 + 0.15 * intensity).toFixed(3)})` };
    else if (kind === 'blur') style = { filter: `blur(${(14 * intensity).toFixed(2)}px)` };
    else if (kind === 'slide') style = { transform: `translateX(${(-80 * intensity).toFixed(1)}px)` };
  }
  return style;
}
