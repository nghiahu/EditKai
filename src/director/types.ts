// Shared shapes of the director pipeline: storyboard.json is Storyboard; the AI edits each beat's treatment.
export type CueKind = 'tool' | 'number' | 'prompt' | 'list' | 'emphasis' | 'ui' | 'shortvideo' | 'question';

/** A content signal found in a beat; `word` is an index into transcript.words. */
export interface Cue {
  kind: CueKind;
  text: string;
  word?: number;
  label?: string;
  items?: string[];
}

export interface CaptionSpec {
  variant: 'phrase' | 'label' | 'big';
  label?: string;
  hl: number[]; // transcript word indexes to emphasise
  bigRange: [number, number] | null; // transcript word indexes (at most 3 words) rendered as a big caption
}

export interface InsertSpec {
  type: string; // a key of LAYER_TYPES
  props: Record<string, unknown>;
  at: number; // seconds on the cleaned.mp4 timeline
  duration: number;
}

export interface CameraSpec {
  type: 'zoom-punch' | 'shake';
  at: number;
  duration: number;
  props?: Record<string, unknown>;
}

export interface Treatment {
  caption: CaptionSpec;
  inserts: InsertSpec[];
  camera: CameraSpec[];
  note?: string;
}

export interface Beat {
  id: string;
  start: number;
  end: number;
  firstWord: number;
  lastWord: number; // inclusive
  text: string;
  cues: Cue[];
  reviewed: boolean;
  treatment: Treatment;
}

export interface Storyboard {
  version: 1;
  style: string;
  beats: Beat[];
}

export interface BeatSpan {
  firstWord: number;
  lastWord: number;
  start: number;
  end: number;
  text: string;
}
