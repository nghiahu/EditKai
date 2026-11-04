import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeStage } from '../../src/stages/analyze';
import { readStoryboard, writeStoryboard } from '../../src/director/storyboard';
import type { Asset } from '../../src/assets/manifest';
import { writeProject } from '../helpers/project';

const screen: Asset = { file: 'assets/screen.mp4', description: 'quay màn hình giao diện editor', kind: 'screen' };
const phone: Asset = { file: 'assets/phone.mp4', description: 'video dọc ngắn kiểu TikTok', kind: 'phone' };

describe('analyzeStage', () => {
  it('writes storyboard.json with beats that cover every word, ids b1.. and reviewed false', async () => {
    const dir = writeProject(['Quá đẳng cấp rồi mọi người ơi!', 'Claude vừa trả video edit cho mình.', 'Nó mở thêm tool Editor trực tiếp.']);
    const sb = await analyzeStage(dir);
    const onDisk = JSON.parse(readFileSync(join(dir, 'storyboard.json'), 'utf8'));
    expect(onDisk).toEqual(sb);
    expect(sb).toMatchObject({ version: 1, style: 'm1' });
    expect(sb.beats.map(b => b.id)).toEqual(['b1', 'b2', 'b3']);
    expect(sb.beats.every(b => b.reviewed === false)).toBe(true);
    const words = JSON.parse(readFileSync(join(dir, 'transcript.json'), 'utf8')).words.length;
    expect(sb.beats.reduce((n, b) => n + (b.lastWord - b.firstWord + 1), 0)).toBe(words);
  });
  it('finds cues for a sentence naming Claude, a time, an interface and TikTok', async () => {
    const dir = writeProject(['Hôm nay mình dùng Claude để edit.', 'Chỉ mất hơn nửa tiếng thôi.', 'Mở giao diện editor lên.', 'Rồi đăng lên kênh TikTok.']);
    const sb = await analyzeStage(dir);
    const kinds = (i: number) => sb.beats[i].cues.map(c => c.kind);
    expect(kinds(0)).toContain('tool');
    expect(kinds(1)).toContain('number');
    expect(kinds(2)).toContain('ui');
    expect(kinds(3)).toContain('shortvideo');
  });
  it('a matching screen asset becomes a footage window suggestion', async () => {
    const dir = writeProject(['Mở giao diện editor lên xem nào.'], { assets: [screen, phone] });
    const sb = await analyzeStage(dir);
    expect(sb.beats[0].treatment.inserts[0]).toMatchObject({ type: 'footage', props: { src: 'assets/screen.mp4', frame: 'window' } });
  });
  it('s1 does not suggest what its director block disallows (a prompt box)', async () => {
    const dir = writeProject(['Hãy bảo nó tạo cho bạn một giao diện mới.'], { style: 's1' });
    const sb = await analyzeStage(dir);
    expect(sb.beats[0].cues.map(c => c.kind)).toContain('prompt');
    expect(sb.beats[0].treatment.inserts.map(i => i.type)).not.toContain('prompt-box');
  });
  it('a prompt after "dùng" is not struck out (dùng is not đừng)', async () => {
    const dir = writeProject(['Mình dùng Claude bảo nó tạo cho bạn một giao diện mới.']);
    const box = (await analyzeStage(dir)).beats[0].treatment.inserts.find(i => i.type === 'prompt-box');
    expect(box?.props).toMatchObject({ strike: false });
  });
  it('an empty transcript gives a clear error, one word still works (Review Focus 1)', async () => {
    await expect(analyzeStage(writeProject([], { words: [] }))).rejects.toThrow('Không có lời để phân tích');
    const sb = await analyzeStage(writeProject(['Xin']));
    expect(sb.beats).toHaveLength(1);
  });
  it('a missing transcript gives a clear error', async () => {
    const dir = writeProject(['Xin chào']);
    writeFileSync(join(dir, 'transcript.json'), '');
    await expect(analyzeStage(dir)).rejects.toThrow(/transcript\.json/);
    const { rmSync } = await import('node:fs');
    rmSync(join(dir, 'transcript.json'));
    await expect(analyzeStage(dir)).rejects.toThrow('Chưa có transcript.json — chạy clean trước');
  });
  it('refuses to overwrite a reviewed storyboard; --force overwrites it; an unreviewed one is overwritten (Review Focus 5)', async () => {
    const dir = writeProject(['Một câu đơn giản thôi.']);
    const sb = await analyzeStage(dir);
    await analyzeStage(dir); // unreviewed: fine
    sb.beats[0].reviewed = true;
    sb.beats[0].treatment.note = 'đạo diễn đã sửa';
    writeStoryboard(dir, sb);
    await expect(analyzeStage(dir)).rejects.toThrow('storyboard.json đã có nhịp được duyệt; dùng --force để ghi đè');
    expect(readStoryboard(dir).beats[0].treatment.note).toBe('đạo diễn đã sửa'); // untouched
    const fresh = await analyzeStage(dir, { force: true });
    expect(fresh.beats[0].reviewed).toBe(false);
    expect(fresh.beats[0].treatment.note).toBeUndefined();
  });
  it('a corrupt existing storyboard is overwritten', async () => {
    const dir = writeProject(['Một câu thôi.']);
    writeFileSync(join(dir, 'storyboard.json'), '{ nope');
    expect((await analyzeStage(dir)).beats).toHaveLength(1);
  });
  it('a project glossary adds a tool term', async () => {
    const dir = writeProject(['Mình dùng zorblax hôm nay.'], { glossary: { terms: [{ term: 'Zorblax', label: 'phần mềm' }] } });
    const tool = (await analyzeStage(dir)).beats[0].cues.find(c => c.kind === 'tool');
    expect(tool).toMatchObject({ text: 'Zorblax', label: 'phần mềm' });
  });
  it('NFD words give the same cues as NFC words (Review Focus 4)', async () => {
    const sentences = ['Mở giao diện editor lên.', 'Chỉ mất hơn nửa tiếng thôi.', 'Đừng bảo nó làm việc đó nhé.'];
    const nfc = await analyzeStage(writeProject(sentences.map(s => s.normalize('NFC'))));
    const nfd = await analyzeStage(writeProject(sentences.map(s => s.normalize('NFD'))));
    expect(nfd.beats.map(b => b.cues.map(c => [c.kind, c.word]))).toEqual(nfc.beats.map(b => b.cues.map(c => [c.kind, c.word])));
  });
  it('a corrupt assets.json is reported with its own message', async () => {
    const dir = writeProject(['Một câu thôi.']);
    writeFileSync(join(dir, 'assets.json'), '{ nope');
    await expect(analyzeStage(dir)).rejects.toThrow(/assets\.json/);
  });
});
