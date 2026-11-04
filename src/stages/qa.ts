import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readManifest } from '../assets/manifest';
import { probe } from '../media/probe';
import type { Transcript } from '../media/transcribe';
import type { Issue } from '../plan/types';
import { validatePlan } from '../qa/validate';
import { loadTheme } from '../style/theme';
import { readPlan } from '../plan/io';
import { resolveFraming } from '../plan/framing';
import { measureCaptionBright } from './captionBright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MAX_ROUNDS = 3;

export interface QaReport { round: number; maxRounds: number; stop?: true; issues: Issue[] }

export function resetQaRounds(projectDir: string): void {
  rmSync(join(projectDir, 'qa-rounds.json'), { force: true });
}

/** Validate plan.json against its video and (if present) transcript. */
export async function checkProject(projectDir: string): Promise<Issue[]> {
  const plan = readPlan(projectDir);
  const theme = loadTheme(join(root, 'styles', plan.meta.style));
  const video = join(projectDir, plan.meta.source);
  if (!existsSync(video)) throw new Error(`Không tìm thấy video nguồn ${plan.meta.source}`);
  const transcriptFile = join(projectDir, 'transcript.json');
  const transcript = existsSync(transcriptFile) ? (JSON.parse(readFileSync(transcriptFile, 'utf8')) as Transcript) : undefined;
  // a corrupt assets.json must not stop validation: it becomes one warning
  let assets: { file: string; durationSec?: number }[] | undefined;
  const extra: Issue[] = [];
  try {
    assets = [];
    (readManifest(projectDir).assets as unknown[]).forEach((a, i) => {
      const entry = a as { file?: unknown; durationSec?: unknown } | null;
      if (entry && typeof entry === 'object' && typeof entry.file === 'string') {
        assets!.push({ file: entry.file, ...(typeof entry.durationSec === 'number' ? { durationSec: entry.durationSec } : {}) });
      } else {
        extra.push({ severity: 'warning', code: 'asset-manifest-invalid', message: `assets.json: mục thứ ${i + 1} phải là đối tượng có "file" (chuỗi)` });
      }
    });
  } catch (e) {
    assets = undefined;
    extra.push({ severity: 'warning', code: 'asset-manifest-invalid', message: (e as Error).message });
  }
  const issues = validatePlan(plan, theme, {
    durationSec: (await probe(video)).durationSec,
    fileExists: p => existsSync(join(projectDir, p)),
    transcript,
    assets,
    captionBright: await measureCaptionBright(video, plan.layers.filter(l => l.track === 'caption'), theme, plan.meta.width, { width: plan.meta.width, height: plan.meta.height, ...resolveFraming(plan.meta) }),
  });
  return [...issues, ...extra];
}

/** One QA round: validate plan.json, count the round, and tell the AI to stop after MAX_ROUNDS rounds with issues left. */
export async function runQa(projectDir: string): Promise<QaReport> {
  const issues = await checkProject(projectDir);

  const roundsFile = join(projectDir, 'qa-rounds.json');
  if (issues.length === 0) { rmSync(roundsFile, { force: true }); return { round: 1, maxRounds: MAX_ROUNDS, issues }; }
  const round = (existsSync(roundsFile) ? (JSON.parse(readFileSync(roundsFile, 'utf8')).round as number) : 0) + 1;
  writeFileSync(roundsFile, JSON.stringify({ round }));
  return { round, maxRounds: MAX_ROUNDS, ...(round >= MAX_ROUNDS ? { stop: true as const } : {}), issues };
}
