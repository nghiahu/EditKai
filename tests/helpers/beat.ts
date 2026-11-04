import type { Beat } from '../../src/director/types';

export const beatOf = (over: Partial<Beat> = {}, t: Partial<Beat['treatment']> = {}): Beat => ({
  id: 'b1', start: 0, end: 3, firstWord: 2, lastWord: 7, text: '', cues: [], reviewed: false,
  treatment: { caption: { variant: 'phrase', hl: [], bigRange: null }, inserts: [], camera: [], ...t },
  ...over,
});
