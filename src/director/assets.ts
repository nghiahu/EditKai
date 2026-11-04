import type { Asset } from '../assets/manifest';
import { tokens } from './text';
import type { Cue } from './types';

const MIN_SCORE = 2;
const KIND_BONUS = 2;
const MIN_WORD_LENGTH = 3;

// common Vietnamese function words (no diacritics) that say nothing about what a clip shows
const STOP_WORDS = new Set([
  'cua', 'cho', 'khi', 'nhung', 'nay', 'duoc', 'mot', 'cac', 'voi', 'la', 'va', 'de', 'trong', 'nhu', 'cung', 'nhe', 'roi', 'thi',
  'ma', 'co', 'khong', 'nao', 'nua', 'da', 'se', 'ra', 'vao', 'len', 'xuong', 'cung', 'nen', 'hay', 'rat', 'qua', 'do', 'day', 'kia',
]);

const meaningful = (text: string): Set<string> =>
  new Set(tokens(text).filter(t => t.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(t)));

/**
 * The footage that best fits a beat: shared meaningful words between its description and the beat (diacritics ignored),
 * plus a bonus when a screen clip meets a `ui` cue or a phone clip a `shortvideo` cue. Needs a score of 2; ties go to the earlier asset.
 */
export function matchAsset(beatText: string, cues: Cue[], assets: Asset[]): { asset: Asset; score: number } | undefined {
  const beat = meaningful(beatText);
  const has = (kind: Cue['kind']) => cues.some(c => c.kind === kind);
  let best: { asset: Asset; score: number } | undefined;
  for (const asset of assets) {
    let score = 0;
    for (const w of meaningful(asset.description)) if (beat.has(w)) score++;
    if ((asset.kind === 'screen' && has('ui')) || (asset.kind === 'phone' && has('shortvideo'))) score += KIND_BONUS;
    if (score >= MIN_SCORE && (!best || score > best.score)) best = { asset, score };
  }
  return best;
}
