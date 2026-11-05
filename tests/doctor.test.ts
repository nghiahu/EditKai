import { describe, expect, it } from 'vitest';
import { runDoctor, type Probes } from '../src/doctor';

const GIB = 1024 ** 3;
const good: Probes = {
  nodeVersion: () => 'v22.13.1',
  run: async (cmd) => (cmd === 'ffmpeg' ? 'ffmpeg version 7.1' : cmd === 'ffprobe' ? 'ffprobe version 7.1' : '1.2.3'),
  exists: () => true,
  freeBytes: () => 50 * GIB,
  staleBundles: () => 0,
  tmpDir: () => 'C:\Temp',
};
const by = (checks: Awaited<ReturnType<typeof runDoctor>>, name: string) => checks.find(c => c.name === name)!;

describe('runDoctor', () => {
  it('everything present: every check passes', async () => {
    const c = await runDoctor('/skill', good);
    expect(c.length).toBeGreaterThanOrEqual(6);
    expect(c.every(x => x.ok)).toBe(true);
  });
  it('a missing ffmpeg is an error that says how to fix it', async () => {
    const c = await runDoctor('/skill', { ...good, run: async cmd => { if (cmd === 'ffmpeg') throw new Error('not found'); return 'x'; } });
    const f = by(c, 'ffmpeg');
    expect(f.ok).toBe(false);
    expect(f.level).toBe('error');
    expect(f.fix).toMatch(/ffmpeg/i);
  });
  it('python without faster-whisper is an error', async () => {
    const c = await runDoctor('/skill', { ...good, run: async (cmd, args) => { if (args.some(a => a.includes('faster_whisper'))) throw new Error('no module'); return 'x'; } });
    expect(by(c, 'faster-whisper').ok).toBe(false);
    expect(by(c, 'faster-whisper').fix).toMatch(/pip|venv/i);
  });
  it('a missing face model is a warning that says where it should be', async () => {
    const c = await runDoctor('/skill', { ...good, exists: p => !p.includes('version-RFB-320') });
    expect(by(c, 'mô hình mặt').ok).toBe(false);
    expect(by(c, 'mô hình mặt').level).toBe('warn');
    expect(by(c, 'mô hình mặt').fix).toContain('models');
  });
  it('python without onnxruntime is a warning for the face check', async () => {
    const c = await runDoctor('/skill', { ...good, run: async (cmd, args) => { if (args.some(a => a.includes('onnxruntime'))) throw new Error('no module'); return 'x'; } });
    expect(by(c, 'onnxruntime').ok).toBe(false);
    expect(by(c, 'onnxruntime').level).toBe('warn');
  });
  it('an old node is an error', async () => {
    expect(by(await runDoctor('/skill', { ...good, nodeVersion: () => 'v16.20.0' }), 'node').ok).toBe(false);
  });
  it('missing node_modules is an error that points to npm install', async () => {
    const c = await runDoctor('/skill', { ...good, exists: p => !p.includes('node_modules') });
    expect(by(c, 'thư viện npm').ok).toBe(false);
    expect(by(c, 'thư viện npm').fix).toContain('npm install');
  });
  it('little free disk space is a warning, not an error', async () => {
    const c = await runDoctor('/skill', { ...good, freeBytes: () => 1 * GIB });
    const d = c.filter(x => x.name.startsWith('chỗ trống'));
    expect(d.length).toBeGreaterThan(0);
    expect(d.every(x => !x.ok && x.level === 'warn')).toBe(true);
  });
  it('leftover Remotion bundle folders in the temp folder are reported with how many', async () => {
    const c = await runDoctor('/skill', { ...good, staleBundles: () => 693 });
    const s = by(c, 'thư mục tạm');
    expect(s.ok).toBe(false);
    expect(s.level).toBe('warn');
    expect(s.detail).toContain('693');
  });
});
