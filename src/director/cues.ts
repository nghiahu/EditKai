import type { Glossary } from './glossary';
import { normalizeLoose, normalizeTone } from './text';
import type { BeatSpan, Cue, CueKind } from './types';

interface Tok { idx: number; raw: string; norm: string; tone: string }

const NUMBER_UNITS = new Set(['phut', 'giay', 'gio', 'tieng', 'ngay', 'k', 'trieu', 'nghin', 'usd', 'vnd', 'dong', '$', '%']);
const NUMBER = /^\d+([.,]\d+)?%?$/;
const SENTENCE_END = /[.?!…]$/;
const MAX_PROMPT_WORDS = 8;
const MIN_PROMPT_WORDS = 3;
const MAX_LIST_ITEM_WORDS = 4;
const KIND_ORDER: CueKind[] = ['section', 'cta', 'tool', 'number', 'prompt', 'list', 'emphasis', 'ui', 'shortvideo', 'question'];

const stripEnds = (s: string) => s.replace(/^[^\p{L}\p{N}%$]+|[^\p{L}\p{N}%$]+$/gu, '');
const joinRaw = (toks: Tok[]) => toks.map(t => t.raw).join(' ');

/** Start positions in `toks` where the normalised `pattern` tokens occur consecutively. */
function findSeq(toks: Tok[], pattern: string[], key: 'norm' | 'tone' = 'norm'): number[] {
  const out: number[] = [];
  if (pattern.length === 0) return out;
  for (let i = 0; i + pattern.length <= toks.length; i++) {
    if (pattern.every((p, k) => toks[i + k][key] === p)) out.push(i);
  }
  return out;
}

const patternOf = (entry: string) => entry.split(/\s+/).map(normalizeLoose).filter(Boolean);

/** Content signals of one beat (see the spec table); `word` is always an index into the whole transcript. */
export function detectCues(words: { t: string; s: number; e: number }[], span: BeatSpan, glossary: Glossary): Cue[] {
  const toks: Tok[] = [];
  for (let i = span.firstWord; i <= span.lastWord && i < words.length; i++) toks.push({ idx: i, raw: words[i].t, norm: normalizeLoose(words[i].t), tone: normalizeTone(words[i].t) });
  const cues: Cue[] = [];

  // tool: glossary terms (one or more tokens), then Latin capitalised words that are not the first word of the beat
  const taken = new Set<number>();
  for (const { term, label } of glossary.terms) {
    for (const at of findSeq(toks, patternOf(term))) {
      cues.push({ kind: 'tool', text: term, word: toks[at].idx, label: label ?? 'công cụ' });
      taken.add(toks[at].idx);
    }
  }
  toks.forEach((t, i) => {
    const c = stripEnds(t.raw);
    const vietnamese = (glossary.notTools ?? []).includes(normalizeLoose(c)); // "Trong" at the start of a sentence is not a tool
    if (i > 0 && c.length >= 2 && /^[A-Z][A-Za-z0-9.]*$/.test(c) && /[a-z]/.test(c) && !vietnamese && !taken.has(t.idx)) cues.push({ kind: 'tool', text: c, word: t.idx, label: 'công cụ' });
  });

  // number: digits followed by a unit or a percent sign, or "nửa tiếng" / "nửa giờ"
  for (let i = 0; i < toks.length; i++) {
    const nua = toks[i].norm === 'nua' && ['tieng', 'gio', 'phut'].includes(toks[i + 1]?.norm ?? '');
    if (nua) { cues.push({ kind: 'number', text: joinRaw(toks.slice(i, i + 2)), word: toks[i].idx }); i += 1; continue; }
    if (!NUMBER.test(toks[i].norm)) continue;
    let j = i;
    while (j + 1 < toks.length && (NUMBER.test(toks[j + 1].norm) || toks[j + 1].norm === '%')) j++;
    const percent = toks.slice(i, j + 1).some(t => t.norm.endsWith('%'));
    const unit = toks[j + 1] && NUMBER_UNITS.has(toks[j + 1].norm) ? j + 1 : -1;
    if (percent || unit >= 0) {
      const end = unit >= 0 ? unit : j;
      cues.push({ kind: 'number', text: joinRaw(toks.slice(i, end + 1)), word: toks[i].idx });
      i = end;
    }
  }

  // prompt: text inside double quotes, else the words after a prompt verb
  const open = toks.findIndex(t => /^["“]/.test(t.raw));
  let prompt: Cue | undefined;
  if (open >= 0) {
    let close = open;
    while (close < toks.length - 1 && !/["”][^\p{L}\p{N}]*$/u.test(toks[close].raw.replace(/^["“]/, '')) ) close++;
    const text = joinRaw(toks.slice(open, close + 1)).replace(/["“”]/g, '').trim();
    if (text) prompt = { kind: 'prompt', text, word: toks[open].idx };
  }
  if (!prompt) {
    for (const verb of glossary.promptVerbs) {
      const pat = patternOf(verb);
      const at = findSeq(toks, pat)[0];
      if (at === undefined) continue;
      const rest: Tok[] = [];
      for (let k = at + pat.length; k < toks.length && rest.length < MAX_PROMPT_WORDS; k++) {
        rest.push(toks[k]);
        if (SENTENCE_END.test(toks[k].raw)) break;
      }
      if (rest.length >= MIN_PROMPT_WORDS) { prompt = { kind: 'prompt', text: joinRaw(rest).replace(/[\s,.;:!?…]+$/u, ''), word: rest[0].idx }; break; }
    }
  }
  if (prompt) cues.push(prompt);

  // list: three or more short segments split at commas or "và"
  const segments: Tok[][] = [];
  let seg: Tok[] = [];
  for (const t of toks) {
    if (t.norm === 'va') { if (seg.length) segments.push(seg); seg = []; continue; }
    seg.push(t);
    if (t.raw.endsWith(',')) { segments.push(seg); seg = []; }
  }
  if (seg.length) segments.push(seg);
  if (segments.length >= 3 && segments.every(s => s.length <= MAX_LIST_ITEM_WORDS)) {
    cues.push({ kind: 'list', text: span.text, word: segments[0][0].idx, items: segments.map(s => joinRaw(s).replace(/[\s,]+$/u, '')) });
  }

  // emphasis: every occurrence; ui and shortvideo: the first occurrence of each entry
  for (const entry of glossary.emphasis) {
    // emphasis keeps tone marks: dùng and đúng must not match đừng
    const pat = entry.split(/\s+/).map(normalizeTone).filter(Boolean);
    for (const at of findSeq(toks, pat, 'tone')) cues.push({ kind: 'emphasis', text: joinRaw(toks.slice(at, at + pat.length)), word: toks[at].idx });
  }
  for (const [kind, entries] of [['ui', glossary.ui], ['shortvideo', glossary.shortvideo]] as const) {
    for (const entry of entries) {
      const pat = patternOf(entry);
      const at = findSeq(toks, pat)[0];
      if (at !== undefined) cues.push({ kind, text: joinRaw(toks.slice(at, at + pat.length)), word: toks[at].idx });
    }
  }

  // section marks and calls to action: the first occurrence of each entry; entries with the same label give one cue. "bước <số>" is always a section.
  for (const [kind, entries] of [['section', glossary.section ?? []], ['cta', glossary.cta ?? []]] as const) {
    for (const { term, label } of entries) {
      const at = findSeq(toks, patternOf(term))[0];
      const text = label ?? term.toUpperCase();
      if (at !== undefined && !cues.some(c => c.kind === kind && c.text === text)) cues.push({ kind, text, word: toks[at].idx });
    }
  }
  toks.forEach((t, i) => {
    if (t.norm === 'buoc' && /^\d+$/.test(toks[i + 1]?.norm ?? '')) cues.push({ kind: 'section', text: `BƯỚC ${toks[i + 1].norm}`, word: t.idx });
  });

  if (toks.length > 0 && toks[toks.length - 1].raw.endsWith('?')) cues.push({ kind: 'question', text: span.text, word: span.lastWord });

  return cues.sort((a, b) => (a.word ?? 0) - (b.word ?? 0) || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
}
