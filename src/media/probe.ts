import { run } from './ffmpeg';

export interface VideoInfo { width: number; height: number; fps: number; durationSec: number; hasAudio: boolean }

export async function probe(file: string): Promise<VideoInfo> {
  const raw = await run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]);
  const j = JSON.parse(raw);
  const v = j.streams.find((s: any) => s.codec_type === 'video');
  if (!v) throw new Error(`Không có luồng video trong ${file}`);
  const [n, d] = String(v.r_frame_rate).split('/').map(Number);
  return {
    width: v.width,
    height: v.height,
    fps: d ? n / d : n,
    durationSec: Number(j.format.duration),
    hasAudio: j.streams.some((s: any) => s.codec_type === 'audio'),
  };
}
