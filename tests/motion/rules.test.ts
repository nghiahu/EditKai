import { describe, expect, it } from 'vitest';
import { spring } from 'remotion';
import { breathe } from '../../remotion/motion';
import { loadTheme } from '../../src/style/theme';

const FPS = 30;
/** The first frame at which the spring is within 2% of its final value, for good. */
function settleFrames(motion: { spring: { damping: number; stiffness: number; mass: number } }): number {
  let last = 0;
  for (let f = 0; f < 120; f++) if (Math.abs(spring({ frame: f, fps: FPS, config: motion.spring }) - 1) > 0.02) last = f + 1;
  return last;
}

describe('motion rules (from claude-remotion-skill), measured on both styles', () => {
  for (const style of ['s1', 'm1']) {
    const motion = loadTheme(`styles/${style}`).motion;
    it(`${style}: an exit is much faster than an entrance (it takes under 60% of the frames the entrance needs to settle)`, () => {
      expect(motion.exitFrames).toBeLessThan(settleFrames(motion) * 0.6);
    });
    it(`${style}: items that arrive one after another are 3 to 6 frames apart`, () => {
      expect(motion.staggerFrames).toBeGreaterThanOrEqual(3);
      expect(motion.staggerFrames).toBeLessThanOrEqual(6);
    });
  }
});

describe('breathe: the slow idle motion of something that is held on screen', () => {
  it('stays within 1.5% of the size, comes back after two seconds, and is exactly 1 at the start', () => {
    expect(breathe(0, FPS)).toBe(1);
    for (let f = 0; f < 200; f++) expect(Math.abs(breathe(f, FPS) - 1)).toBeLessThanOrEqual(0.015);
    expect(breathe(2 * FPS, FPS)).toBeCloseTo(1, 9);
    expect(breathe(FPS / 2, FPS)).toBeGreaterThan(1); // half a second in: bigger
    expect(breathe(1.5 * FPS, FPS)).toBeLessThan(1);
  });
  it('follows the frame rate: the same second gives the same value at 60 fps', () => {
    expect(breathe(30, 30)).toBeCloseTo(breathe(60, 60), 9);
  });
});
