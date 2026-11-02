import { runFfmpeg } from './ffmpeg';
import { probe } from './probe';

export interface Range { start: number; end: number }

export async function detectSilences(
  file: string,
  opts: { minSilenceSec?: number; thresholdDb?: number } = {},
): Promise<Range[]> {
  const { minSilenceSec = 0.4, thresholdDb = -35 } = opts;
  const info = await probe(file);
  if (!info.hasAudio) return [];
  const log = await runFfmpeg(['-i', file, '-af', `silencedetect=noise=${thresholdDb}dB:d=${minSilenceSec}`, '-f', 'null', '-']);
  const ranges: Range[] = [];
  let start: number | undefined;
  for (const line of log.split(/\r?\n/)) {
    const s = line.match(/silence_start: (-?[\d.]+)/);
    if (s) start = Math.max(0, Number(s[1]));
    const e = line.match(/silence_end: ([\d.]+)/);
    if (e && start !== undefined) { ranges.push({ start, end: Number(e[1]) }); start = undefined; }
  }
  // silence that runs to the end of the file never prints silence_end
  if (start !== undefined) ranges.push({ start, end: info.durationSec });
  return ranges;
}
