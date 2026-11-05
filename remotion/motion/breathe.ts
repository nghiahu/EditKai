const AMPLITUDE = 0.012; // share of the size
const PERIOD_SEC = 2;

/** A scale factor close to 1 that slowly swells and settles, for something held on screen: it is 1 at frame 0, never more than 1.2% off, and follows the frame rate. */
export function breathe(frame: number, fps: number): number {
  return 1 + AMPLITUDE * Math.sin((2 * Math.PI * frame) / (fps * PERIOD_SEC));
}
