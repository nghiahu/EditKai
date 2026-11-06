import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFfmpeg } from '../../src/media/ffmpeg';
import { customCheck } from '../../src/stages/customCheck';
import type { Plan } from '../../src/plan/types';

let base: string;
let dir: string;
const T = 300000;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'editkai-ccheck-'));
  dir = join(base, 'dự án kiểm');
  mkdirSync(join(dir, 'components'), { recursive: true });
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

const imp = "import React from 'react';\nimport { AbsoluteFill } from 'remotion';\n";
const dot = (left: string) => `${imp}export default function A() { return <AbsoluteFill><div style={{ position: 'absolute', left: ${left}, top: 250, width: 100, height: 100, background: '#ff00ff' }} /></AbsoluteFill>; }\n`;
const COMPONENTS: Record<string, string> = {
  good: dot('130'),
  blank: `${imp}export default function A() { return <AbsoluteFill />; }\n`,
  throws: `${imp}export default function A(): React.ReactElement { throw new Error('hỏng rồi'); }\n`,
  wide: `${imp}export default function A() { return <AbsoluteFill><div style={{ position: 'absolute', left: 0, top: 250, width: 360, height: 100, background: '#ff00ff' }} /></AbsoluteFill>; }\n`,
};

async function setup(layers: Record<string, Record<string, unknown>>, names = Object.keys(layers)) {
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=gray:s=360x640:r=30:d=3', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100:duration=3',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', join(dir, 'cleaned.mp4')]);
  for (const n of names) writeFileSync(join(dir, 'components', `${n}.tsx`), COMPONENTS[n]);
  const plan: Plan = {
    version: 1, meta: { source: 'cleaned.mp4', fps: 30, width: 360, height: 640, style: 'm1' },
    scenes: [{ id: 'sc1', start: 0, end: 3, role: 'talking-head' }],
    layers: Object.entries(layers).map(([n, extra], i) => ({ id: `k-${n}`, track: 'graphic', type: 'custom', start: 0.3 + i * 0.9, end: 1.1 + i * 0.9, props: { component: n, ...extra } })) as Plan['layers'],
  };
  writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan));
}

describe('customCheck', () => {
  it('a component that draws is fine: no issues, a picture of its start, middle and end in custom-check/, with the time each took', async () => {
    await setup({ good: {} });
    const r = await customCheck(dir);
    expect(r.issues).toEqual([]);
    expect(r.frames).toHaveLength(3);
    expect(r.frames.map(f => f.t)).toEqual([...r.frames.map(f => f.t)].sort((a, b) => a - b));
    for (const f of r.frames) { expect(existsSync(f.file)).toBe(true); expect(f.ms).toBeGreaterThan(0); expect(f.layerId).toBe('k-good'); }
  }, T);
  it('a component that throws is an error custom-throws with its message', async () => {
    await setup({ throws: {} });
    const [e] = (await customCheck(dir)).issues;
    expect(e.code).toBe('custom-throws');
    expect(e.severity).toBe('error');
    expect(e.layerId).toBe('k-throws');
    expect(e.message).toContain('hỏng rồi');
  }, T);
  it('a component that draws nothing at all is an error custom-blank', async () => {
    await setup({ blank: {} });
    const r = await customCheck(dir);
    expect(r.issues.map(i => i.code)).toEqual(['custom-blank']);
    expect(r.issues[0].severity).toBe('error');
  }, T);
  it('drawing beyond the declared w and h is a warning custom-out-of-box; inside it, or with no w and h, is not', async () => {
    await setup({ wide: { anchor: 'top', w: 0.3, h: 0.2 }, good: { anchor: 'center', w: 0.5, h: 0.4 } });
    const r = await customCheck(dir);
    expect(r.issues.map(i => [i.code, i.layerId, i.severity])).toEqual([['custom-out-of-box', 'k-wide', 'warning']]);
  }, T);
  it('a name limits the check to that component; an unknown name is a clear error', async () => {
    await setup({ good: {}, blank: {} });
    const only = await customCheck(dir, { name: 'good' });
    expect(only.issues).toEqual([]);
    expect(only.frames.every(f => f.layerId === 'k-good')).toBe(true);
    await expect(customCheck(dir, { name: 'khong-co' })).rejects.toThrow(/khong-co/);
  }, T);
  it('a plan with no custom layer is a clear error, and the pictures of an earlier check are replaced', async () => {
    await setup({ good: {} });
    mkdirSync(join(dir, 'custom-check'));
    writeFileSync(join(dir, 'custom-check', 'cu.png'), 'x');
    await customCheck(dir);
    expect(existsSync(join(dir, 'custom-check', 'cu.png'))).toBe(false);
    writeFileSync(join(dir, 'plan.json'), JSON.stringify({ ...JSON.parse(readFileSync(join(dir, 'plan.json'), 'utf8')), layers: [] }));
    await expect(customCheck(dir)).rejects.toThrow(/custom/);
  }, T);
});
