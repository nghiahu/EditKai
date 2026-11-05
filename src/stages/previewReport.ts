import { basename } from 'node:path';
import type { Issue, Layer } from '../plan/types';
import type { PreviewFrame } from './previewFrames';

const AROUND_SEC = 1.5; // the words said this close to a frame
const MAX_WORDS = 10;

const cell = (s: string) => s.replace(/\|/g, '\|').replace(/\s+/g, ' ').trim();

/**
 * preview/report.md: one row per picture (number, file, time, kind, words said around it, warnings of the layers that are up then),
 * then the warnings that belong to no layer. Meant to be read next to sheet.png.
 */
export function previewReport(input: { frames: (PreviewFrame & { file: string })[]; layers: Layer[]; words: { t: string; s: number; e: number }[]; issues: Issue[] }): string {
  const { frames, layers, words, issues } = input;
  const lines = ['# Xem trước', '', '| # | ảnh | giây | loại | đang nói | cảnh báo |', '|---|---|---|---|---|---|'];
  frames.forEach((f, i) => {
    const said = words.filter(w => w.e >= f.t - AROUND_SEC && w.s <= f.t + AROUND_SEC).slice(0, MAX_WORDS).map(w => w.t).join(' ');
    const up = new Set(layers.filter(l => l.start <= f.t && f.t <= l.end).map(l => l.id));
    const warns = issues.filter(x => x.layerId && up.has(x.layerId)).map(x => `${x.code}: ${x.message}`).join('; ');
    lines.push(`| ${i + 1} | ${basename(f.file)} | ${f.t.toFixed(1)} | ${cell(f.label)} | ${cell(said)} | ${cell(warns)} |`);
  });
  const general = issues.filter(x => !x.layerId);
  if (general.length) lines.push('', '## Cảnh báo chung', '', ...general.map(x => `- ${x.code}: ${x.message}`));
  return lines.join('\n') + '\n';
}
