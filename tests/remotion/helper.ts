import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadTheme } from '../../src/style/theme';
import type { Layer, Plan } from '../../src/plan/types';

let serveUrl: Promise<string> | undefined;
const outDir = mkdtempSync(join(tmpdir(), 'editkai-still-'));
let n = 0;

export const bundled = () => (serveUrl ??= bundle({ entryPoint: resolve('remotion/index.ts') }));

export function planOf(style: 's1' | 'm1', layers: Layer[], durationSec = 4): Plan {
  return {
    version: 1,
    meta: { source: 'cleaned.mp4', fps: 30, width: 1080, height: 1920, style },
    scenes: [{ id: 'sc1', start: 0, end: durationSec, role: 'talking-head' }],
    layers,
  };
}

/** Render one frame of the PlanVideo composition to a PNG and return its path. */
export async function stillOf(plan: Plan, frame: number, extra: Record<string, unknown> = {}): Promise<string> {
  const url = await bundled();
  const inputProps = { plan, theme: loadTheme(`styles/${plan.meta.style}`), videoSrc: '', durationSec: 4, ...extra };
  const composition = await selectComposition({ serveUrl: url, id: 'PlanVideo', inputProps });
  const output = join(outDir, `still-${n++}.png`);
  await renderStill({ composition, serveUrl: url, output, frame, inputProps });
  return output;
}
