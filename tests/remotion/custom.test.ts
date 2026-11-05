import { afterAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderStill, selectComposition } from '@remotion/renderer';
import { bundleProject, customComponentNames } from '../../src/stages/customBundle';
import { loadTheme } from '../../src/style/theme';
import { planOf } from './helper';
import type { Layer } from '../../src/plan/types';

const T = 400000;
const base = mkdtempSync(join(tmpdir(), 'editkai-custom-'));
afterAll(() => rmSync(base, { recursive: true, force: true }));

const dot = (color: string) => `import React from 'react';
import { AbsoluteFill } from 'remotion';
import { easeValue } from '@kit';
import type { CustomComponentProps } from '@kit';
export default function Dot({ t, data, u }: CustomComponentProps) {
  const x = 200 + easeValue(Math.min(1, t), 'out') * 300 * u;
  return <AbsoluteFill><div style={{ position: 'absolute', left: x, top: 800, width: 160, height: 160, borderRadius: 80, background: ${JSON.stringify(color)} }}>{String(data.label ?? '')}</div></AbsoluteFill>;
}
`;
function project(name: string, files: Record<string, string>): string {
  const dir = join(base, name);
  mkdirSync(join(dir, 'components'), { recursive: true });
  for (const [f, src] of Object.entries(files)) writeFileSync(join(dir, 'components', f), src);
  return dir;
}
const layer = (component: string): Layer => ({ id: 'c1', track: 'graphic', type: 'custom', start: 0, end: 3, props: { component, data: { label: 'x' } } } as Layer);

async function still(dir: string, component: string, frame: number): Promise<Buffer> {
  const b = await bundleProject(dir);
  try {
    const plan = planOf('m1', [layer(component)], 3);
    const inputProps = { plan, theme: loadTheme('styles/m1'), videoSrc: '', durationSec: 3 };
    const composition = await selectComposition({ serveUrl: b.serveUrl, id: 'PlanVideo', inputProps });
    const output = join(base, `s-${Math.random().toString(36).slice(2)}.png`);
    await renderStill({ composition, serveUrl: b.serveUrl, output, frame, inputProps });
    return readFileSync(output);
  } finally {
    await b.close();
  }
}

describe('customComponentNames', () => {
  it('lists the valid names of components/*.tsx, sorted, and ignores other files and bad names', () => {
    const dir = project('names', { 'b-two.tsx': '', 'a.tsx': '', 'Bad.tsx': '', 'notes.md': '', 'x_y.tsx': '' });
    expect(customComponentNames(dir)).toEqual(['a', 'b-two']);
    expect(customComponentNames(join(base, 'no-such-project'))).toEqual([]);
  });
});

describe('a component written for one project is drawn by the render', () => {
  it('moves with the frame, uses @kit, reads data, and the bundle is removed on close', async () => {
    const dir = project('p1', { 'dot.tsx': dot('#ff00ff') });
    const b = await bundleProject(dir);
    expect(existsSync(b.serveUrl)).toBe(true);
    await b.close();
    expect(existsSync(b.serveUrl)).toBe(false);
    const a = await still(dir, 'dot', 3);
    const c = await still(dir, 'dot', 40);
    expect(a.equals(c)).toBe(false);
  }, T);
  it('two projects with a component of the same name do not mix', async () => {
    const pink = await still(project('p-pink', { 'dot.tsx': dot('#ff00ff') }), 'dot', 40);
    const green = await still(project('p-green', { 'dot.tsx': dot('#00ff00') }), 'dot', 40);
    expect(pink.equals(green)).toBe(false);
  }, T);
  it('a layer that names a component the project does not have stops the render with its name', async () => {
    await expect(still(project('p-none', { 'dot.tsx': dot('#ff00ff') }), 'missing-one', 3)).rejects.toThrow(/missing-one/);
  }, T);
  it('a project without components still bundles (nothing to load)', async () => {
    const dir = join(base, 'empty');
    mkdirSync(dir);
    const b = await bundleProject(dir);
    expect(existsSync(b.serveUrl)).toBe(true);
    await b.close();
  }, T);
});
