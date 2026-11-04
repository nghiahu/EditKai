import { describe, expect, it } from 'vitest';
import { runCli } from '../../src/cli';

describe('doctor command', () => {
  it('needs no project folder, prints one line per check and ends with a verdict', async () => {
    const out: string[] = [];
    const code = await runCli(['doctor'], s => out.push(s), () => undefined);
    const text = out.join('\n');
    for (const name of ['node', 'ffmpeg', 'ffprobe', 'faster-whisper']) expect(text).toContain(name);
    expect([0, 1]).toContain(code);
    expect(out[out.length - 1]).toMatch(/sẵn sàng|cảnh báo|lỗi/);
  }, 60000);
  it('is listed in the usage message', async () => {
    const err: string[] = [];
    await runCli(['khong-co-lenh'], () => undefined, s => err.push(s));
    expect(err.join('\n')).toContain('doctor');
  });
});
