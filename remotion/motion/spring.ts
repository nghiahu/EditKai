import { spring } from 'remotion';
import type { Motion } from '../../src/style/motion';

/** Spring 0 → 1 (may overshoot 1 for bouncy styles); exactly 0 before `delay` frames. */
export function pop(frame: number, fps: number, motion: Motion, delay = 0): number {
  if (frame < delay) return 0;
  return spring({ frame: frame - delay, fps, config: motion.spring });
}

/** Frames to wait before the i-th item of a staggered group starts. */
export function staggerDelay(i: number, motion: Motion): number {
  return i * motion.staggerFrames;
}
