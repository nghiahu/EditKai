/** Lower-case, diacritic-free form used for matching (NFC and NFD input alike, đ becomes d); punctuation at both ends is dropped. */
export function normalizeLoose(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .trim()
    .replace(/^[^\p{L}\p{N}%$]+|[^\p{L}\p{N}%$]+$/gu, '');
}

/** Lower-case NFC form that keeps tone marks (so dùng and đừng stay different); punctuation at both ends is dropped. */
export function normalizeTone(s: string): string {
  return s.normalize('NFC').toLowerCase().trim().replace(/^[^\p{L}\p{N}%$]+|[^\p{L}\p{N}%$]+$/gu, '');
}

/** normalizeLoose of every whitespace-separated word, empty ones dropped. */
export function tokens(s: string): string[] {
  return s.split(/\s+/).map(normalizeLoose).filter(Boolean);
}
