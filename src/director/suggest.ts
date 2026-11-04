import type { Asset } from '../assets/manifest';
import { strikeDoneFrame, typingDoneFrame } from '../../remotion/promptTyping';
import type { Director } from '../style/director';
import { isNegation } from './glossary';
import { normalizeLoose } from './text';
import type { BeatSpan, Cue, InsertSpec, Treatment } from './types';

type W = { t: string; s: number; e: number };

const PRIORITY = ['footage', 'prompt-box', 'stat-card', 'logo-badge', 'chip-stack', 'explainer-scene'];
const DURATION: Record<string, number> = { 'logo-badge': 2, 'stat-card': 3.5, 'chip-stack': 4, footage: 4, 'explainer-scene': 5 };
const PHONE_FOOTAGE_SEC = 3;
const PROMPT_TAIL_SEC = 0.3;
const PUNCH_SEC = 1.2;
const PUNCH_LEAD_SEC = 0.05;
const BIG_RADIUS = 1; // words on each side of the emphasis word
const MIN_LABEL_WORDS = 3;

const wordCount = (s: BeatSpan) => s.lastWord - s.firstWord + 1;

function iconForNumber(text: string): string | undefined {
  const n = normalizeLoose(text);
  if (/%/.test(text)) return 'gauge';
  if (/(phut|giay|gio|tieng)/.test(n)) return 'clock';
  return undefined;
}

/**
 * One suggested treatment per beat from its cues, in order, carrying state across beats (inserts must keep `insertMinGapSec`
 * apart, big captions `bigSpacingSec`, punches `punchSpacingSec`, label captions stay within `captionMix.label`).
 * Only insert types in `director.allowedInserts` are suggested; the AI reviews and overrides everything.
 */
export function suggestTreatments(input: {
  spans: BeatSpan[];
  cues: Cue[][];
  matches: (Asset | undefined)[];
  words: W[];
  director: Director;
  fps: number;
}): Treatment[] {
  const { spans, cues, matches, words, director, fps } = input;
  const accepted: { at: number; end: number }[] = [];
  let lastBigAt = -Infinity;
  let lastPunchAt = -Infinity;
  let labelCount = 0;

  return spans.map((span, i): Treatment => {
    const beatCues = cues[i] ?? [];
    const asset = matches[i];
    const startOf = (cue?: Cue) => Math.min(span.end, Math.max(span.start, cue?.word !== undefined ? words[cue.word].s : span.start));
    const first = (kind: Cue['kind']) => beatCues.find(c => c.kind === kind);

    // candidate inserts, then filtered by what the style allows
    const candidates: InsertSpec[] = [];
    const ui = first('ui');
    const shortvideo = first('shortvideo');
    if (asset) {
      const phoneLike = asset.kind === 'phone';
      const cue = phoneLike ? shortvideo ?? ui : ui ?? shortvideo;
      candidates.push({
        type: 'footage',
        props: phoneLike ? { src: asset.file, frame: 'phone', motion: 'none' } : { src: asset.file, frame: 'window', motion: 'zoom-in' },
        at: startOf(cue),
        duration: phoneLike ? PHONE_FOOTAGE_SEC : DURATION.footage,
      });
    }
    const prompt = first('prompt');
    if (prompt) {
      const strike = beatCues.some(c => c.kind === 'emphasis' && isNegation(c.text));
      const frames = strike ? strikeDoneFrame(prompt.text, fps) : typingDoneFrame(prompt.text, fps);
      candidates.push({ type: 'prompt-box', props: { text: prompt.text, strike }, at: startOf(prompt), duration: Math.max(1.5, frames / fps + PROMPT_TAIL_SEC) });
    }
    const number = first('number');
    if (number) {
      const icon = iconForNumber(number.text);
      candidates.push({ type: 'stat-card', props: { rows: [{ value: number.text, ...(icon ? { icon } : {}) }] }, at: startOf(number), duration: DURATION['stat-card'] });
    }
    const tool = first('tool');
    if (tool) candidates.push({ type: 'logo-badge', props: { label: tool.text, icon: 'sparkles' }, at: startOf(tool), duration: DURATION['logo-badge'] });
    const list = first('list');
    if (list?.items) {
      candidates.push({ type: 'chip-stack', props: { chips: list.items.map(label => ({ icon: 'check', label })) }, at: startOf(list), duration: DURATION['chip-stack'] });
      candidates.push({
        type: 'explainer-scene',
        props: { title: span.text.split(/\s+/).slice(0, 3).join(' ').toUpperCase(), body: { kind: 'list', items: list.items } },
        at: startOf(list),
        duration: DURATION['explainer-scene'],
      });
    }

    const inserts: InsertSpec[] = [];
    const listed = new Set<string>();
    for (const c of candidates.filter(c => director.allowedInserts.includes(c.type)).sort((a, b) => PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type))) {
      if (c.type === 'explainer-scene' && listed.has('chip-stack')) continue; // one list insert per beat
      const clash = accepted.some(a => c.at < a.end + director.insertMinGapSec && a.at < c.at + c.duration + director.insertMinGapSec);
      if (clash) continue;
      accepted.push({ at: c.at, end: c.at + c.duration });
      inserts.push(c);
      listed.add(c.type);
    }
    inserts.sort((a, b) => a.at - b.at);

    // caption: emphasised words, an optional label line, an optional big claim
    const emphasis = first('emphasis');
    const hl = [...new Set(beatCues.filter(c => (c.kind === 'emphasis' || c.kind === 'tool') && c.word !== undefined).map(c => c.word!))].sort((a, b) => a - b);
    let caption: Treatment['caption'] = { variant: 'phrase', hl, bigRange: null };
    if (tool && wordCount(span) >= MIN_LABEL_WORDS && labelCount < director.captionMix.label * spans.length) {
      caption = { ...caption, variant: 'label', label: tool.label ?? 'công cụ' };
      labelCount++;
    }
    const camera: Treatment['camera'] = [];
    if (emphasis?.word !== undefined) {
      const w = emphasis.word;
      if (director.captionMix.big > 0 && span.start - lastBigAt >= director.bigSpacingSec) {
        caption = { ...caption, bigRange: [Math.max(span.firstWord, w - BIG_RADIUS), Math.min(span.lastWord, w + BIG_RADIUS)] };
        lastBigAt = span.start;
      }
      const at = Math.max(0, words[w].s - PUNCH_LEAD_SEC);
      if (at - lastPunchAt >= director.punchSpacingSec) {
        camera.push({ type: 'zoom-punch', at, duration: PUNCH_SEC });
        lastPunchAt = at;
      }
    }
    return { caption, inserts, camera };
  });
}
