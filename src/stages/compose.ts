import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readManifest } from '../assets/manifest';
import { captionLayers } from '../director/captions';
import { cameraLayers, insertLayers } from '../director/inserts';
import { buildScenes } from '../director/scenes';
import { normalizeStoryboard, readStoryboard, validateStoryboard } from '../director/storyboard';
import { probe } from '../media/probe';
import { readPlan } from '../plan/io';
import type { Layer, Plan } from '../plan/types';
import { framingProblem, resolveFraming } from '../plan/framing';
import { placeAwayFromFaces, placeCaptionsAwayFromFaces } from '../director/faceAvoid';
import { resolveAnchors } from '../plan/sceneAnchors';
import { mapFacesToFrame, readFaces } from '../media/faces';
import { BRIGHT_SHARE, validatePlan } from '../qa/validate';
import { measureCaptionBright } from './captionBright';
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

/** Layers whose id is in `taken` get a new id (same prefix, next free number), so the ids stay unique against an existing plan. */
function freshIds(layers: Layer[], taken: Set<string>): Layer[] {
  const all = new Set([...taken, ...layers.map(l => l.id)]);
  const next: Record<string, number> = {};
  const num = (id: string) => Number(/(\d+)$/.exec(id)?.[1] ?? 0);
  const prefix = (id: string) => id.replace(/\d+$/, '');
  for (const id of all) next[prefix(id)] = Math.max(next[prefix(id)] ?? 0, num(id));
  return layers.map(l => {
    if (!taken.has(l.id)) return l;
    const p = prefix(l.id);
    return { ...l, id: p + (++next[p]) };
  });
}

/** storyboard.json + transcript.json + cleaned.mp4 → plan.json (plan.next.json when plan.json exists) and compose-report.json. */
export async function composeStage(projectDir: string): Promise<{ planFile: string; report: ComposeReport }> {
  if (!existsSync(join(projectDir, 'storyboard.json'))) throw new Error('Chưa có storyboard.json — chạy analyze trước');
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
  const project = JSON.parse(readFileSync(join(projectDir, 'project.json'), 'utf8')) as { style: string; fps?: number; width: number; height: number; fit?: unknown; focus?: unknown };
  const theme = loadTheme(join(root, 'styles', project.style));
  const info = await probe(video);
  const durationSec = info.durationSec;

  const fileExists = (p: string) => existsSync(join(projectDir, p));
  const normalized = normalizeStoryboard(readStoryboard(projectDir));
  const sb = normalized.sb;
  const issues = [...normalized.issues, ...validateStoryboard(sb, words.length, durationSec, fileExists)];
  const caps = captionLayers(sb, words, theme.limits, durationSec);
  issues.push(...caps.issues);
  const ins = insertLayers(sb, durationSec, fileExists);
  const cam = cameraLayers(sb, theme.director, durationSec);
  // white text on a bright picture (a white panel in the source, say) disappears: those captions are set in the style's yellow (with the dark outline)
  const framed = framingProblem({ fit: project.fit, focus: project.focus }) ? resolveFraming(undefined) : resolveFraming({ fit: project.fit, focus: project.focus } as Plan['meta']);
  const bright = await measureCaptionBright(video, caps.layers, theme, project.width, { width: project.width, height: project.height, ...framed });
  for (const l of caps.layers) if ((bright.get(l.id) ?? 0) > BRIGHT_SHARE) l.props = { ...l.props, ink: 'accent' };
  // a card that would sit on the speaker's face moves to the top or bottom (faces.json comes from the `faces` command)
  const found = readFaces(projectDir);
  const frameFaces = found && mapFacesToFrame(found, info, project, framed);
  // a scene's times may be spoken words: they become seconds since the scene started (a word that is not there stays, and the validator below drops the scene)
  const withAnchors = ins.layers.map(l => {
    if (l.type !== 'scene' || !l.props) return l;
    const r = resolveAnchors(l.props, words, l.start);
    issues.push(...r.issues.map(m => `${l.id}: ${m}`));
    return { ...l, props: r.props };
  });
  const insertLayersAway = placeAwayFromFaces(withAnchors, frameFaces, theme, project.width, project.height);
  const captionLayersAway = placeCaptionsAwayFromFaces(caps.layers, frameFaces, theme);
  let layers = [...captionLayersAway, ...insertLayersAway, ...cam.layers];

  // a regenerated plan is merged into plan.json later: its ids must not clash with the ones already there
  const existingFile = join(projectDir, 'plan.json');
  if (existsSync(existingFile)) {
    try { layers = freshIds(layers, new Set(readPlan(projectDir).layers.map(l => l.id))); } catch { /* unreadable plan.json: nothing to avoid */ }
  }

  // how the source sits in the frame (project.json: fit, focus) goes into the plan; a value that does not make sense is left out and reported
  const framingMeta: Pick<Plan['meta'], 'fit' | 'focus'> = {};
  const framingBad = framingProblem({ fit: project.fit, focus: project.focus });
  if (framingBad) issues.push(`project.json: ${framingBad.replace('meta.', '')}, bỏ qua (dùng cover, giữa khung)`);
  else {
    if (project.fit !== undefined) framingMeta.fit = project.fit as Plan['meta']['fit'];
    if (project.focus !== undefined) framingMeta.focus = project.focus as Plan['meta']['focus'];
  }

  const assets = readManifest(projectDir).assets.filter(a => typeof a.file === 'string');
  const build = (ls: typeof layers): Plan => ({
    version: 1,
    meta: { source: 'cleaned.mp4', fps: project.fps ?? 30, width: project.width, height: project.height, style: project.style, ...framingMeta },
    scenes: buildScenes(sb, ls, theme.limits, durationSec),
    layers: ls,
  });
  const check = (p: Plan) => validatePlan(p, theme, { durationSec, fileExists, transcript: { words }, assets }).filter(i => i.severity === 'error');
  // safety net: whatever the pieces above let through, plan.json must validate; layers with errors are left out and reported
  let plan = build(layers);
  const bad = new Set(check(plan).map(e => e.layerId).filter((id): id is string => !!id));
  if (bad.size) {
    check(plan).filter(e => e.layerId && bad.has(e.layerId)).forEach(e => issues.push(`plan: bỏ layer ${e.layerId} vì [${e.code}] ${e.message}`));
    layers = layers.filter(l => !bad.has(l.id));
    plan = build(layers);
  }
  check(plan).forEach(e => issues.push(`plan còn lỗi [${e.code}]: ${e.message}`));

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
