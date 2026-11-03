import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { run } from '../media/ffmpeg';

export const ASSET_KINDS = ['screen', 'phone', 'photo', 'logo', 'other'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export interface Asset {
  file: string; // relative to the project folder, e.g. "assets/editor.mp4"
  description: string;
  kind: AssetKind;
  durationSec?: number;
  width?: number;
  height?: number;
}

const IMAGE = /\.(png|jpe?g|webp|gif|svg|bmp)$/i;

export function readManifest(projectDir: string): { assets: Asset[] } {
  const file = join(projectDir, 'assets.json');
  if (!existsSync(file)) return { assets: [] };
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return { assets: Array.isArray(parsed?.assets) ? (parsed.assets as Asset[]) : [] };
  } catch (e) {
    throw new Error(`assets.json không phải JSON hợp lệ: ${(e as Error).message}`);
  }
}

/** Size (and duration for videos) of an image or video file; images never get a duration. */
export async function probeAsset(file: string): Promise<{ width?: number; height?: number; durationSec?: number }> {
  const j = JSON.parse(await run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]));
  const v = (j.streams ?? []).find((s: { codec_type?: string }) => s.codec_type === 'video');
  const info: { width?: number; height?: number; durationSec?: number } = {};
  if (v?.width) info.width = v.width;
  if (v?.height) info.height = v.height;
  const duration = Number(j.format?.duration);
  if (!IMAGE.test(file) && Number.isFinite(duration) && duration > 0) info.durationSec = Math.round(duration * 1000) / 1000;
  return info;
}

const inferKind = (file: string, info: { width?: number; height?: number }): AssetKind =>
  IMAGE.test(extname(file)) ? 'photo' : (info.height ?? 0) > (info.width ?? 0) ? 'phone' : 'screen';

/**
 * Copies `source` into `<project>/assets/`, measures it and records it in assets.json (upsert by file).
 * A different file with the same name is refused; identical bytes are accepted.
 */
export async function addAsset(projectDir: string, source: string, opts: { description: string; kind?: AssetKind }): Promise<Asset> {
  if (!existsSync(source)) throw new Error(`Không tìm thấy file: ${source}`);
  const name = basename(source);
  const dest = join(projectDir, 'assets', name);
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) {
    const same = statSync(dest).size === statSync(source).size && readFileSync(dest).equals(readFileSync(source));
    if (!same) throw new Error(`assets/${name} đã có trong project và khác nội dung; đổi tên file trước khi thêm`);
  } else {
    copyFileSync(source, dest);
  }
  const info = await probeAsset(dest);
  const entry: Asset = { file: `assets/${name}`, description: opts.description, kind: opts.kind ?? inferKind(name, info), ...info };
  const manifest = readManifest(projectDir);
  const at = manifest.assets.findIndex(a => a.file === entry.file);
  if (at >= 0) manifest.assets[at] = entry; else manifest.assets.push(entry);
  writeFileSync(join(projectDir, 'assets.json'), JSON.stringify(manifest, null, 2));
  return entry;
}
