import { describe, it, expect } from 'vitest';
import { loadTheme } from '../../src/style/theme';
import { easeInOut, pop, staggerDelay, enterExit, drawProgress, wordProgress } from '../../remotion/motion';

const s1 = loadTheme('styles/s1').motion;
const m1 = loadTheme('styles/m1').motion;
const FPS = 30;

describe('easeInOut', () => {
  it('hits 0, 0.5 and 1 and clamps outside', () => {
    expect([easeInOut(0), easeInOut(0.5), easeInOut(1)]).toEqual([0, 0.5, 1]);
    expect(easeInOut(-1)).toBe(0);
    expect(easeInOut(2)).toBe(1);
  });
});

describe('pop', () => {
  it('is 0 at frame 0 and settles at 1 for s1', () => {
    expect(pop(0, FPS, s1)).toBe(0);
    expect(Math.abs(pop(60, FPS, s1) - 1)).toBeLessThan(0.02);
  });
  it('m1 overshoots 1 at some frame in 0..20', () => {
    expect(Math.max(...Array.from({ length: 21 }, (_, f) => pop(f, FPS, m1)))).toBeGreaterThan(1);
  });
  it('stays 0 until its delay', () => {
    expect(pop(4, FPS, s1, 5)).toBe(0);
    expect(pop(20, FPS, s1, 5)).toBeGreaterThan(0.5);
  });
});

describe('staggerDelay', () => {
  it('is i * staggerFrames', () => {
    expect(staggerDelay(2, s1)).toBe(10);
    expect(staggerDelay(2, m1)).toBe(6);
  });
});

describe('enterExit', () => {
  it('is hidden at frame 0, fully visible mid-layer and hidden at the last frame', () => {
    expect(enterExit(0, 60, s1, FPS).visible).toBe(0);
    expect(enterExit(30, 60, s1, FPS).visible).toBeGreaterThanOrEqual(0.95);
    expect(enterExit(59, 60, s1, FPS).visible).toBe(0);
  });
  it('exit is exactly 1 at the last frame', () => {
    expect(enterExit(59, 60, m1, FPS).exit).toBe(1);
    expect(enterExit(0, 1, m1, FPS).exit).toBe(1);
  });
  it('stays finite and inside [0,1] for layers shorter than the exit window', () => {
    for (const dur of [1, 2, 6]) {
      for (let f = 0; f < dur; f++) {
        const r = enterExit(f, dur, s1, FPS);
        for (const v of [r.enter, r.exit, r.visible]) expect(Number.isFinite(v)).toBe(true);
        expect(r.visible).toBeGreaterThanOrEqual(0);
        expect(r.visible).toBeLessThanOrEqual(1);
        expect(r.exit).toBeGreaterThanOrEqual(0);
        expect(r.exit).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('drawProgress', () => {
  it('is monotonic from 0 to 1', () => {
    const v = Array.from({ length: 15 }, (_, f) => drawProgress(f, 2, 10));
    expect(v[0]).toBe(0);
    expect(v[14]).toBe(1);
    for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThanOrEqual(v[i - 1]);
  });
  it('survives a zero length', () => {
    expect(Number.isFinite(drawProgress(5, 5, 0))).toBe(true);
  });
});

describe('wordProgress', () => {
  it('is 0 before s - lead and 1 once the word is over', () => {
    const w = { s: 1, e: 1.4 };
    expect(wordProgress(w, 1 - s1.wordLeadSec - 0.01, s1)).toBe(0);
    expect(wordProgress(w, 1.4, s1)).toBe(1);
    expect(wordProgress(w, 2, s1)).toBe(1);
  });
  it('stays finite and inside [0,1] for a zero-duration word and a word with s > e', () => {
    for (const w of [{ s: 1, e: 1 }, { s: 2, e: 1 }]) {
      for (let t = 0; t <= 3; t += 0.05) {
        const p = wordProgress(w, t, m1);
        expect(Number.isFinite(p)).toBe(true);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('enterExit on short layers', () => {
  it('reaches full opacity at its peak for layers shorter than enter + exit', () => {
    for (const motion of [s1, m1]) {
      for (const dur of [6, 9, 12, 20]) {
        const peak = Math.max(...Array.from({ length: dur }, (_, f) => enterExit(f, dur, motion, FPS).visible));
        expect(peak).toBeGreaterThanOrEqual(0.99);
        expect(peak).toBeLessThanOrEqual(1);
      }
    }
  });
  it('is still hidden on the first and last frame of a short layer', () => {
    for (const dur of [6, 12]) {
      expect(enterExit(0, dur, m1, FPS).visible).toBe(0);
      expect(enterExit(dur - 1, dur, m1, FPS).visible).toBe(0);
    }
  });
  it('a single-frame layer stays at 0 (nothing to peak)', () => {
    expect(enterExit(0, 1, s1, FPS).visible).toBe(0);
  });
});
