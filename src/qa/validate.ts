import type { Issue, Plan } from '../plan/types';
import type { Theme } from '../style/theme';
import { validatePlanSchema } from '../plan/schema';
import { normalizeWord } from './text';

export interface Ctx {
  durationSec: number;
  fileExists: (path: string) => boolean;
  transcript?: { words: { t: string; s: number; e: number }[] };
}

const DRIFT_SEC = 0.3;

export function validatePlan(plan: Plan, theme: Theme, ctx: Ctx): Issue[] {
  const schema = validatePlanSchema(plan);
  if (!schema.ok) return schema.issues;

  const issues: Issue[] = [];
  const err = (code: string, message: string, layerId?: string) => issues.push({ severity: 'error', code, message, layerId });
  const warn = (code: string, message: string, layerId?: string) => issues.push({ severity: 'warning', code, message, layerId });

  for (const l of plan.layers) {
    if (l.end > ctx.durationSec) err('out-of-bounds', `${l.id} kết thúc ${l.end}s, video chỉ dài ${ctx.durationSec}s`, l.id);
    if (l.track === 'footage') {
      const src = l.props?.src;
      if (typeof src !== 'string' || !ctx.fileExists(src)) err('missing-file', `${l.id}: không tìm thấy footage ${String(src)}`, l.id);
    }
  }
  for (const s of plan.scenes) {
    if (s.end > ctx.durationSec) err('out-of-bounds', `cảnh ${s.id} vượt quá độ dài video`);
    if (s.end - s.start < theme.limits.minSceneSec) warn('scene-too-short', `cảnh ${s.id} ngắn hơn ${theme.limits.minSceneSec}s`);
  }

  const byTrack = new Map<string, typeof plan.layers>();
  for (const l of plan.layers) byTrack.set(l.track, [...(byTrack.get(l.track) ?? []), l]);
  for (const layers of byTrack.values()) {
    const sorted = [...layers].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start < sorted[i - 1].end) err('track-overlap', `${sorted[i - 1].id} và ${sorted[i].id} chồng thời gian`, sorted[i].id);
    }
  }

  const { width } = plan.meta;
  const { safeZone, maxCaptionWords } = theme.limits;
  const usable = width * (1 - safeZone.left - safeZone.right);
  for (const l of plan.layers.filter(x => x.track === 'caption' && x.words)) {
    const words = l.words!;
    if (words.length > maxCaptionWords) warn('caption-too-long', `${l.id}: ${words.length} từ, tối đa ${maxCaptionWords}`, l.id);
    const chars = words.map(w => w.t).join(' ').length;
    if (chars * theme.captionSize * 0.55 > usable) warn('text-overflow', `${l.id}: chữ có thể tràn khỏi vùng an toàn`, l.id);
    if (ctx.transcript) {
      const drift = words.find(w => !ctx.transcript!.words.some(
        tw => normalizeWord(tw.t) === normalizeWord(w.t) && Math.abs(tw.s - w.s) <= DRIFT_SEC));
      if (drift) warn('caption-sync-drift', `${l.id}: từ "${drift.t}" lệch lời đã chép`, l.id);
    }
  }
  return issues;
}
