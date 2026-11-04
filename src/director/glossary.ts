import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeLoose, normalizeTone } from './text';

export interface GlossaryTerm { term: string; label?: string }

export interface Glossary {
  terms: GlossaryTerm[];
  section?: GlossaryTerm[]; // marks of a part of the talk ("mở bài", "đầu tiên", ...); the label is what the card says
  cta?: GlossaryTerm[]; // calls to action ("đăng ký", "bình luận", ...)
  notTools?: string[]; // Vietnamese words written without tone marks ("Trong", "Cho"): a capital letter on them is a sentence start, not a tool name
  ui: string[];
  shortvideo: string[];
  emphasis: string[];
  promptVerbs: string[];
}

const defaultFile = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'styles', 'glossary.json');
const LISTS = ['ui', 'shortvideo', 'emphasis', 'promptVerbs', 'notTools'] as const;

function dedupe<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter(item => { const k = key(item); if (seen.has(k)) return false; seen.add(k); return true; });
}

const asTerm = (t: unknown): { term: string; label?: string } | undefined =>
  typeof t === 'string' ? { term: t } : t && typeof t === 'object' && typeof (t as { term?: unknown }).term === 'string' ? (t as { term: string; label?: string }) : undefined;

/** The shipped glossary (styles/glossary.json) merged with `<project>/glossary.json` when present; the project's entries win on repeats. */
export function loadGlossary(projectDir: string): Glossary {
  const base = JSON.parse(readFileSync(defaultFile, 'utf8')) as Glossary;
  let extra: Partial<Record<keyof Glossary, unknown[]>> = {};
  const file = join(projectDir, 'glossary.json');
  if (existsSync(file)) {
    try { extra = JSON.parse(readFileSync(file, 'utf8')) ?? {}; }
    catch (e) { throw new Error(`glossary.json không phải JSON hợp lệ: ${(e as Error).message}`); }
  }
  // lists of { term, label }: the project's entries come first, so they win on repeats
  const termList = (key: 'terms' | 'section' | 'cta'): GlossaryTerm[] => {
    const own = (Array.isArray(extra[key]) ? extra[key]! : []).map(asTerm).filter(<T>(t: T | undefined): t is T => t !== undefined);
    return dedupe([...own, ...(base[key] ?? [])], t => normalizeLoose(t.term));
  };
  const merged: Glossary = { terms: termList('terms'), section: termList('section'), cta: termList('cta'), ui: [], shortvideo: [], emphasis: [], promptVerbs: [], notTools: [] };
  for (const list of LISTS) {
    const own = (Array.isArray(extra[list]) ? extra[list]! : []).filter((x): x is string => typeof x === 'string');
    merged[list] = dedupe([...own, ...(base[list] ?? [])], normalizeLoose);
  }
  return merged;
}

// tone marks matter: loosely, đừng would equal dùng and đúng
const NEGATIONS = new Set(['đừng', 'không', 'chưa', 'đừng có', 'khong']);

/** True for a negating emphasis word such as "đừng" or "không" (used to decide a prompt box gets a strike). */
export const isNegation = (text: string): boolean => NEGATIONS.has(normalizeTone(text));
