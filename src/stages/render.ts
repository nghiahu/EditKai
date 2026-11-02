import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { probe } from '../media/probe';
import { serveDir } from '../media/serve';
import { validatePlan } from '../qa/validate';
import { loadTheme } from '../style/theme';
import type { Plan } from '../plan/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function readPlan(projectDir: string): Plan {
  const file = join(projectDir, 'plan.json');
  if (!existsSync(file)) throw new Error(`Chưa có plan.json trong ${projectDir}`);
  try { return JSON.parse(readFileSync(file, 'utf8')) as Plan; }
  catch (e) { throw new Error(`plan.json không phải JSON hợp lệ: ${(e as Error).message}`); }
}

/** Validate plan.json (errors block, warnings print) and render out.mp4; returns its path. */
export async function renderStage(projectDir: string): Promise<string> {
  const plan = readPlan(projectDir);
  const theme = loadTheme(join(root, 'styles', plan.meta.style));
  const video = join(projectDir, plan.meta.source);
  if (!existsSync(video)) throw new Error(`Không tìm thấy video nguồn ${plan.meta.source}`);
  const { durationSec } = await probe(video);

  const issues = validatePlan(plan, theme, { durationSec, fileExists: p => existsSync(join(projectDir, p)) });
  for (const w of issues.filter(i => i.severity === 'warning')) console.warn(`[cảnh báo] ${w.code}: ${w.message}`);
  const errors = issues.filter(i => i.severity === 'error');
  if (errors.length) throw new Error(`Không thể render, plan có lỗi:\n${errors.map(e => `- [${e.code}] ${e.message}`).join('\n')}`);

  const server = await serveDir(projectDir);
  try {
    const serveUrl = await bundle({ entryPoint: resolve(root, 'remotion', 'index.ts') });
    const inputProps = { plan, theme, videoSrc: `${server.url}/${plan.meta.source}`, assetBase: server.url, durationSec };
    const composition = await selectComposition({ serveUrl, id: 'PlanVideo', inputProps });
    const out = join(projectDir, 'out.mp4');
    await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: out, inputProps, timeoutInMilliseconds: 120000 });
    return out;
  } finally {
    await server.close();
  }
}
