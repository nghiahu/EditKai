import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeStage } from '../../src/stages/analyze';
import { composeStage } from '../../src/stages/compose';
import { checkProject } from '../../src/stages/qa';
import { readStoryboard, writeStoryboard } from '../../src/director/storyboard';
import type { Plan } from '../../src/plan/types';
import { mergeRegenerated } from '../../src/plan/merge';
import { readPlan } from '../../src/plan/io';
import type { Asset } from '../../src/assets/manifest';
import { writeCleanedVideo, writeProject } from '../helpers/project';

const SENTENCES = ['Hôm nay mình dùng Claude để edit video.', 'Chỉ mất hơn nửa tiếng thôi.', 'Mở giao diện editor lên xem nào.'];
const screen: Asset = { file: 'assets/screen.mp4', description: 'quay màn hình giao diện editor', kind: 'screen' };
const unused: Asset = { file: 'assets/khac.mp4', description: 'cảnh khác hẳn', kind: 'other' };
const json = (dir: string, f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'));

/** A project with a cleaned video and a reviewed storyboard from analyze. */
async function project(sentences = SENTENCES, assets?: Asset[], seconds = 14): Promise<string> {
  const dir = writeProject(sentences, { assets });
  await writeCleanedVideo(dir, seconds);
  const sb = await analyzeStage(dir);
  sb.beats.forEach(b => { b.reviewed = true; });
  writeStoryboard(dir, sb);
  return dir;
}

describe('composeStage', () => {
  it('writes plan.json and compose-report.json', async () => {
    const dir = await project();
    const r = await composeStage(dir);
    expect(r.planFile).toBe(join(dir, 'plan.json'));
    expect(existsSync(join(dir, 'plan.json'))).toBe(true);
    expect(json(dir, 'compose-report.json')).toEqual(JSON.parse(JSON.stringify(r.report)));
    const plan = json(dir, 'plan.json') as Plan;
    expect(plan.meta).toEqual({ source: 'cleaned.mp4', fps: 30, width: 1080, height: 1920, style: 'm1' });
    expect(plan.layers.some(l => l.track === 'caption')).toBe(true);
    expect(plan.scenes[0].start).toBe(0);
  }, 60000);
  it('the plan passes validatePlan with no errors', async () => {
    const dir = await project();
    await composeStage(dir);
    const issues = await checkProject(dir);
    expect(issues.filter(i => i.severity === 'error')).toEqual([]);
  }, 60000);
  it('writes plan.next.json and leaves an existing plan.json untouched, locked layers included (Review Focus 5)', async () => {
    const dir = await project();
    await composeStage(dir);
    const plan = json(dir, 'plan.json') as Plan;
    plan.layers[0].locked = true;
    writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan, null, 2));
    const before = readFileSync(join(dir, 'plan.json'), 'utf8');
    const r = await composeStage(dir);
    expect(r.planFile).toBe(join(dir, 'plan.next.json'));
    expect(existsSync(join(dir, 'plan.next.json'))).toBe(true);
    expect(readFileSync(join(dir, 'plan.json'), 'utf8')).toBe(before);
  }, 60000);
  it('a storyboard with an unknown insert type, an insert beyond the video and a long bigRange still composes and lists them (Review Focus 3)', async () => {
    const dir = await project();
    const sb = readStoryboard(dir);
    const t = sb.beats[0].treatment;
    t.inserts.push({ type: 'confetti', props: {}, at: 1, duration: 2 }, { type: 'logo-badge', props: { label: 'X' }, at: 999, duration: 2 });
    t.caption.bigRange = [sb.beats[0].firstWord, sb.beats[0].firstWord + 4];
    writeStoryboard(dir, sb);
    const r = await composeStage(dir);
    expect(r.report.issues.join('\n')).toMatch(/confetti/);
    expect(r.report.issues.join('\n')).toMatch(/999/);
    expect(r.report.issues.join('\n')).toMatch(/bigRange/);
    const plan = json(dir, 'plan.json') as Plan;
    expect(plan.layers.some(l => l.type === 'confetti' || (l.props as { label?: string } | undefined)?.label === 'X')).toBe(false);
    expect((await checkProject(dir)).filter(i => i.severity === 'error')).toEqual([]);
  }, 60000);
  it('counts unreviewed beats', async () => {
    const dir = await project();
    const sb = readStoryboard(dir);
    sb.beats[0].reviewed = false;
    writeStoryboard(dir, sb);
    expect((await composeStage(dir)).report.unreviewedBeats).toBe(1);
  }, 60000);
  it('lists assets no layer uses', async () => {
    const dir = await project(SENTENCES, [screen, unused]);
    const r = await composeStage(dir);
    expect(r.report.unusedAssets).toContain('assets/khac.mp4');
    expect(r.report.unusedAssets).not.toContain('assets/screen.mp4');
  }, 60000);
  it('a missing storyboard, transcript or cleaned video gives a clear error', async () => {
    const dir = await project();
    rmSync(join(dir, 'storyboard.json'));
    await expect(composeStage(dir)).rejects.toThrow('storyboard.json');
    const dir2 = await project();
    rmSync(join(dir2, 'transcript.json'));
    await expect(composeStage(dir2)).rejects.toThrow('transcript.json');
    const dir3 = await project();
    rmSync(join(dir3, 'cleaned.mp4'));
    await expect(composeStage(dir3)).rejects.toThrow('cleaned.mp4');
  }, 60000);
  it('a one-word transcript composes (Review Focus 1)', async () => {
    const dir = await project(['Xin'], undefined, 3);
    const r = await composeStage(dir);
    expect(r.report.captions.phrase).toBe(1);
    expect((await checkProject(dir)).filter(i => i.severity === 'error')).toEqual([]);
  }, 60000);
  it('composing twice gives the same plan and report', async () => {
    const a = await project(SENTENCES, [screen]);
    const b = await project(SENTENCES, [screen]);
    await composeStage(a);
    await composeStage(b);
    expect(json(a, 'plan.json')).toEqual(json(b, 'plan.json'));
    expect(json(a, 'compose-report.json')).toEqual(json(b, 'compose-report.json'));
  }, 120000);
  it('report counts captions by variant', async () => {
    const r = await composeStage(await project());
    expect(r.report.captions.phrase + r.report.captions.label + r.report.captions.big).toBeGreaterThan(0);
  }, 60000);
  it('a storyboard with missing or wrongly typed fields composes and names the beats it repaired or skipped (Review finding 1)', async () => {
    const dir = await project();
    const raw = readStoryboard(dir) as any;
    delete raw.beats[0].treatment;
    raw.beats[1].treatment.caption = null;
    raw.beats[1].treatment.inserts = null;
    raw.beats[2] && (raw.beats[2].treatment.caption.hl = 3, raw.beats[2].treatment.caption.bigRange = 3, delete raw.beats[2].cues);
    raw.beats.push({ id: 'bx', start: 0, end: 1, firstWord: null, lastWord: 2, treatment: {} });
    writeStoryboard(dir, raw);
    const r = await composeStage(dir);
    const text = r.report.issues.join('\n');
    for (const id of ['b1', 'b2', 'bx']) expect(text).toContain(id);
    expect((await checkProject(dir)).filter(i => i.severity === 'error')).toEqual([]);
  }, 60000);
  it('a camera type in inserts, and footage without a real src, never reach plan.json (Review finding 2)', async () => {
    const dir = await project();
    const sb = readStoryboard(dir);
    sb.beats[0].treatment.inserts = [
      { type: 'zoom-punch', props: {}, at: 1, duration: 1 },
      { type: 'footage', props: { src: 'assets/gõ-nhầm.mp4', frame: 'window' }, at: 3, duration: 2 },
      { type: 'footage', props: { frame: 'window' }, at: 6, duration: 2 },
    ];
    sb.beats[0].treatment.camera = [{ type: 'zoom-punch', at: 1.2, duration: 1 }];
    writeStoryboard(dir, sb);
    const r = await composeStage(dir);
    const plan = json(dir, 'plan.json') as Plan;
    expect(plan.layers.filter(l => l.track === 'footage')).toEqual([]);
    expect(plan.layers.filter(l => l.track === 'camera')).toHaveLength(1);
    expect(r.report.inserts.dropped).toHaveLength(3);
    expect((await checkProject(dir)).filter(i => i.severity === 'error')).toEqual([]);
  }, 60000);
  it('new layers get ids that do not clash with the existing plan, so merge keeps them (Review finding 4)', async () => {
    const dir = await project();
    const sb = readStoryboard(dir);
    const logo = (at: number) => ({ type: 'logo-badge', props: { label: 'Claude' }, at, duration: 2 });
    sb.beats[0].treatment.inserts = [logo(2), logo(8)];
    writeStoryboard(dir, sb);
    await composeStage(dir);
    const plan = json(dir, 'plan.json') as Plan;
    plan.layers.find(l => l.id === 'i2')!.locked = true; // the user locked the second badge
    writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan, null, 2));
    sb.beats[0].treatment.inserts = [logo(2), { type: 'stat-card', props: { rows: [{ value: '30 phút' }] }, at: 11, duration: 2 }];
    writeStoryboard(dir, sb);
    await composeStage(dir);
    const merged = mergeRegenerated(readPlan(dir), json(dir, 'plan.next.json') as Plan);
    expect(merged.layers.some(l => l.type === 'stat-card')).toBe(true);
    expect(new Set(merged.layers.map(l => l.id)).size).toBe(merged.layers.length);
  }, 60000);
  it('captions over a bright picture get a plate; over a mid-grey picture they do not (legibility)', async () => {
    const bright = await project();
    await writeCleanedVideo(bright, 14, 'white');
    await composeStage(bright);
    const plates = (json(bright, 'plan.json') as Plan).layers.filter(l => l.track === 'caption' && (l.props as { backdrop?: string } | undefined)?.backdrop === 'plate');
    expect(plates.length).toBeGreaterThan(0);
    expect((await checkProject(bright)).filter(i => i.code === 'caption-low-contrast')).toEqual([]);
    const grey = await project();
    await composeStage(grey);
    expect((json(grey, 'plan.json') as Plan).layers.some(l => (l.props as { backdrop?: string } | undefined)?.backdrop === 'plate')).toBe(false);
  }, 120000);
});
