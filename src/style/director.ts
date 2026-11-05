// Browser-safe (no node imports): the Remotion Root and the director modules import this directly.
/** Per-style numbers for the director: how dense inserts are, which kinds a style allows, how often big words and punches may repeat. */
export interface Director {
  insertGapMaxSec: number; // a stretch longer than this without an insert triggers the insert-gap warning
  insertMinGapSec: number; // suggested inserts start at least this long after the previous one ends
  allowedInserts: string[];
  captionMix: { label: number; big: number }; // target shares of label and big captions
  bigSpacingSec: number;
  punchSpacingSec: number;
}

export const DEFAULT_DIRECTOR: Director = {
  insertGapMaxSec: 35,
  insertMinGapSec: 6,
  allowedInserts: ['title-card', 'stat-card', 'footage', 'logo-badge', 'explainer-scene', 'counter', 'step-number'],
  captionMix: { label: 0.05, big: 0 },
  bigSpacingSec: 8,
  punchSpacingSec: 20,
};
