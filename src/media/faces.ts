import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Framing } from '../plan/framing';

/** A rectangle as shares (0-1) of the frame width and height. */
export interface FaceBox { x: number; y: number; w: number; h: number }
export interface Faces { fps: number; samples: { t: number; box: FaceBox | null; conf: number }[] }

/** faces.json of a project (scripts/face_track.py writes it); undefined when there is none. */
export function readFaces(projectDir: string): Faces | undefined {
  const file = join(projectDir, 'faces.json');
  if (!existsSync(file)) return undefined;
  let data: Faces;
  try { data = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { throw new Error(`faces.json không phải JSON hợp lệ: ${(e as Error).message}`); }
  if (!data || typeof data.fps !== 'number' || !Array.isArray(data.samples)) throw new Error('faces.json sai dạng: cần { fps, samples: [...] }; chạy lại lệnh faces');
  return data;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * The box around every face seen from `from` to `to` seconds (the sample just before `from` counts, since samples are `1/fps` apart),
 * grown by `margin` on every side and kept inside the frame. Undefined when no face was seen there.
 */
export function faceRegion(faces: Faces, from: number, to: number, margin = 0.08): FaceBox | undefined {
  const seen = faces.samples.filter(s => s.box && s.t >= from - 1 / faces.fps && s.t <= to).map(s => s.box!);
  if (!seen.length) return undefined;
  const x1 = clamp01(Math.min(...seen.map(b => b.x)) - margin);
  const y1 = clamp01(Math.min(...seen.map(b => b.y)) - margin);
  const x2 = clamp01(Math.max(...seen.map(b => b.x + b.w)) + margin);
  const y2 = clamp01(Math.max(...seen.map(b => b.y + b.h)) + margin);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** The share (0-1) of `face` that `other` covers. */
export function overlapShare(face: FaceBox, other: FaceBox): number {
  const area = face.w * face.h;
  if (area <= 0) return 0;
  const w = Math.min(face.x + face.w, other.x + other.w) - Math.max(face.x, other.x);
  const h = Math.min(face.y + face.h, other.y + other.h) - Math.max(face.y, other.y);
  return w > 0 && h > 0 ? (w * h) / area : 0;
}

/**
 * Faces measured on the source picture, as they sit in the frame the video is rendered at (the picture is fitted by `framing`: cropped to fill
 * with `cover`, centred with bars with `contain`). A face the crop cuts away becomes a null box; one it cuts partly is clipped to the frame.
 */
export function mapFacesToFrame(faces: Faces, src: { width: number; height: number }, frame: { width: number; height: number }, framing: Framing): Faces {
  const scale = (framing.fit === 'contain' ? Math.min : Math.max)(frame.width / src.width, frame.height / src.height);
  const dw = src.width * scale;
  const dh = src.height * scale;
  const fx = framing.fit === 'contain' ? 0.5 : framing.focus.x;
  const fy = framing.fit === 'contain' ? 0.5 : framing.focus.y;
  const offX = (frame.width - dw) * fx;
  const offY = (frame.height - dh) * fy;
  return {
    ...faces,
    samples: faces.samples.map(s => {
      if (!s.box) return s;
      const x1 = clamp01((s.box.x * dw + offX) / frame.width);
      const y1 = clamp01((s.box.y * dh + offY) / frame.height);
      const x2 = clamp01(((s.box.x + s.box.w) * dw + offX) / frame.width);
      const y2 = clamp01(((s.box.y + s.box.h) * dh + offY) / frame.height);
      return x2 > x1 && y2 > y1 ? { ...s, box: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } } : { ...s, box: null };
    }),
  };
}
