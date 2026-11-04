import { runFfmpeg } from './ffmpeg';
import { probe } from './probe';
import type { Range } from './silence';

/**
 * Keep only `keep` ranges of `src` (in order) and write them back-to-back to `out`.
 * `fadeSec` fades the audio of every kept part in and out, so a cut inside speech makes no click (the picture still cuts hard).
 */
export async function cutVideo(src: string, keep: Range[], out: string, opts: { fadeSec?: number } = {}): Promise<void> {
  if (keep.length === 0) throw new Error('Không còn đoạn nào để giữ lại');
  const { hasAudio } = await probe(src);
  const parts = keep.map((r, i) => {
    const v = `[0:v]trim=start=${r.start}:end=${r.end},setpts=PTS-STARTPTS[v${i}]`;
    const f = Math.min(opts.fadeSec ?? 0, (r.end - r.start) / 2);
    const fade = f > 0 ? `,afade=t=in:d=${f},afade=t=out:st=${(r.end - r.start - f).toFixed(4)}:d=${f}` : '';
    const a = hasAudio ? `;[0:a]atrim=start=${r.start}:end=${r.end},asetpts=PTS-STARTPTS${fade}[a${i}]` : '';
    return v + a;
  });
  const inputs = keep.map((_, i) => `[v${i}]${hasAudio ? `[a${i}]` : ''}`).join('');
  const concat = `${inputs}concat=n=${keep.length}:v=1:a=${hasAudio ? 1 : 0}[v]${hasAudio ? '[a]' : ''}`;
  const maps = ['-map', '[v]', ...(hasAudio ? ['-map', '[a]'] : [])];
  await runFfmpeg(['-y', '-i', src, '-filter_complex', `${parts.join(';')};${concat}`, ...maps,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', ...(hasAudio ? ['-c:a', 'aac'] : []), out]);
}
