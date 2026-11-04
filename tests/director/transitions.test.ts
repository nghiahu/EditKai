import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_PLAYBOOK, loadPlaybook, type Playbook } from '../../src/director/playbook';
import { suggestTreatments } from '../../src/director/suggest';
import type { BeatSpan, Cue } from '../../src/director/types';
import { TRANSITION_KINDS } from '../../src/plan/layerTypes';
import { loadTheme } from '../../src/style/theme';

const m1 = loadTheme('styles/m1').director;
const FPS = 30;
const NAMES = ['một', 'hai', 'ba', 'bốn', 'năm'];
/** n beats of 5 words, 2 s each (0.4 s per word). */
const timeline = (n: number) => {
  const w = Array.from({ length: n * 5 }, (_, i) => ({ t: NAMES[i % 5], s: i * 0.4, e: i * 0.4 + 0.3 }));
  const spans = Array.from({ length: n }, (_, i): BeatSpan => ({ firstWord: i * 5, lastWord: i * 5 + 4, start: i * 2, end: i * 2 + 1.9, text: '' }));
  return { w, spans };
};
const cue = (kind: Cue['kind'], word: number, text = 'x'): Cue => ({ kind, text, word });
const go = (n: number, joins: number[] | undefined, opts: { cues?: Cue[][]; playbook?: Playbook } = {}) => {
  const { w, spans } = timeline(n);
  const out = suggestTreatments({ spans, cues: spans.map((_, i) => opts.cues?.[i] ?? []), matches: spans.map(() => undefined), words: w, director: m1, fps: FPS, playbook: opts.playbook, joins });
  return { out, spans, all: out.flatMap(t => t.inserts).sort((a, b) => a.at - b.at) };
};
const transitions = (all: { type: string; at: number; duration: number; props: Record<string, unknown> }[]) => all.filter(i => i.type === 'transition');

describe('a transition centred on every join', () => {
  it('0.4 s long, starting 0.2 s before the join, in the beat that holds it', () => {
    const { out, spans, all } = go(15, [9.6, 19.6]);
    const t = transitions(all);
    expect(t.map(x => [+x.at.toFixed(2), x.duration])).toEqual([[9.4, 0.4], [19.4, 0.4]]);
    t.forEach(tr => {
      const beat = out[spans.findIndex(s => s.start <= tr.at + 1e-6 && tr.at <= s.end + 0.1)];
      expect(beat.inserts).toContain(tr);
    });
  });
  it('no joins, an empty list or an empty transitions list give none', () => {
    expect(transitions(go(15, undefined).all)).toEqual([]);
    expect(transitions(go(15, []).all)).toEqual([]);
    expect(transitions(go(15, [9.6], { playbook: { ...DEFAULT_PLAYBOOK, transitions: [] } }).all)).toEqual([]);
  });
  it('joins at the very start or end of the video, or not a number, are ignored', () => {
    const { all } = go(15, [0.1, 29.9, Number.NaN, -3, 400, 15]);
    expect(transitions(all).map(x => +(x.at + 0.2).toFixed(1))).toEqual([15]);
  });
  it('kinds rotate through the playbook list and two neighbours are never alike', () => {
    const joins = Array.from({ length: 12 }, (_, i) => 3 + i * 2.4);
    const kinds = transitions(go(15, joins).all).map(x => x.props.kind as string);
    expect(kinds).toHaveLength(12);
    kinds.forEach((k, i) => { if (i) expect(k).not.toBe(kinds[i - 1]); });
    expect(new Set(kinds).size).toBe(DEFAULT_PLAYBOOK.transitions.length);
    kinds.slice(0, DEFAULT_PLAYBOOK.transitions.length).forEach((k, i) => expect(k).toBe(DEFAULT_PLAYBOOK.transitions[i]));
  });
});

describe('graphics stay away from a join', () => {
  const zone = (j: number) => [j - 0.3, j + 0.3];
  const overlapsZone = (i: { at: number; duration: number }, j: number) => i.at < zone(j)[1] && i.at + i.duration > zone(j)[0];
  it('an insert that would run across a join is shortened when enough remains before it', () => {
    const { all } = go(8, [10.0], { cues: [[], [], [], [cue('number', 17, '30 phút')]] }); // word 17 starts at 6.8 s, in beat 3
    const stat = all.find(i => i.type === 'stat-card')!;
    expect(stat).toBeTruthy();
    expect(overlapsZone(stat, 10.0)).toBe(false);
    expect(stat.at).toBeCloseTo(6.8, 5);
    expect(stat.duration).toBeCloseTo(10.0 - 0.3 - 6.8, 5); // shortened, not moved
  });
  it('one that starts too close to the join (less than 1.2 s would remain) starts after the join instead', () => {
    const { all } = go(8, [10.0], { cues: [[], [], [], [], [], [cue('tool', 25, 'Claude')]] }); // word 25 starts at 10.0 s: right on the join
    const badge = all.find(i => i.type === 'logo-badge')!;
    expect(badge.at).toBeCloseTo(10.3, 5);
    expect(overlapsZone(badge, 10.0)).toBe(false);
  });
  it('a title card (another track) keeps away too: the join is a cut, a card should not straddle it', () => {
    const { all } = go(8, [8.5], { cues: [[], [], [], [], [cue('section', 21, 'THÂN BÀI')]] }); // word 21 starts at 8.4 s
    const card = all.find(i => i.type === 'title-card')!;
    expect(overlapsZone(card, 8.5)).toBe(false);
  });
  it('fillers also keep away from the joins', () => {
    const joins = [5, 10, 15, 20, 25];
    const { all } = go(15, joins);
    for (const f of all.filter(i => i.maybe)) for (const j of joins) expect(overlapsZone(f, j), `filler at ${f.at}`).toBe(false);
  });
  it('without joins nothing is moved: the same insert as before', () => {
    const base = go(8, undefined, { cues: [[], [], [], [cue('number', 17, '30 phút')]] }).all.find(i => i.type === 'stat-card')!;
    expect(base.duration).toBe(3.5);
  });
});

describe('the playbook list of transitions', () => {
  it('every shipped playbook has at least three kinds, all real, none repeated, and no flash (a full white frame is too harsh to rotate)', () => {
    for (const pb of [DEFAULT_PLAYBOOK, loadPlaybook('styles/m1'), loadPlaybook('styles/s1')]) {
      expect(pb.transitions.length).toBeGreaterThanOrEqual(3);
      pb.transitions.forEach(k => expect(TRANSITION_KINDS).toContain(k));
      expect(new Set(pb.transitions).size).toBe(pb.transitions.length);
      expect(pb.transitions).not.toContain('flash');
    }
  });
  it('a style file can set its own list or turn them off; an unknown kind is a clear error', () => {
    const dir = (pb: unknown) => { const d = mkdtempSync(join(tmpdir(), 'editkai-pb-')); writeFileSync(join(d, 'playbook.json'), JSON.stringify(pb)); return d; };
    expect(loadPlaybook(dir({ transitions: ['dip', 'whip'] })).transitions).toEqual(['dip', 'whip']);
    expect(loadPlaybook(dir({ transitions: [] })).transitions).toEqual([]);
    expect(() => loadPlaybook(dir({ transitions: ['zoom', 'spin'] }))).toThrow(/spin/);
    expect(() => loadPlaybook(dir({ transitions: 'zoom' }))).toThrow(/transitions/);
  });
});
