import { existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { sfxCues } from '../audio/cues';
import { writeSfxFiles } from '../audio/files';
import { cueVolumes } from '../audio/volumes';
import { voiceLevels } from '../audio/voiceLevel';
import { probe } from '../media/probe';
import { serveDir } from '../media/serve';
import { validatePlan } from '../qa/validate';
import { loadTheme } from '../style/theme';
import { readPlan } from '../plan/io';
import type { Plan } from '../plan/types';
import type { Theme } from '../style/theme';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export interface RenderSession {
  plan: Plan;
  theme: Theme;
  durationSec: number;
  serveUrl: string;
  inputProps: Record<string, unknown>;
  composition: Awaited<ReturnType<typeof selectComposition>>;
  /** Stops the file server and removes the bundle folder (a ~36 MB folder in the temp dir that Remotion never removes). */
  close: () => Promise<void>;
}

/** Validate plan.json (errors block, warnings print), serve the project folder and bundle the composition: what a render and a preview both need. */
export async function openRenderSession(projectDir: string): Promise<RenderSession> {
  if (!existsSync(join(projectDir, 'plan.json'))) throw new Error(`Chưa có plan.json trong ${projectDir}`);
  const plan = readPlan(projectDir);
  const theme = loadTheme(join(root, 'styles', plan.meta.style));
  const video = join(projectDir, plan.meta.source);
  if (!existsSync(video)) throw new Error(`Không tìm thấy video nguồn ${plan.meta.source}`);
  const { durationSec } = await probe(video);

  const issues = validatePlan(plan, theme, { durationSec, fileExists: p => existsSync(join(projectDir, p)) });
  for (const w of issues.filter(i => i.severity === 'warning')) console.warn(`[cảnh báo] ${w.code}: ${w.message}`);
  const errors = issues.filter(i => i.severity === 'error');
  if (errors.length) throw new Error(`Không thể render, plan có lỗi:\n${errors.map(e => `- [${e.code}] ${e.message}`).join('\n')}`);

  writeSfxFiles(projectDir); // the sound effects the plan may ask for, served with the project
  const server = await serveDir(projectDir);
  let serveUrl: string | undefined;
  const close = async () => {
    await server.close();
    if (serveUrl) rmSync(serveUrl, { recursive: true, force: true });
  };
  try {
    serveUrl = await bundle({ entryPoint: resolve(root, 'remotion', 'index.ts') });
    // each sound effect follows the loudness of the voice around it (one pass over the sound)
    const sfxVolumes = sfxCues(plan).length ? cueVolumes(plan, await voiceLevels(video)) : [];
    const inputProps = { plan, theme, videoSrc: `${server.url}/${plan.meta.source}`, assetBase: server.url, durationSec, sfxVolumes };
    const composition = await selectComposition({ serveUrl, id: 'PlanVideo', inputProps });
    return { plan, theme, durationSec, serveUrl, inputProps, composition, close };
  } catch (e) {
    await close();
    throw e;
  }
}

/** `scale` shrinks the picture and `fast` trades quality for speed (used by the preview video); the defaults render the full out.mp4. */
export interface RenderOptions { scale?: number; out?: string; fast?: boolean }

/** Validate plan.json (errors block, warnings print) and render out.mp4; returns its path. */
export async function renderStage(projectDir: string, opts: RenderOptions = {}): Promise<string> {
  const session = await openRenderSession(projectDir);
  try {
    const out = opts.out ?? join(projectDir, 'out.mp4');
    await renderMedia({
      composition: session.composition, serveUrl: session.serveUrl, codec: 'h264', outputLocation: out, inputProps: session.inputProps, timeoutInMilliseconds: 120000,
      ...(opts.scale ? { scale: opts.scale } : {}),
      ...(opts.fast ? { crf: 38, x264Preset: 'ultrafast' as const } : {}),
    });
    return out;
  } finally {
    await session.close();
  }
}
