import { run } from '../media/ffmpeg';

export const CHUNK_SEC = 0.1;
const SILENT_DB = -120; // what ffmpeg's "-inf" becomes

/** The dB values ffmpeg printed (`lavfi.astats.Overall.RMS_level=...`), one per chunk, in order. */
export function parseLevels(text: string): number[] {
  return [...text.matchAll(/lavfi\.astats\.Overall\.RMS_level=(-?[\d.]+|-inf|inf)/g)].map(m => (/inf/.test(m[1]) ? SILENT_DB : Number(m[1])));
}

/** Loudness (RMS dB) of every 0.1 s of the sound of `video`, in order: `result[i]` covers `i * 0.1` to `(i + 1) * 0.1` seconds. */
export async function voiceLevels(video: string): Promise<number[]> {
  const text = await run('ffmpeg', ['-hide_banner', '-v', 'error', '-i', video, '-vn',
    '-af', 'aresample=16000,asetnsamples=n=1600:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-', '-f', 'null', '-']);
  return parseLevels(text);
}

/** The loudest chunk from `before` seconds before `t` to `after` seconds after it; undefined when nothing was measured there. */
export function levelAround(levels: number[], t: number, before = 0.1, after = 0.4): number | undefined {
  const from = Math.max(0, Math.floor((t - before) / CHUNK_SEC));
  const to = Math.min(levels.length - 1, Math.floor((t + after) / CHUNK_SEC));
  return from > to ? undefined : Math.max(...levels.slice(from, to + 1));
}
