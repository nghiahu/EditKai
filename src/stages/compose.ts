import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readManifest } from '../assets/manifest';
import { captionLayers } from '../director/captions';
import { cameraLayers, insertLayers } from '../director/inserts';
import { buildScenes } from '../director/scenes';
import { readStoryboard, validateStoryboard } from '../director/storyboard';
import { probe } from '../media/probe';
import type { Plan } from '../plan/types';
import { loadTheme } from '../style/theme';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export interface ComposeReport {
  captions: Record<'phrase' | 'label' | 'big', number>;
  inserts: { kept: number; moved: object[]; dropped: object[] };
  camera: { kept: number; dropped: object[] };
  unreviewedBeats: number;
  unusedAssets: string[];
  issues: string[];
}

/** storyboard.json + transcript.json + cleaned.mp4 → plan.json (plan.next.json when plan.json exists) and compose-report.json. */
export async function composeStage(projectDir: string): Promise<{ planFile: string; report: ComposeReport }> {
  if (!existsSync(join(projectDir, 'storyboard.json'))) throw new Error('Chưa có storyboard.json — chạy analyze trước');
  const sb = readStoryboard(projectDir);
  const transcriptFile = join(projectDir, 'transcript.json');
  if (!existsSync(transcriptFile)) throw new Error('Chưa có transcript.json — chạy clean trước');
  let words: { t: string; s: number; e: number }[];
  try {
    words = JSON.parse(readFileSync(transcriptFile, 'utf8')).words ?? [];
  } catch (e) {
    throw new Error(`transcript.json không phải JSON hợp lệ: ${(e as Error).message}`);
  }
  const video = join(projectDir, 'cleaned.mp4');
  if (!existsSync(video)) throw new Error('Chưa có cleaned.mp4 — chạy clean trước');
  const project = JSON.parse(readFileSync(join(projectDir, 'project.json'), 'utf8')) as { style: string; fps?: number; width: number; height: number };
  const theme = loadTheme(join(root, 'styles', project.style));
  const durationSec = (await probe(video)).durationSec;

  const issues = validateStoryboard(sb, words.length, durationSec);
  const caps = captionLayers(sb, words, theme.limits, durationSec);
  issues.push(...caps.issues);
  const ins = insertLayers(sb, durationSec);
  const cam = cameraLayers(sb, theme.director, durationSec);
  const layers = [...caps.layers, ...ins.layers, ...cam.layers];

  const plan: Plan = {
    version: 1,
    meta: { source: 'cleaned.mp4', fps: project.fps ?? 30, width: project.width, height: project.height, style: project.style },
    scenes: buildScenes(sb, layers, theme.limits, durationSec),
    layers,
  };

  const used = new Set(layers.map(l => (l.props as { src?: unknown } | undefined)?.src).filter((s): s is string => typeof s === 'string'));
  const captions = { phrase: 0, label: 0, big: 0 };
  for (const l of caps.layers) captions[((l.props as { variant?: 'label' | 'big' } | undefined)?.variant ?? 'phrase')]++;
  const report: ComposeReport = {
    captions,
    inserts: { kept: ins.layers.length, moved: ins.moved, dropped: ins.dropped },
    camera: { kept: cam.layers.length, dropped: cam.dropped },
    unreviewedBeats: sb.beats.filter(b => !b.reviewed).length,
    unusedAssets: readManifest(projectDir).assets.map(a => a.file).filter(f => typeof f === 'string' && !used.has(f)),
    issues,
  };

  const planFile = join(projectDir, existsSync(join(projectDir, 'plan.json')) ? 'plan.next.json' : 'plan.json');
  writeFileSync(planFile, JSON.stringify(plan, null, 2));
  writeFileSync(join(projectDir, 'compose-report.json'), JSON.stringify(report, null, 2));
  return { planFile, report };
}
