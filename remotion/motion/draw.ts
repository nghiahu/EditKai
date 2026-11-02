import { easeOut } from './ease';

/** Eased 0 → 1 progress of a line being drawn from `start` over `lengthFrames` (clamped, safe for a zero length). */
export function drawProgress(frame: number, start: number, lengthFrames: number): number {
  return easeOut((frame - start) / Math.max(1, lengthFrames));
}
