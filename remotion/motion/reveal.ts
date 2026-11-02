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
  const raw = envelope(frame, dur, motion, fps);
  if (dur > SHORT_LAYER_FRAMES) return raw;
  // A layer shorter than enter + exit would never get fully opaque (faint, unreadable text): rescale so its peak is 1.
  let peak = 0;
  for (let f = 0; f < dur; f++) peak = Math.max(peak, envelope(f, dur, motion, fps).visible);
  return peak > 0 ? { ...raw, visible: clamp01(raw.visible / peak) } : raw;
}

const SHORT_LAYER_FRAMES = 40;

function envelope(frame: number, dur: number, motion: Motion, fps: number): { enter: number; exit: number; visible: number } {
  const window = Math.min(motion.exitFrames, dur);
  const start = dur - window;
  const progress = window > 1 ? (frame - start) / (window - 1) : frame >= start ? 1 : 0;
  const exit = easeInOut(progress);
  const enter = Math.max(0, pop(frame, fps, motion));
  return { enter, exit, visible: clamp01(enter) * (1 - exit) };
}
