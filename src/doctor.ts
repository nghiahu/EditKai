import { existsSync, readdirSync, statfsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from './media/ffmpeg';

export interface Check { name: string; ok: boolean; level: 'error' | 'warn'; detail: string; fix?: string }

/** Everything the checks ask of the machine, so tests can fake it. */
export interface Probes {
  nodeVersion: () => string;
  run: (cmd: string, args: string[]) => Promise<string>;
  exists: (path: string) => boolean;
  freeBytes: (path: string) => number;
  staleBundles: () => number;
  tmpDir: () => string;
}

const GIB = 1024 ** 3;
const MIN_FREE_GIB = 3;
const MIN_NODE_MAJOR = 20;
const MAX_STALE_BUNDLES = 5;

export const realProbes: Probes = {
  nodeVersion: () => process.version,
  run,
  exists: existsSync,
  freeBytes: path => { const s = statfsSync(path); return Number(s.bavail) * Number(s.bsize); },
  staleBundles: () => readdirSync(tmpdir()).filter(n => n.startsWith('remotion-webpack-bundle-')).length,
  tmpDir: tmpdir,
};

const firstLine = (s: string) => s.split(/\r?\n/)[0].trim();

/** Checks that the machine can run the skill; each failing check says how to fix it. `root` is the skill folder. */
export async function runDoctor(root: string, probes: Probes = realProbes): Promise<Check[]> {
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  const major = Number(/^v?(\d+)/.exec(probes.nodeVersion())?.[1] ?? 0);
  add({ name: 'node', ok: major >= MIN_NODE_MAJOR, level: 'error', detail: probes.nodeVersion(), fix: `cần Node ${MIN_NODE_MAJOR} trở lên (https://nodejs.org)` });

  add({ name: 'thư viện npm', ok: probes.exists(join(root, 'node_modules', 'tsx')) && probes.exists(join(root, 'node_modules', '@remotion', 'renderer')), level: 'error',
    detail: probes.exists(join(root, 'node_modules')) ? 'đã cài' : 'chưa cài', fix: `chạy npm install trong ${root}` });

  for (const bin of ['ffmpeg', 'ffprobe']) {
    try {
      add({ name: bin, ok: true, level: 'error', detail: firstLine(await probes.run(bin, ['-version'])) });
    } catch {
      add({ name: bin, ok: false, level: 'error', detail: 'không chạy được', fix: `cài ${bin} (gói ffmpeg) và thêm vào PATH` });
    }
  }

  const venv = join(root, '.venv', 'Scripts', 'python.exe');
  const python = probes.exists(venv) ? venv : 'python';
  try {
    add({ name: 'faster-whisper', ok: true, level: 'error', detail: `python ${firstLine(await probes.run(python, ['-c', 'import faster_whisper; print(faster_whisper.__version__)']))}` });
  } catch {
    add({ name: 'faster-whisper', ok: false, level: 'error', detail: 'không import được', fix: `tạo môi trường: python -m venv .venv rồi .venv\Scripts\pip install faster-whisper (trong ${root})` });
  }

  // face avoidance (optional): the model file and onnxruntime; without them everything else works, graphics just are not moved off the face
  add({ name: 'mô hình mặt', ok: probes.exists(join(root, 'models', 'version-RFB-320.onnx')), level: 'warn', detail: 'models/version-RFB-320.onnx', fix: `thiếu file mô hình trong ${join(root, 'models')} (xem docs của đợt 1)` });
  try {
    add({ name: 'onnxruntime', ok: true, level: 'warn', detail: `python ${firstLine(await probes.run(python, ['-c', 'import onnxruntime; print(onnxruntime.__version__)']))}` });
  } catch {
    add({ name: 'onnxruntime', ok: false, level: 'warn', detail: 'không import được', fix: `.venv\Scripts\pip install onnxruntime numpy (trong ${root})` });
  }

  for (const [label, path] of [['chỗ trống ở thư mục tạm', probes.tmpDir()], ['chỗ trống ở thư mục skill', root]] as const) {
    try {
      const gib = probes.freeBytes(path) / GIB;
      add({ name: label, ok: gib >= MIN_FREE_GIB, level: 'warn', detail: `${gib.toFixed(1)} GiB (${path})`, fix: `giải phóng ổ đĩa; mỗi lần render và chép lời cần vài GiB (cần ít nhất ${MIN_FREE_GIB} GiB)` });
    } catch {
      add({ name: label, ok: true, level: 'warn', detail: 'không đo được' });
    }
  }

  const stale = probes.staleBundles();
  add({ name: 'thư mục tạm', ok: stale <= MAX_STALE_BUNDLES, level: 'warn', detail: `${stale} thư mục remotion-webpack-bundle-* còn sót`,
    fix: 'bản cũ của skill để lại các thư mục này (36 MB mỗi cái); xóa chúng trong thư mục tạm của hệ thống' });
  return checks;
}
