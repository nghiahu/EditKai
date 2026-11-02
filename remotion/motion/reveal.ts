import type { Motion } from '../../src/style/motion';
import { clamp01, easeInOut } from './ease';
import { pop } from './spring';

/**
 * Enter/exit envelope of a layer lasting `durationFrames`.
 * `exit` runs 0 → 1 over the last `exitFrames` frames (the whole layer if it is shorter) and is exactly 1 on the last frame,
 * so a finished layer is fully invisible. `visible` is what components multiply their opacity/scale by.
 */
export function enterExit(frame: number, durationFrames: number, motion: Motion, fps = 30): { enter: number; exit: number; visible: number } {
  const dur = Math.max(1, durationFrames);
  const window = Math.min(motion.exitFrames, dur);
  const start = dur - window;
  const raw = window > 1 ? (frame - start) / (window - 1) : frame >= start ? 1 : 0;
  const exit = easeInOut(raw);
  const enter = Math.max(0, pop(frame, fps, motion));
  return { enter, exit, visible: clamp01(enter) * (1 - exit) };
}
