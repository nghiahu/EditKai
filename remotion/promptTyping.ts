const CHARS_PER_SECOND = 28;
const START_FRAME = 6;
export const STRIKE_DELAY_SEC = 0.4; // the strike line starts this long after the last character
export const STRIKE_FRAMES = 12; // and takes this many frames to draw

const graphemes = (text: string): string[] => Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), s => s.segment);

/** The prefix of `text` typed by `frame`: 28 characters per second from frame 6, whole grapheme clusters only (a base letter never appears without its combining marks). */
export function typedText(text: string, frame: number, fps: number): string {
  if (!(frame >= START_FRAME)) return '';
  const g = graphemes(text);
  const count = Math.min(g.length, Math.max(0, Math.floor(((frame - START_FRAME) * CHARS_PER_SECOND) / fps)));
  return g.slice(0, count).join('');
}

/** The first frame at which the whole text is typed (6 for an empty text). */
export function typingDoneFrame(text: string, fps: number): number {
  const n = graphemes(text).length;
  return n === 0 ? START_FRAME : START_FRAME + Math.ceil((n * fps) / CHARS_PER_SECOND);
}

/** The first frame at which the strike line is fully drawn (typing end + delay + draw time). */
export function strikeDoneFrame(text: string, fps: number): number {
  return typingDoneFrame(text, fps) + Math.round(STRIKE_DELAY_SEC * fps) + STRIKE_FRAMES;
}
