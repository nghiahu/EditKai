import { spawn } from 'node:child_process';

/** Run a binary and resolve with its combined stdout+stderr; reject with that text on non-zero exit. */
export function run(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { windowsHide: true });
    let out = '';
    p.stdout.on('data', d => (out += d));
    p.stderr.on('data', d => (out += d));
    p.on('error', e => reject(new Error(`Không chạy được ${bin}: ${e.message}`)));
    p.on('close', code => (code === 0 ? resolve(out) : reject(new Error(`${bin} lỗi (mã ${code}):\n${out.slice(-2000)}`))));
  });
}

export const runFfmpeg = (args: string[]) => run('ffmpeg', ['-hide_banner', ...args]);
