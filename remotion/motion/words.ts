import type { Motion } from '../../src/style/motion';
import { easeOut } from './ease';

const MIN_POP_SEC = 0.12;

/** Pop progress 0 → 1 of one caption word: starts `wordLeadSec` before it is spoken, reaches 1 once it is over. */
export function wordProgress(word: { s: number; e: number }, tSec: number, motion: Motion): number {
  const start = word.s - motion.wordLeadSec;
  const end = Math.max(word.e, start + MIN_POP_SEC);
  return easeOut((tSec - start) / (end - start));
}
