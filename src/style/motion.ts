// Browser-safe (no node imports): Remotion components and the Remotion Root import this directly.
export interface Motion {
  spring: { damping: number; stiffness: number; mass: number };
  staggerFrames: number;
  exitFrames: number;
  wordLeadSec: number;
  punchScale: number;
}

export const DEFAULT_MOTION: Motion = {
  spring: { damping: 22, stiffness: 120, mass: 1 },
  staggerFrames: 5,
  exitFrames: 8,
  wordLeadSec: 0.08,
  punchScale: 1.06,
};
