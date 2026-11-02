export function normalizeWord(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/[\p{P}\p{S}]/gu, '').trim();
}
