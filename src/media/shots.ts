import { runFfmpeg } from './ffmpeg';

/** Times (s) where the picture of `file` cuts to a different shot (a change of more than `threshold` of the frame, 0–1). */
export async function shotChanges(file: string, threshold = 0.4): Promise<number[]> {
  const log = await runFfmpeg(['-i', file, '-an', '-vf', `select='gt(scene,${threshold})',showinfo`, '-f', 'null', '-']);
  const times: number[] = [];
  for (const line of log.split(/\r?\n/)) {
    const m = line.match(/pts_time:\s*(-?[\d.]+)/);
    if (m && /Parsed_showinfo/.test(line)) times.push(Number(m[1]));
  }
  return times;
}
