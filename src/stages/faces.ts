import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../media/ffmpeg';
import { readFaces } from '../media/faces';
import { pythonBin } from '../media/transcribe';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export interface FacesResult { samples: number; withFace: number; lines: string[] }
type Deps = { track?: (video: string, outJson: string) => Promise<unknown> };

const realTrack = (video: string, outJson: string) => run(pythonBin(), [join(root, 'scripts', 'face_track.py'), video, outJson]);

/** Finds the speaker's face in cleaned.mp4 on this machine (scripts/face_track.py) and writes faces.json. Run again after `clean` or `condense`: they remove it. */
export async function facesStage(projectDir: string, deps: Deps = {}): Promise<FacesResult> {
  const video = join(projectDir, 'cleaned.mp4');
  if (!existsSync(video)) throw new Error('Chưa có cleaned.mp4 — chạy clean trước');
  const file = join(projectDir, 'faces.json');
  await (deps.track ?? realTrack)(video, file);
  const faces = readFaces(projectDir)!;
  const withFace = faces.samples.filter(s => s.box).length;
  const lines = [`${withFace}/${faces.samples.length} mẫu có mặt người nói → ${file}`];
  if (!withFace) lines.push('không thấy mặt nào: đồ họa sẽ không bị đặt lại theo mặt');
  return { samples: faces.samples.length, withFace, lines };
}
