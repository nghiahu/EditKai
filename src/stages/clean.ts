import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { probe } from '../media/probe';
import { detectSilences, type Range } from '../media/silence';
import { cutVideo } from '../media/cut';
import { findRepeats, findSuspectRepeats } from '../media/repeats';
import { transcribe as realTranscribe, type Transcript } from '../media/transcribe';

const NO_SPEECH = 'Không tìm thấy lời nói trong video';
const PAD = 0.1; // keep a little air on each side of a cut silence

export interface CleanDeps { transcribe?: (file: string, outJson: string) => Promise<Transcript> }

function mergeRanges(rs: Range[]): Range[] {
  const sorted = [...rs].sort((a, b) => a.start - b.start);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end); else out.push({ ...r });
  }
  return out;
}

function complement(cuts: Range[], total: number): Range[] {
  const keep: Range[] = [];
  let at = 0;
  for (const c of cuts) { if (c.start - at > 0.05) keep.push({ start: at, end: c.start }); at = c.end; }
  if (total - at > 0.05) keep.push({ start: at, end: total });
  return keep;
}

export async function cleanStage(projectDir: string, deps: CleanDeps = {}) {
  const transcribe = deps.transcribe ?? realTranscribe;
  const source = join(projectDir, 'source.mp4');
  const info = await probe(source);
  if (!info.hasAudio) throw new Error(NO_SPEECH);

  const raw = await transcribe(source, join(projectDir, 'transcript.raw.json'));
  if (raw.words.length === 0) throw new Error(NO_SPEECH);

  const silences = (await detectSilences(source))
    .map(r => ({ start: r.start + PAD, end: r.end - PAD }))
    .filter(r => r.end - r.start > 0.1);
  const cuts = mergeRanges([...silences, ...findRepeats(raw)]);
  const keep = complement(cuts, info.durationSec);
  const cleaned = join(projectDir, 'cleaned.mp4');
  await cutVideo(source, keep, cleaned);
  writeFileSync(join(projectDir, 'cuts.json'), JSON.stringify(cuts, null, 2));
  rmSync(join(projectDir, 'faces.json'), { force: true }); // measured on the picture before this cut
  writeFileSync(join(projectDir, 'repeats-suspect.json'), JSON.stringify(findSuspectRepeats(raw), null, 2));

  const transcript = await transcribe(cleaned, join(projectDir, 'transcript.json'));
  writeFileSync(join(projectDir, 'transcript.json'), JSON.stringify(transcript, null, 2));
  return { cleaned, transcript, cuts };
}
