import type { Issue, Plan } from '../plan/types';
import type { Theme } from '../style/theme';
import { validatePlanSchema } from '../plan/schema';
import { captionPropsProblem, resolveCaptionProps } from '../plan/captionProps';
import { LAYER_TYPES } from '../plan/layerTypes';
import { normalizeWord } from './text';

export interface Ctx {
  durationSec: number;
  fileExists: (path: string) => boolean;
  transcript?: { words: { t: string; s: number; e: number }[] };
}

const DRIFT_SEC = 0.3;
const MAX_BIG_WORDS = 3;

export function validatePlan(plan: Plan, theme: Theme, ctx: Ctx): Issue[] {
  const schema = validatePlanSchema(plan);
  if (!schema.ok) return schema.issues;

  const issues: Issue[] = [];
  const err = (code: string, message: string, layerId?: string) => issues.push({ severity: 'error', code, message, layerId });
  const warn = (code: string, message: string, layerId?: string) => issues.push({ severity: 'warning', code, message, layerId });

  const seen = new Set<string>();
  for (const l of plan.layers) {
    if (seen.has(l.id)) err('duplicate-id', `id ${l.id} bị trùng`, l.id);
    seen.add(l.id);
    if (l.track === 'caption') {
      if (l.type) err('unknown-layer-type', `${l.id}: layer caption không có type (đang là "${l.type}")`, l.id);
      const bad = captionPropsProblem(l.props);
      if (bad) err('invalid-props', `${l.id}: ${bad}`, l.id);
    } else {
      const spec = l.type ? LAYER_TYPES[l.type] : undefined;
      if (!spec || spec.track !== l.track) {
        err('unknown-layer-type', `${l.id}: type "${l.type ?? '(trống)'}" không hợp lệ cho track ${l.track}`, l.id);
      } else {
        const problem = spec.check(l.props ?? {});
        if (problem) err('invalid-props', `${l.id}: ${problem}`, l.id);
      }
    }
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
    const resolved = resolveCaptionProps(l.props, theme); // bad values were reported above; here they just fall back
    const big = resolved.variant === 'big';
    const maxWords = big ? MAX_BIG_WORDS : maxCaptionWords;
    if (words.length > maxWords) warn('caption-too-long', `${l.id}: ${words.length} từ, tối đa ${maxWords}`, l.id);
    if (resolved.position === 'top' && plan.layers.some(c => (c.type === 'title-card' || c.type === 'chip-stack') && c.start < l.end && l.start < c.end))
      warn('caption-overlaps-card', `${l.id}: caption ở trên trùng thời gian với một thẻ ở phía trên`, l.id);
    const size = big ? theme.captionSize * theme.captionBigScale : theme.captionSize;
    // captions wrap at spaces, so only the longest unbreakable word can spill out of the safe zone
    const longest = Math.max(0, ...words.map(w => w.t.length));
    if (longest * size * 0.55 > usable) warn('text-overflow', `${l.id}: chữ có thể tràn khỏi vùng an toàn`, l.id);
    if (ctx.transcript) {
      const drift = words.find(w => !ctx.transcript!.words.some(
        tw => normalizeWord(tw.t) === normalizeWord(w.t) && Math.abs(tw.s - w.s) <= DRIFT_SEC));
      if (drift) warn('caption-sync-drift', `${l.id}: từ "${drift.t}" lệch lời đã chép`, l.id);
    }
  }
  return issues;
}
