import type React from 'react';
import type { Layer } from '../src/plan/types';
import { easeInOut } from './motion/ease';

/** Style for the base video at time `t` (seconds) from the active `transition` layers; {} when none is active (and for `flash`, which the component draws). */
export function transitionStyle(layers: Layer[], t: number): React.CSSProperties {
  let style: React.CSSProperties = {};
  for (const l of layers) {
    if (l.type !== 'transition' || !(l.end > l.start) || t < l.start || t >= l.end) continue;
    const i = easeInOut(1 - Math.abs(2 * ((t - l.start) / (l.end - l.start)) - 1));
    const kind = (l.props?.kind as string) ?? 'zoom';
    if (kind === 'zoom') style = { transform: `scale(${(1 + 0.15 * i).toFixed(3)})` };
    else if (kind === 'blur') style = { filter: `blur(${(14 * i).toFixed(2)}px)` };
    else if (kind === 'slide') style = { transform: `translateX(${(-80 * i).toFixed(1)}px)` };
    else if (kind === 'whip') style = { transform: `translateX(${(-200 * i).toFixed(1)}px)`, filter: `blur(${(12 * i).toFixed(2)}px)` };
    else if (kind === 'dip') style = { filter: `brightness(${(1 - 0.9 * i).toFixed(3)})` };
    else if (kind === 'push') style = { transform: `translateY(${(-60 * i).toFixed(1)}px) scale(${(1 + 0.06 * i).toFixed(3)})`, filter: `blur(${(4 * i).toFixed(2)}px)` };
  }
  return style;
}
