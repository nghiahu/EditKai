import type { Issue, Layer, Plan } from '../plan/types';
import type { Theme } from '../style/theme';
import { validatePlanSchema } from '../plan/schema';
import { typingDoneFrame, strikeDoneFrame } from '../../remotion/promptTyping';
import { captionPropsProblem, resolveCaptionProps } from '../plan/captionProps';
import { INSERT_POSITIONS, resolveFootageProps, type InsertPosition } from '../plan/insertProps';
import { captionRegion } from '../plan/captionRegion';
import { FOOTPRINT_TYPES, insertFootprint } from '../plan/insertFootprint';
import { bestPosition, CAPTION_OVERLAP_LIMIT, OVERLAP_LIMIT } from '../director/faceAvoid';
import { faceRegion, overlapShare, type Faces } from '../media/faces';
import { unresolvedAnchors } from '../plan/sceneAnchors';
import { SCENE_ANCHORS, sceneBox, sceneImages, type SceneProps } from '../plan/scene';
import { customBox, type CustomProps } from '../plan/custom';
import { scanCustomSource } from './customScan';
import { resolveCallout, resolveLogoBadge, resolvePromptBox, resolveStatCard } from '../plan/insertTypes';
import { LAYER_TYPES } from '../plan/layerTypes';
import { normalizeWord } from './text';

export interface Ctx {
  durationSec: number;
  fileExists: (path: string) => boolean;
  transcript?: { words: { t: string; s: number; e: number }[] };
  assets?: { file: string; durationSec?: number }[];
  /** Share (0-1) of each caption layer's text width that sits on a near-white picture, by layer id; absent when the picture was not measured. */
  captionBright?: Map<string, number>;
  /** The speaker's face over time, already in frame coordinates (`mapFacesToFrame`); absent when it was not measured. */
  faces?: Faces;
  /** The source text of a project component (`components/<name>.tsx`), undefined when the file is missing; absent when components are not checked. */
  customSource?: (name: string) => string | undefined;
}

const DRIFT_SEC = 0.3;
const MAX_BIG_WORDS = 3;
const MAX_GAP_WARNINGS = 5;
export const BRIGHT_SHARE = 0.15; // more of the text than this on a near-white picture: white text needs yellow ink or a plate behind it
const INSERT_TRACKS = ['title', 'graphic', 'footage'];

/** Where an insert layer sits on screen, for the caption overlap check. */
function insertPosition(l: Layer): string | undefined {
  if (l.type === 'title-card' || l.type === 'chip-stack') return 'top';
  if (l.type === 'prompt-box') return resolvePromptBox(l.props).position;
  if (l.type === 'stat-card') return resolveStatCard(l.props).position;
  if (l.type === 'logo-badge') return resolveLogoBadge(l.props).position;
  return undefined;
}

/** The box a scene or custom layer declares (shares of the frame), with what to call it in messages; undefined for other layers or a custom layer without w and h. */
function declaredBox(l: Layer, theme: Theme): { box: { x: number; y: number; w: number; h: number }; kind: 'scene' | 'custom'; label: string } | undefined {
  const sz = theme.limits.safeZone;
  if (l.type === 'scene' && l.props && typeof l.props.w === 'number' && typeof l.props.h === 'number') return { box: sceneBox(l.props as unknown as SceneProps, sz), kind: 'scene', label: 'hộp cảnh' };
  if (l.type === 'custom' && l.props) { const box = customBox(l.props as unknown as CustomProps, sz); if (box) return { box, kind: 'custom', label: 'hộp thành phần' }; }
  return undefined;
}

export function validatePlan(plan: Plan, theme: Theme, ctx: Ctx): Issue[] {
  const schema = validatePlanSchema(plan);
  if (!schema.ok) return schema.issues;

  const issues: Issue[] = [];
  const err = (code: string, message: string, layerId?: string) => issues.push({ severity: 'error', code, message, layerId });
  const warn = (code: string, message: string, layerId?: string) => issues.push({ severity: 'warning', code, message, layerId });

  const assets = (ctx.assets ?? []).filter(a => a && typeof a.file === 'string'); // a hand-edited manifest may hold junk
  for (const a of assets) {
    if (!ctx.fileExists(a.file)) warn('asset-missing', `assets.json liệt kê ${a.file} nhưng file không tồn tại`);
  }

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
    if (l.type === 'prompt-box') {
      const pb = resolvePromptBox(l.props);
      const need = pb.strike ? strikeDoneFrame(pb.text, plan.meta.fps) : typingDoneFrame(pb.text, plan.meta.fps);
      if (pb.text.length > 0 && need > Math.round((l.end - l.start) * plan.meta.fps))
        warn('prompt-too-long', `${l.id}: cần ${(need / plan.meta.fps).toFixed(1)}s để gõ${pb.strike ? ' và gạch' : ''} chữ nhưng layer chỉ dài ${(l.end - l.start).toFixed(1)}s`, l.id);
    }
    if (l.end > ctx.durationSec) err('out-of-bounds', `${l.id} kết thúc ${l.end}s, video chỉ dài ${ctx.durationSec}s`, l.id);
    if (l.track === 'footage') {
      const src = l.props?.src;
      if (typeof src !== 'string' || !ctx.fileExists(src)) err('missing-file', `${l.id}: không tìm thấy footage ${String(src)}`, l.id);
      // OffthreadVideo freezes on the last frame when the layer plays past the end of the clip
      const clip = typeof src === 'string' ? assets.find(a => a.file === src)?.durationSec : undefined;
      if (typeof clip === 'number' && resolveFootageProps(l.props).from + (l.end - l.start) > clip + 0.1)
        warn('footage-overrun', `${l.id}: from + độ dài layer vượt quá clip ${src} (${clip}s), hình sẽ đứng ở khung cuối`, l.id);
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
    const overlapsAt = (where: string, types?: string[]) =>
      plan.layers.some(c => c.track !== 'caption' && (!types || (c.type && types.includes(c.type))) && insertPosition(c) === where && c.start < l.end && l.start < c.end);
    if ((resolved.position === 'top' && overlapsAt('top')) || (big && resolved.position === 'center' && overlapsAt('center', ['stat-card', 'logo-badge'])))
      warn('caption-overlaps-card', `${l.id}: caption trùng thời gian với một thẻ ở cùng vị trí`, l.id);
    const size = big ? theme.captionSize * theme.captionBigScale : theme.captionSize;
    // captions wrap at spaces, so only the longest unbreakable word can spill out of the safe zone
    const longest = Math.max(0, ...words.map(w => w.t.length));
    if (longest * size * 0.55 > usable) warn('text-overflow', `${l.id}: chữ có thể tràn khỏi vùng an toàn`, l.id);
    const bg = ctx.captionBright?.get(l.id);
    if (bg !== undefined && bg > BRIGHT_SHARE && resolved.backdrop !== 'plate' && resolved.ink !== 'accent')
      warn('caption-low-contrast', `${l.id}: ${Math.round(bg * 100)}% chiều ngang chữ nằm trên nền gần trắng, chữ trắng khó đọc; đặt props.ink "accent" (chữ vàng) hoặc props.backdrop "plate"`, l.id);
    if (ctx.transcript) {
      const drift = words.find(w => !ctx.transcript!.words.some(
        tw => normalizeWord(tw.t) === normalizeWord(w.t) && Math.abs(tw.s - w.s) <= DRIFT_SEC));
      if (drift) warn('caption-sync-drift', `${l.id}: từ "${drift.t}" lệch lời đã chép`, l.id);
    }
  }

  // a scene or custom box over the captions that are up at the same time (the caption text is centred and takes the middle of its band)
  for (const l of plan.layers) {
    const declared = declaredBox(l, theme);
    if (!declared) continue;
    const box = declared.box;
    const hit = plan.layers.find(c => {
      if (c.track !== 'caption' || !(c.start < l.end && l.start < c.end)) return false;
      const band = captionRegion(resolveCaptionProps(c.props, theme).position, theme);
      const text = { ...band, x: band.x + band.w * 0.2, w: band.w * 0.6 };
      return overlapShare(text, box) > 0.1;
    });
    if (hit) warn(`${declared.kind}-overlaps-caption`, `${l.id}: ${declared.label} nằm đè lên phụ đề ${hit.id} cùng lúc; đổi props.offset (ví dụ y âm để nhấc lên) hoặc thu nhỏ props.h`, l.id);
  }

  // a scene's times must be seconds by now (compose turns spoken words into seconds)
  for (const l of plan.layers) if (l.type === 'scene' && l.props) {
    const open = unresolvedAnchors(l.props);
    for (const src of sceneImages(l.props)) if (!ctx.fileExists(src)) err('missing-file', `${l.id}: không tìm thấy ảnh ${src} của cảnh`, l.id);
    if (open.length) err('scene-unresolved-anchor', `${l.id}: mốc theo từ chưa đổi thành giây (${open.join(', ')}); chạy lại compose, hoặc sửa chỉ số từ`, l.id);
  }

  // a project component must exist and pass the static scan (once per component)
  if (ctx.customSource) {
    const checked = new Set<string>();
    for (const l of plan.layers) {
      const name = l.type === 'custom' ? l.props?.component : undefined;
      if (typeof name !== 'string' || checked.has(name)) continue;
      checked.add(name);
      const source = ctx.customSource(name);
      if (source === undefined) { err('custom-missing', `${l.id}: không có file components/${name}.tsx trong dự án`, l.id); continue; }
      for (const p of scanCustomSource(source)) err(p.code, `${l.id}: components/${name}.tsx: ${p.message}`, l.id);
    }
  }

  // a chart shows numbers: say where they come from
  for (const l of plan.layers) if (l.type === 'chart' && !(typeof l.props?.source === 'string' && l.props.source.length > 0)) warn('chart-no-source', `${l.id}: biểu đồ chưa có props.source (nguồn của số liệu)`, l.id);

  // graphics and captions over the speaker's face
  if (ctx.faces) {
    for (const l of plan.layers) {
      const face = faceRegion(ctx.faces, l.start, l.end, 0);
      if (!face) continue;
      if (l.track === 'caption') {
        const share = overlapShare(face, captionRegion(resolveCaptionProps(l.props, theme).position, theme));
        if (share > CAPTION_OVERLAP_LIMIT) warn('caption-on-face', `${l.id}: phụ đề che ${Math.round(share * 100)}% mặt người nói; đổi props.position`, l.id);
      } else if (declaredBox(l, theme)) {
        const declared = declaredBox(l, theme)!;
        const share = overlapShare(face, declared.box);
        if (share > OVERLAP_LIMIT) {
          const clear = SCENE_ANCHORS.filter(a => overlapShare(face, declaredBox({ ...l, props: { ...l.props, anchor: a } } as Layer, theme)!.box) <= OVERLAP_LIMIT);
          warn(`${declared.kind}-on-face`, `${l.id}: ${declared.label} che ${Math.round(share * 100)}% mặt người nói; ${clear.length ? `thử props.anchor "${clear[0]}"` : 'thu nhỏ props.w, props.h hoặc đổi anchor'}`, l.id);
        }
      } else if (l.type === 'callout') {
        const c = resolveCallout(l.props);
        if (c.x >= face.x && c.x <= face.x + face.w && c.y >= face.y && c.y <= face.y + face.h) warn('callout-on-face', `${l.id}: điểm chỉ nằm trên mặt người nói; kiểm tra props.x, props.y`, l.id);
      } else if (l.type && (FOOTPRINT_TYPES as readonly string[]).includes(l.type)) {
        const at = (p: InsertPosition) => overlapShare(face, insertFootprint(l.type!, l.props, p, theme, plan.meta.width, plan.meta.height)!);
        const current = INSERT_POSITIONS.find(p => p === l.props?.position) ?? 'center';
        if (at(current) > OVERLAP_LIMIT) {
          const best = bestPosition(l.type, l.props, face, theme, plan.meta.width, plan.meta.height);
          warn('insert-on-face', `${l.id}: che ${Math.round(at(current) * 100)}% mặt người nói; ${best === current ? 'không vị trí nào tránh được' : `thử props.position "${best}"`}`, l.id);
        }
      }
    }
  }

  // density: stretches of video with nothing but the talking head
  const spans = plan.layers.filter(l => INSERT_TRACKS.includes(l.track) && l.type !== 'transition').map(l => [l.start, l.end] as const).sort((a, b) => a[0] - b[0]);
  const gapList: [number, number][] = [];
  let cursor = 0;
  for (const [s, e] of spans) {
    if (s > cursor) gapList.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (ctx.durationSec > cursor) gapList.push([cursor, ctx.durationSec]);
  const tooLong = gapList.filter(([a, b]) => b - a > theme.director.insertGapMaxSec);
  for (const [a, b] of tooLong.slice(0, MAX_GAP_WARNINGS))
    warn('insert-gap', `không có insert nào từ ${a.toFixed(1)}s đến ${b.toFixed(1)}s (${(b - a).toFixed(1)}s, tối đa ${theme.director.insertGapMaxSec}s)`);
  if (tooLong.length > MAX_GAP_WARNINGS) warn('insert-gap', `và ${tooLong.length - MAX_GAP_WARNINGS} khoảng trống khác`);

  const usedSrc = new Set(plan.layers.filter(l => l.type === 'footage' || l.type === 'logo-badge').map(l => l.props?.src));
  for (const a of assets) if (!usedSrc.has(a.file)) warn('asset-unused', `${a.file} có trong assets.json nhưng chưa layer nào dùng`);
  return issues;
}
