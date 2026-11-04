import type { Asset } from '../assets/manifest';
import { strikeDoneFrame, typingDoneFrame } from '../../remotion/promptTyping';
import type { Director } from '../style/director';
import { isNegation } from './glossary';
import { DEFAULT_PLAYBOOK, fillProps, type Playbook, type Recipe } from './playbook';
import { normalizeLoose } from './text';
import type { BeatSpan, Cue, InsertSpec, Treatment } from './types';

type W = { t: string; s: number; e: number };

// when two situations of one beat want an insert, the first of these wins (the other usually fails the minimum gap)
const SITUATION_PRIORITY = ['footage', 'prompt', 'section', 'cta', 'number', 'tool', 'list'];
const FOOTAGE_SEC = 4;
const FILL_TAIL_SEC = 0.5; // the video is taken to end this long after the last word
const MAX_FILLERS = 200;
const FILL_EMPHASIS_BONUS = 2; // seconds of distance a beat with an emphasised word is worth
const MAX_PHRASE_WORDS = 3;
const MAX_PHRASE_CHARS = 30;
const MIN_SHARE_JUDGED = 4; // maxShare only applies once this many inserts exist
const PHONE_FOOTAGE_SEC = 3;
const PROMPT_TAIL_SEC = 0.3;
const PUNCH_SEC = 1.2;
const PUNCH_LEAD_SEC = 0.05;
const BIG_RADIUS = 1; // words on each side of the emphasis word
const MIN_LABEL_WORDS = 3;

const wordCount = (s: BeatSpan) => s.lastWord - s.firstWord + 1;

/** "30 phút", "50%", "2,5%", "100" → the number and its unit; anything else (a range, words) is not a count. */
function parseCount(text: string): { to: number; decimals: number; unit: string } | undefined {
  const m = /^(\d+(?:[.,]\d+)?)\s*(%|\p{L}+(?:\s+\p{L}+)?)?$/u.exec(text.trim());
  if (!m) return undefined;
  const decimals = /[.,](\d+)$/.exec(m[1])?.[1].length ?? 0;
  return { to: Number(m[1].replace(',', '.')), decimals, unit: m[2] ?? '' };
}

function counterProps(text: string): Record<string, unknown> {
  const c = parseCount(text)!;
  return { to: c.to, ...(c.decimals ? { decimals: c.decimals } : {}), ...(c.unit ? { suffix: c.unit === '%' ? '%' : ` ${c.unit}` } : {}) };
}

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
  playbook?: Playbook;
}): Treatment[] {
  const { spans, cues, matches, words, director, fps } = input;
  const playbook = input.playbook ?? DEFAULT_PLAYBOOK;
  const accepted: { at: number; end: number; type: string }[] = [];
  const lastUsed: Record<string, number> = {}; // recipe id -> how many inserts had been accepted when it was last used (higher = more recent)

  /** The recipe for a situation at time `at`: allowed by the style, within the type shares and the same-type gap, then the one used longest ago. */
  const choose = (recipes: Recipe[], at: number): Recipe | undefined => {
    const v = playbook.variety;
    const ok = recipes.filter(r => {
      if (!director.allowedInserts.includes(r.type)) return false;
      const share = v.maxShare[r.type];
      if (share !== undefined && accepted.length >= MIN_SHARE_JUDGED && (accepted.filter(a => a.type === r.type).length + 1) / (accepted.length + 1) > share) return false;
      return !accepted.some(a => a.type === r.type && at < a.end + v.sameTypeGapSec && a.at < at + r.duration + v.sameTypeGapSec); // too close to one before it or one after it
    });
    if (!v.rotate) return ok[0];
    return [...ok].sort((a, b) => (lastUsed[a.id] ?? 0) - (lastUsed[b.id] ?? 0))[0];
  };
  let lastBigAt = -Infinity;
  let lastPunchAt = -Infinity;
  let labelCount = 0;

  /**
   * Fills stretches longer than `insertGapMaxSec` with no insert: the biggest gap first, a filler (the playbook's `filler` situation, marked
   * `maybe: true`) on the beat nearest the middle of it that keeps the minimum gaps, preferring a beat with an emphasised word. A filler says
   * the beat's own words (from the emphasised word, a few words, capitals): a guess for the director to confirm, reword or delete.
   */
  const fillGaps = (treatments: Treatment[]) => {
    const recipes = playbook.situations.filler ?? [];
    if (!recipes.length || !spans.length) return;
    const horizon = words.length ? words[words.length - 1].e + FILL_TAIL_SEC : 0;
    const skipped = new Set<number>();
    for (let round = 0; round < MAX_FILLERS; round++) {
      const sorted = [...accepted].sort((a, b) => a.at - b.at);
      const gaps: { from: number; to: number; open: boolean; close: boolean }[] = [];
      let cursor = 0;
      sorted.forEach((a, k) => { gaps.push({ from: cursor, to: a.at, open: k === 0, close: false }); cursor = Math.max(cursor, a.end); });
      gaps.push({ from: cursor, to: horizon, open: sorted.length === 0, close: true });
      const worst = gaps.filter(g => g.to - g.from > director.insertGapMaxSec && !skipped.has(g.from)).sort((a, b) => b.to - b.from - (a.to - a.from))[0];
      if (!worst) return;
      const lower = worst.from + (worst.open ? 0 : director.insertMinGapSec);
      const upper = worst.to - (worst.close ? 0 : director.insertMinGapSec);
      const mid = (worst.from + worst.to) / 2;
      let best: { i: number; rec: Recipe; at: number; score: number } | undefined;
      spans.forEach((s, i) => {
        const at = s.start;
        if (at < lower) return;
        const rec = choose(recipes, at);
        if (!rec || at + rec.duration > upper) return;
        const score = Math.abs(at - mid) - (treatments[i].caption.hl.length ? FILL_EMPHASIS_BONUS : 0);
        if (!best || score < best.score) best = { i, rec, at, score };
      });
      if (!best) { skipped.add(worst.from); continue; }
      const { i, rec, at } = best;
      const phrase = keyPhrase(spans[i], treatments[i].caption.hl);
      if (!phrase) { skipped.add(worst.from); continue; }
      treatments[i].inserts.push({ type: rec.type, props: fillProps(rec.props ?? {}, { text: phrase }), at, duration: rec.duration, maybe: true });
      treatments[i].inserts.sort((a, b) => a.at - b.at);
      accepted.push({ at, end: at + rec.duration, type: rec.type });
      lastUsed[rec.id] = accepted.length;
    }
  };

  /** Up to MAX_PHRASE_WORDS words of the beat from its first emphasised word (else its start), upper case, at most MAX_PHRASE_CHARS characters. */
  const keyPhrase = (span: BeatSpan, hl: number[]): string => {
    const from = hl.find(i => i >= span.firstWord && i <= span.lastWord) ?? span.firstWord;
    const picked: string[] = [];
    for (let i = from; i <= span.lastWord && picked.length < MAX_PHRASE_WORDS; i++) {
      const w = (words[i]?.t ?? '').replace(/^[^\p{L}\p{N}%$]+|[^\p{L}\p{N}%$]+$/gu, '').toUpperCase();
      if (!w) continue;
      if ([...picked, w].join(' ').length > MAX_PHRASE_CHARS) break;
      picked.push(w);
    }
    return picked.join(' ');
  };

  const treatments = spans.map((span, i): Treatment => {
    const beatCues = cues[i] ?? [];
    const asset = matches[i];
    const startOf = (cue?: Cue) => Math.min(span.end, Math.max(span.start, cue?.word !== undefined ? words[cue.word].s : span.start));
    const first = (kind: Cue['kind']) => beatCues.find(c => c.kind === kind);

    // candidates: one per situation of the beat, each in the recipe the playbook's variety rules choose
    type Candidate = InsertSpec & { situation: string; recipe?: string };
    const candidates: Candidate[] = [];
    const ui = first('ui');
    const shortvideo = first('shortvideo');
    const tool = first('tool'); // also decides the label caption below
    if (asset) {
      const phoneLike = asset.kind === 'phone';
      const cue = phoneLike ? shortvideo ?? ui : ui ?? shortvideo;
      candidates.push({
        situation: 'footage',
        type: 'footage',
        props: phoneLike ? { src: asset.file, frame: 'phone', motion: 'none' } : { src: asset.file, frame: 'window', motion: 'zoom-in' },
        at: startOf(cue),
        duration: phoneLike ? PHONE_FOOTAGE_SEC : FOOTAGE_SEC,
      });
    }
    const prompt = first('prompt');
    if (prompt) {
      const strike = beatCues.some(c => c.kind === 'emphasis' && isNegation(c.text));
      const frames = strike ? strikeDoneFrame(prompt.text, fps) : typingDoneFrame(prompt.text, fps);
      candidates.push({ situation: 'prompt', type: 'prompt-box', props: { text: prompt.text, strike }, at: startOf(prompt), duration: Math.max(1.5, frames / fps + PROMPT_TAIL_SEC) });
    }
    for (const situation of ['section', 'cta', 'number', 'tool', 'list'] as const) {
      const cue = first(situation);
      if (!cue || (situation === 'list' && !cue.items)) continue;
      const at = startOf(cue);
      // a counter needs a plain number (with a percent sign or a unit): a range such as 2-3% cannot count up
      const usable = (playbook.situations[situation] ?? []).filter(x => x.builder !== 'counter' || parseCount(cue.text));
      const rec = choose(usable, at);
      if (!rec) continue;
      let props: Record<string, unknown>;
      if (rec.builder === 'counter') props = counterProps(cue.text);
      else if (rec.builder === 'chips') props = { chips: cue.items!.map(label => ({ icon: 'check', label })) };
      else if (rec.builder === 'explainer-list') props = { title: span.text.split(/\s+/).slice(0, 3).join(' ').toUpperCase(), body: { kind: 'list', items: cue.items } };
      else props = fillProps(rec.props ?? {}, { text: cue.text, label: cue.label ?? (situation === 'tool' ? 'công cụ' : undefined), icon: situation === 'number' ? iconForNumber(cue.text) : undefined });
      candidates.push({ situation, recipe: rec.id, type: rec.type, props, at, duration: rec.duration });
    }

    const inserts: InsertSpec[] = [];
    for (const c of candidates.sort((a, b) => SITUATION_PRIORITY.indexOf(a.situation) - SITUATION_PRIORITY.indexOf(b.situation))) {
      if (!director.allowedInserts.includes(c.type)) continue;
      const clash = accepted.some(a => c.at < a.end + director.insertMinGapSec && a.at < c.at + c.duration + director.insertMinGapSec);
      if (clash) continue;
      accepted.push({ at: c.at, end: c.at + c.duration, type: c.type });
      if (c.recipe) lastUsed[c.recipe] = accepted.length;
      inserts.push({ type: c.type, props: c.props, at: c.at, duration: c.duration });
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
  fillGaps(treatments);
  return treatments;
}
