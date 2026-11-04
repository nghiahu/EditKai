import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeLoose, normalizeTone } from './text';

export interface Glossary {
  terms: { term: string; label?: string }[];
  ui: string[];
  shortvideo: string[];
  emphasis: string[];
  promptVerbs: string[];
}

const defaultFile = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'styles', 'glossary.json');
const LISTS = ['ui', 'shortvideo', 'emphasis', 'promptVerbs'] as const;

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
  const terms = [...(Array.isArray(extra.terms) ? extra.terms : []).map(asTerm).filter(<T>(t: T | undefined): t is T => t !== undefined), ...base.terms];
  const merged: Glossary = { terms: dedupe(terms, t => normalizeLoose(t.term)), ui: [], shortvideo: [], emphasis: [], promptVerbs: [] };
  for (const list of LISTS) {
    const own = (Array.isArray(extra[list]) ? extra[list]! : []).filter((x): x is string => typeof x === 'string');
    merged[list] = dedupe([...own, ...base[list]], normalizeLoose);
  }
  return merged;
}

// tone marks matter: loosely, đừng would equal dùng and đúng
const NEGATIONS = new Set(['đừng', 'không', 'chưa', 'đừng có', 'khong']);

/** True for a negating emphasis word such as "đừng" or "không" (used to decide a prompt box gets a strike). */
export const isNegation = (text: string): boolean => NEGATIONS.has(normalizeTone(text));
