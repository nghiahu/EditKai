import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runFfmpeg } from '../../src/media/ffmpeg';
import { addAsset, readManifest } from '../../src/assets/manifest';

let base: string, fixtures: string, project: string;

beforeAll(async () => {
  base = mkdtempSync(join(tmpdir(), 'editkai-assets-'));
  fixtures = join(base, 'nguồn');
  mkdirSync(fixtures);
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'testsrc2=s=320x180:r=30:d=2', '-pix_fmt', 'yuv420p', join(fixtures, 'screen.mp4')]);
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'testsrc2=s=180x320:r=30:d=2', '-pix_fmt', 'yuv420p', join(fixtures, 'phone.mp4')]);
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=red:s=64x36', '-frames:v', '1', join(fixtures, 'logo.png')]);
});
afterAll(() => rmSync(base, { recursive: true, force: true }));
beforeEach(() => {
  project = join(base, 'dự án', String(Math.random()).slice(2));
  mkdirSync(project, { recursive: true });
});

describe('addAsset', () => {
  it('adds a horizontal video as screen with size and duration, and copies it', async () => {
    const a = await addAsset(project, join(fixtures, 'screen.mp4'), { description: 'quay màn hình editor' });
    expect(a).toMatchObject({ file: 'assets/screen.mp4', description: 'quay màn hình editor', kind: 'screen', width: 320, height: 180 });
    expect(a.durationSec).toBeGreaterThan(1.8);
    expect(existsSync(join(project, 'assets', 'screen.mp4'))).toBe(true);
    expect(readManifest(project).assets).toEqual([a]);
  });
  it('adds a vertical video as phone', async () => {
    expect((await addAsset(project, join(fixtures, 'phone.mp4'), { description: 'video ngắn' })).kind).toBe('phone');
  });
  it('adds an image as photo with a size but no duration', async () => {
    const a = await addAsset(project, join(fixtures, 'logo.png'), { description: 'logo' });
    expect(a).toMatchObject({ kind: 'photo', width: 64, height: 36 });
    expect(a.durationSec).toBeUndefined();
  });
  it('an explicit kind wins', async () => {
    expect((await addAsset(project, join(fixtures, 'logo.png'), { description: 'logo', kind: 'logo' })).kind).toBe('logo');
  });
  it('adding the same file again updates its entry instead of duplicating it', async () => {
    await addAsset(project, join(fixtures, 'screen.mp4'), { description: 'một' });
    await addAsset(project, join(fixtures, 'screen.mp4'), { description: 'hai' });
    const m = readManifest(project).assets;
    expect(m).toHaveLength(1);
    expect(m[0].description).toBe('hai');
  });
  it('a different file with the same name is refused, identical bytes are accepted', async () => {
    await addAsset(project, join(fixtures, 'screen.mp4'), { description: 'một' });
    const other = join(base, 'khác');
    mkdirSync(other, { recursive: true });
    copyFileSync(join(fixtures, 'phone.mp4'), join(other, 'screen.mp4'));
    await expect(addAsset(project, join(other, 'screen.mp4'), { description: 'hai' })).rejects.toThrow(/assets\/screen\.mp4/);
    const same = join(base, 'giống');
    mkdirSync(same, { recursive: true });
    copyFileSync(join(fixtures, 'screen.mp4'), join(same, 'screen.mp4'));
    await expect(addAsset(project, join(same, 'screen.mp4'), { description: 'ba' })).resolves.toMatchObject({ file: 'assets/screen.mp4' });
  });
  it('a file name with spaces and diacritics works (Review Focus 5)', async () => {
    const odd = join(fixtures, 'quay màn hình 1.mp4');
    copyFileSync(join(fixtures, 'screen.mp4'), odd);
    const a = await addAsset(project, odd, { description: 'tên có dấu' });
    expect(a.file).toBe('assets/quay màn hình 1.mp4');
    expect(a.width).toBe(320);
  });
  it('a missing source file is a clear error', async () => {
    await expect(addAsset(project, join(fixtures, 'không-có.mp4'), { description: 'x' })).rejects.toThrow(/Không tìm thấy file/);
  });
});

describe('readManifest', () => {
  it('a missing manifest reads as empty', () => {
    expect(readManifest(project)).toEqual({ assets: [] });
  });
  it('a corrupt manifest throws a clear error (Review Focus 5)', () => {
    writeFileSync(join(project, 'assets.json'), '{ not json');
    expect(() => readManifest(project)).toThrow(/assets\.json không phải JSON hợp lệ/);
  });
  it('a manifest without an assets array reads as empty', () => {
    writeFileSync(join(project, 'assets.json'), JSON.stringify({ other: 1 }));
    expect(readManifest(project)).toEqual({ assets: [] });
  });
  it('writes the manifest with 2-space indent', async () => {
    await addAsset(project, join(fixtures, 'logo.png'), { description: 'logo' });
    expect(readFileSync(join(project, 'assets.json'), 'utf8')).toMatch(/^\{\n {2}"assets": \[/);
  });
});
