import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadTheme, DEFAULT_MOTION } from '../../src/style/theme';

describe('loadTheme', () => {
  it('loads s1', () => {
    const t = loadTheme('styles/s1');
    expect(t.name).toBe('s1');
    expect(t.colors.navy).toBe('#0B1530');
    expect(t.colors.teal).toBe('#2DE2D0');
    expect(t.colors.orange).toBe('#FF9A3C');
    expect(t.limits.maxCaptionWords).toBe(8);
    expect(t.limits.minSceneSec).toBe(1.5);
  });
  it('loads m1', () => {
    const t = loadTheme('styles/m1');
    expect(t.name).toBe('m1');
    expect(t.colors.black).toBe('#0A0A0A');
    expect(t.colors.yellow).toBe('#FFD93D');
    expect(t.limits.maxCaptionWords).toBe(4);
    expect(t.limits.minSceneSec).toBe(1.0);
    expect(t.limits.safeZone).toEqual({ top: 0.08, bottom: 0.18, left: 0.06, right: 0.06 });
  });
  it('throws a clear error for a missing style', () => {
    expect(() => loadTheme('styles/nope')).toThrow(/styles\/nope/);
  });
  it('exposes the motion values of each style', () => {
    expect(loadTheme('styles/s1').motion).toEqual({ spring: { damping: 22, stiffness: 120, mass: 1 }, staggerFrames: 5, exitFrames: 10, wordLeadSec: 0.08, punchScale: 1.06 });
    expect(loadTheme('styles/m1').motion).toEqual({ spring: { damping: 12, stiffness: 220, mass: 1 }, staggerFrames: 3, exitFrames: 6, wordLeadSec: 0.08, punchScale: 1.12 });
  });
  it('fills a theme.json without motion from DEFAULT_MOTION', () => {
    const dir = mkdtempSync(join(tmpdir(), 'editkai-style-'));
    const raw = JSON.parse(readFileSync('styles/s1/theme.json', 'utf8'));
    delete raw.motion;
    mkdirSync(join(dir, 's'));
    writeFileSync(join(dir, 's', 'theme.json'), JSON.stringify(raw));
    expect(loadTheme(join(dir, 's')).motion).toEqual(DEFAULT_MOTION);
    rmSync(dir, { recursive: true, force: true });
  });
});
