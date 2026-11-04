import type { Layer, Plan } from '../plan/types';

export interface PreviewFrame { t: number; label: string }

const SETTLED = 0.6; // an insert is looked at this share of the way through it, once its entrance is over
const EDGE_SEC = 0.5;
const END_MARGIN_SEC = 0.3;
const CAPTION_SAMPLES = 3;

/**
 * The moments of the video worth looking at, in time order, at most `max`: the middle of every transition (where the effect peaks), every
 * insert once it has settled, the captions with a plate, a few other captions, and the start and the end. When there are more than `max`,
 * transitions and inserts are kept and captions give way; two moments closer than `minGapSec` become one (the more important wins).
 */
export function previewFrames(plan: Plan, opts: { max?: number; minGapSec?: number } = {}): PreviewFrame[] {
  const { max = 24, minGapSec = 0.5 } = opts;
  const duration = Math.max(1, plan.scenes.at(-1)?.end ?? 0, ...plan.layers.map(l => l.end));
  const last = duration - 0.05;
  const candidates: (PreviewFrame & { priority: number })[] = [];
  const add = (priority: number, t: number, label: string) => { if (Number.isFinite(t) && t >= 0 && t <= last) candidates.push({ priority, t, label }); };

  const kind = (l: Layer) => (typeof l.props?.kind === 'string' ? ` ${l.props.kind}` : '');
  for (const l of plan.layers) {
    if (l.track === 'caption' || l.track === 'camera') continue;
    if (l.type === 'transition') add(0, (l.start + l.end) / 2, `chuyển cảnh${kind(l)}`);
    else add(1, l.start + SETTLED * (l.end - l.start), l.type ?? l.track);
  }
  const captions = plan.layers.filter(l => l.track === 'caption');
  const plated = captions.filter(l => l.props?.backdrop === 'plate');
  for (const l of [plated[0], plated.length > 1 ? plated[plated.length - 1] : undefined]) if (l) add(2, (l.start + l.end) / 2, 'caption nền mờ');
  for (let k = 0; k < CAPTION_SAMPLES && captions.length; k++) {
    const l = captions[Math.floor(((2 * k + 1) * captions.length) / (2 * CAPTION_SAMPLES))];
    add(3, (l.start + l.end) / 2, 'caption');
  }
  add(4, Math.min(EDGE_SEC, duration / 2), 'đầu video');
  add(4, Math.max(0, duration - END_MARGIN_SEC), 'cuối video');

  const chosen: PreviewFrame[] = [];
  for (const c of [...candidates].sort((a, b) => a.priority - b.priority || a.t - b.t)) {
    if (chosen.length >= max) break;
    if (chosen.some(x => Math.abs(x.t - c.t) < minGapSec)) continue;
    chosen.push({ t: c.t, label: c.label });
  }
  return chosen.sort((a, b) => a.t - b.t);
}
