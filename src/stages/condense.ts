import { copyFileSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeLoose } from '../director/text';
import { checkJoins, cutPoint, joinTimes, selectSpans, snapToShots, type Word } from '../media/condense';
import { cutVideo } from '../media/cut';
import { findPauses, loudnessEnvelope } from '../media/pauses';
import { shotChanges } from '../media/shots';
import { fixTranscript } from './fixTranscript';
import type { Range } from '../media/silence';
import { transcribe as whisper, type Transcript } from '../media/transcribe';

const FADE_SEC = 0.03;
const PAUSE_MIN_SEC = 0.15;
const MIN_PART_SEC = 0.3;

export interface CondenseResult {
  segments: Range[]; // cuts in full.mp4 time
  joins: number[]; // join times on the cut cleaned.mp4
  keptSec: number;
  totalSec: number;
  problems: number; // joins with a stray word in them
  lines: string[]; // the report, one line per fact
}

type Deps = { transcribe?: (video: string, outJson: string) => Promise<Transcript> };

/**
 * Keeps only the sentences named in the spec (`{ keep: [{ from, to }] }`: the first words and the last words of each part to keep) and cuts the rest.
 * Each cut lands inside a real pause when there is one, never keeps a frame from across one of the source's own cuts, and fades the sound 30 ms at
 * every edge. The cut video is transcribed again and compared with what it should say, so a stray word at a join is reported.
 * The video before the cut stays as full.mp4 (and its transcript as transcript.full.json); running again cuts from those.
 */
export async function condenseStage(projectDir: string, specFile = join(projectDir, 'condense-spec.json'), deps: Deps = {}): Promise<CondenseResult> {
  if (!existsSync(specFile)) throw new Error(`Chưa có ${specFile}: cần condense-spec.json dạng { "keep": [{ "from": "<cụm mở đầu>", "to": "<cụm kết thúc>" }] }`);
  const spec = JSON.parse(readFileSync(specFile, 'utf8')) as { keep?: { from?: unknown; to?: unknown }[] };
  if (!Array.isArray(spec.keep) || spec.keep.length === 0) throw new Error('condense-spec.json cần mảng keep không rỗng, mỗi mục có from và to');
  for (const [i, k] of spec.keep.entries()) if (typeof k?.from !== 'string' || typeof k?.to !== 'string') throw new Error(`keep[${i}] cần from và to là chuỗi`);
  const keep = spec.keep as { from: string; to: string }[];

  const full = join(projectDir, 'full.mp4');
  const cleaned = join(projectDir, 'cleaned.mp4');
  if (!existsSync(full)) {
    if (!existsSync(cleaned)) throw new Error('Chưa có cleaned.mp4 — chạy clean trước');
    if (!existsSync(join(projectDir, 'transcript.json'))) throw new Error('Chưa có transcript.json — chạy clean trước');
    renameSync(cleaned, full);
    copyFileSync(join(projectDir, 'transcript.json'), join(projectDir, 'transcript.full.json'));
  }
  const words = (JSON.parse(readFileSync(join(projectDir, 'transcript.full.json'), 'utf8')) as Transcript).words as Word[];
  const spans = selectSpans(words, keep);

  const pauses = await findPauses(full, { minSec: PAUSE_MIN_SEC });
  const { env, level } = await loudnessEnvelope(full);
  const shots = await shotChanges(full);

  const lines: string[] = [];
  const segments: Range[] = spans.map(sp => {
    const s = cutPoint(words[sp.first].s, 'start', pauses, env, level);
    const e = cutPoint(words[sp.last].e, 'end', pauses, env, level);
    const snapped = snapToShots(s.time, e.time, shots);
    lines.push(`${snapped.start.toFixed(2)} → ${snapped.end.toFixed(2)} s  [đầu: ${s.how}] [cuối: ${e.how}]`, `    ${words[sp.first].t} … ${words[sp.last].t}`, ...snapped.notes.map(n => `    ${n}`));
    if (snapped.end - snapped.start < MIN_PART_SEC) throw new Error(`Đoạn "${words[sp.first].t} … ${words[sp.last].t}" chỉ còn ${(snapped.end - snapped.start).toFixed(2)} s sau khi cắt; chọn cụm khác`);
    return { start: Math.max(0, snapped.start), end: snapped.end };
  });
  const joins = joinTimes(segments);
  const keptSec = segments.reduce((n, r) => n + r.end - r.start, 0);
  const totalSec = words.length ? words[words.length - 1].e : 0;
  lines.push(`Giữ ${keptSec.toFixed(1)} s trên ${totalSec.toFixed(1)} s, ${joins.length} chỗ ghép`);

  await cutVideo(full, segments, cleaned, { fadeSec: FADE_SEC });
  rmSync(join(projectDir, 'transcript.whisper.json'), { force: true }); // the old fix backup belongs to the previous cut
  const heard = (await (deps.transcribe ?? whisper)(cleaned, join(projectDir, 'transcript.json'))).words;
  writeFileSync(join(projectDir, 'condense.json'), JSON.stringify({ keep, segments, joins }, null, 2));

  const expected = spans.flatMap(sp => words.slice(sp.first, sp.last + 1).map(w => normalizeLoose(w.t)));
  const checked = checkJoins(expected, heard, joins);
  for (const c of checked) lines.push(`${c.odd.length ? '!! ' : 'ok '}chỗ ghép ${c.join.toFixed(2)} s: ${c.context}${c.odd.length ? `   <-- từ lạ: ${c.odd.map(w => `"${w}"`).join(', ')}` : ''}`);
  const problems = checked.filter(c => c.odd.length).length;
  lines.push(problems ? `${problems} chỗ ghép có mảnh từ lạ: chọn lại cụm đầu hoặc cuối của đoạn đó` : 'Các chỗ ghép không có mảnh từ lạ');
  // the new transcript is Whisper's own again: the fixes the user wrote earlier are applied to it
  const fixesFile = join(projectDir, 'transcript-fixes.json');
  if (existsSync(fixesFile)) {
    const f = fixTranscript(projectDir, fixesFile);
    lines.push(`Đã sửa ${f.changed} từ theo transcript-fixes.json trên bản chép lời mới`);
    f.unmatched.forEach(u => lines.push(`  không khớp chỗ nào: "${u.sai}" → "${u.dung}"${u.sau ? ` (sau "${u.sau}")` : ''}${u.tiep ? ` (trước "${u.tiep}")` : ''}`));
  }
  return { segments, joins, keptSec, totalSec, problems, lines };
}
