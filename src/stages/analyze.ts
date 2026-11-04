import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readManifest } from '../assets/manifest';
import { segmentBeats } from '../director/beats';
import { detectCues } from '../director/cues';
import { matchAsset } from '../director/assets';
import { loadGlossary } from '../director/glossary';
import { readStoryboard, writeStoryboard } from '../director/storyboard';
import { loadPlaybook } from '../director/playbook';
import { suggestTreatments } from '../director/suggest';
import type { Beat, Storyboard } from '../director/types';
import { loadTheme } from '../style/theme';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

type W = { t: string; s: number; e: number };

/** transcript.json + project.json (+ assets.json, glossary.json) → storyboard.json: beats, cues and suggested treatments, all unreviewed. */
export async function analyzeStage(projectDir: string, opts: { force?: boolean } = {}): Promise<Storyboard> {
  const transcriptFile = join(projectDir, 'transcript.json');
  if (!existsSync(transcriptFile)) throw new Error('Chưa có transcript.json — chạy clean trước');
  let words: W[];
  try {
    words = (JSON.parse(readFileSync(transcriptFile, 'utf8')).words ?? []) as W[];
  } catch (e) {
    throw new Error(`transcript.json không phải JSON hợp lệ: ${(e as Error).message}`);
  }
  if (words.length === 0) throw new Error('Không có lời để phân tích');

  if (!opts.force && existsSync(join(projectDir, 'storyboard.json'))) {
    let existing: Storyboard | undefined;
    try { existing = readStoryboard(projectDir); } catch { /* corrupt: safe to overwrite */ }
    if (existing?.beats?.some(b => b.reviewed)) throw new Error('storyboard.json đã có nhịp được duyệt; dùng --force để ghi đè');
  }

  const project = JSON.parse(readFileSync(join(projectDir, 'project.json'), 'utf8')) as { style: string; fps?: number };
  const theme = loadTheme(join(root, 'styles', project.style));
  const glossary = loadGlossary(projectDir);
  const assets = readManifest(projectDir).assets;

  const spans = segmentBeats(words);
  const cues = spans.map(span => detectCues(words, span, glossary));
  const matches = spans.map((span, i) => matchAsset(span.text, cues[i], assets)?.asset);
  const treatments = suggestTreatments({ spans, cues, matches, words, director: theme.director, fps: project.fps ?? 30, playbook: loadPlaybook(join(root, 'styles', project.style)) });

  const beats: Beat[] = spans.map((span, i) => ({
    id: `b${i + 1}`,
    start: span.start,
    end: span.end,
    firstWord: span.firstWord,
    lastWord: span.lastWord,
    text: span.text,
    cues: cues[i],
    reviewed: false,
    treatment: treatments[i],
  }));
  const sb: Storyboard = { version: 1, style: project.style, beats };
  writeStoryboard(projectDir, sb);
  return sb;
}
