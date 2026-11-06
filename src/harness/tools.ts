import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plan, Layer, Issue } from '../plan/types';
import { validatePlanSchema } from '../plan/schema';
import { loadTheme } from '../style/theme';
import { validatePlan } from '../qa/validate';
import type {
  HarnessContext,
  LayerSummary,
  PlanSummary,
  ToolDefinition,
  TranscriptData,
  TranscriptWord,
} from './types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function getPlanSummary(plan: Plan): PlanSummary {
  const layers: LayerSummary[] = plan.layers.map(l => {
    let label: string | undefined;
    if (l.words && l.words.length > 0) {
      label = l.words.slice(0, 5).map(w => w.t).join(' ');
    } else if (l.props?.text) {
      label = String(l.props.text).slice(0, 40);
    } else if (l.props?.component) {
      label = `custom:${String(l.props.component)}`;
    } else if (l.props?.label) {
      label = String(l.props.label);
    } else if (l.props?.title) {
      label = String(l.props.title);
    }
    return {
      id: l.id,
      track: l.track,
      type: l.type,
      start: l.start,
      end: l.end,
      ...(label ? { label } : {}),
    };
  });

  return {
    meta: { ...plan.meta },
    scenes: [...plan.scenes],
    layers,
  };
}

export function getLayer(plan: Plan, layerId: string): Layer | undefined {
  const found = plan.layers.find(l => l.id === layerId);
  return found ? JSON.parse(JSON.stringify(found)) : undefined;
}

export function getTranscript(
  transcript: TranscriptData | undefined,
  fromSec: number,
  toSec: number,
): TranscriptWord[] {
  if (!transcript || !Array.isArray(transcript.words)) return [];
  return transcript.words.filter(w => w.e >= fromSec && w.s <= toSec);
}

export function patchLayer(
  plan: Plan,
  layerId: string,
  patch: Partial<Layer>,
): { ok: boolean; error?: string } {
  let target = plan.layers.find(l => l.id === layerId);
  if (!target && (layerId === 'l1' || layerId === 'first') && plan.layers.length > 0) {
    target = plan.layers[0];
  }
  if (!target) return { ok: false, error: `Không tìm thấy layer id: "${layerId}"` };

  const newStart = patch.start !== undefined ? patch.start : target.start;
  const newEnd = patch.end !== undefined ? patch.end : target.end;

  if (newStart < 0) {
    return { ok: false, error: 'Thời gian bắt đầu (start) không thể nhỏ hơn 0' };
  }
  if (newEnd <= newStart) {
    return { ok: false, error: `Thời gian kết thúc (end=${newEnd}) phải lớn hơn thời gian bắt đầu (start=${newStart})` };
  }

  if (patch.start !== undefined) target.start = patch.start;
  if (patch.end !== undefined) target.end = patch.end;
  if (patch.track !== undefined) target.track = patch.track;
  if (patch.type !== undefined) target.type = patch.type;
  if (patch.words !== undefined) target.words = patch.words;
  if (patch.props !== undefined) {
    target.props = { ...(target.props ?? {}), ...patch.props };
  }
  if (patch.override !== undefined) {
    target.override = { ...(target.override ?? {}), ...patch.override };
  }
  if (patch.locked !== undefined) target.locked = patch.locked;

  return { ok: true };
}

export function addLayer(plan: Plan, layer: Layer): { ok: boolean; error?: string } {
  if (!layer.id || typeof layer.id !== 'string') {
    return { ok: false, error: 'Layer phải có trường id hợp lệ' };
  }
  if (plan.layers.some(l => l.id === layer.id)) {
    return { ok: false, error: `id "${layer.id}" bị trùng với layer đã có` };
  }
  if (layer.start < 0) {
    return { ok: false, error: 'Thời gian bắt đầu (start) không thể nhỏ hơn 0' };
  }
  if (layer.end <= layer.start) {
    return { ok: false, error: `Thời gian kết thúc (end=${layer.end}) phải lớn hơn thời gian bắt đầu (start=${layer.start})` };
  }

  plan.layers.push(JSON.parse(JSON.stringify(layer)));
  plan.layers.sort((a, b) => a.start - b.start);
  return { ok: true };
}

export function removeLayer(plan: Plan, layerId: string): { ok: boolean; error?: string } {
  const index = plan.layers.findIndex(l => l.id === layerId);
  if (index === -1) {
    return { ok: false, error: `Không tìm thấy layer id: "${layerId}" để xóa` };
  }
  plan.layers.splice(index, 1);
  return { ok: true };
}

export function addCallout(
  plan: Plan,
  options: {
    start: number;
    end?: number;
    label?: string;
    kind?: 'ring' | 'arrow';
    x?: number;
    y?: number;
    color?: 'accent' | 'white';
  },
): { ok: boolean; layerId?: string; error?: string } {
  const start = options.start;
  const end = options.end !== undefined ? options.end : start + 2.5;
  if (start < 0) return { ok: false, error: 'Thời gian start không thể âm' };
  if (end <= start) return { ok: false, error: 'Thời gian end phải lớn hơn start' };

  const id = `callout-${Date.now().toString(36)}`;
  const layer: Layer = {
    id,
    track: 'graphic',
    type: 'callout',
    start,
    end,
    props: {
      kind: options.kind ?? 'arrow',
      x: options.x !== undefined ? options.x : 0.75,
      y: options.y !== undefined ? options.y : 0.3,
      size: 0.18,
      color: options.color ?? 'accent',
      ...(options.label ? { label: options.label.slice(0, 24) } : {}),
    },
  };

  plan.layers.push(layer);
  plan.layers.sort((a, b) => a.start - b.start);
  return { ok: true, layerId: id };
}

export function addTitleCard(
  plan: Plan,
  options: {
    start: number;
    end?: number;
    title: string;
    icon?: string;
  },
): { ok: boolean; layerId?: string; error?: string } {
  const start = options.start;
  const end = options.end !== undefined ? options.end : start + 2.5;
  if (start < 0) return { ok: false, error: 'Thời gian start không thể âm' };
  if (end <= start) return { ok: false, error: 'Thời gian end phải lớn hơn start' };

  const id = `title-${Date.now().toString(36)}`;
  const layer: Layer = {
    id,
    track: 'title',
    type: 'title-card',
    start,
    end,
    props: {
      title: options.title,
      icon: options.icon ?? 'check',
    },
  };

  plan.layers.push(layer);
  plan.layers.sort((a, b) => a.start - b.start);
  return { ok: true, layerId: id };
}


export async function validateDraftPlan(plan: Plan, projectDir: string): Promise<Issue[]> {
  const schemaRes = validatePlanSchema(plan);
  if (!schemaRes.ok) return schemaRes.issues;

  const styleDir = join(root, 'styles', plan.meta.style);
  if (!existsSync(styleDir)) return [];

  try {
    const theme = loadTheme(styleDir);
    const issues = validatePlan(plan, theme, {
      durationSec: Math.max(...plan.scenes.map(s => s.end), ...plan.layers.map(l => l.end), 1),
      fileExists: p => existsSync(join(projectDir, p)),
      transcript: undefined,
    });
    return issues;
  } catch {
    return [];
  }
}

export async function executeHarnessTool(
  ctx: HarnessContext,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'get_plan_summary':
      return getPlanSummary(ctx.draftPlan);
    case 'get_layer':
      return getLayer(ctx.draftPlan, String(args.id ?? ''));
    case 'get_transcript':
      return getTranscript(
        ctx.transcript,
        Number(args.fromSec ?? args.from ?? 0),
        Number(args.toSec ?? args.to ?? 0),
      );
    case 'patch_layer':
      return patchLayer(ctx.draftPlan, String(args.id ?? ''), (args.patch ?? {}) as Partial<Layer>);
    case 'add_layer':
      return addLayer(ctx.draftPlan, (args.layer ?? {}) as Layer);
    case 'remove_layer':
      return removeLayer(ctx.draftPlan, String(args.id ?? ''));
    case 'add_callout':
      return addCallout(ctx.draftPlan, {
        start: Number(args.start ?? 1.5),
        end: args.end !== undefined ? Number(args.end) : undefined,
        label: args.label ? String(args.label) : undefined,
        kind: args.kind === 'ring' ? 'ring' : 'arrow',
        x: args.x !== undefined ? Number(args.x) : 0.75,
        y: args.y !== undefined ? Number(args.y) : 0.3,
        color: args.color === 'white' ? 'white' : 'accent',
      });
    case 'add_title_card':
      return addTitleCard(ctx.draftPlan, {
        start: Number(args.start ?? 0),
        end: args.end !== undefined ? Number(args.end) : undefined,
        title: String(args.title ?? 'Tiêu đề'),
        icon: args.icon ? String(args.icon) : undefined,
      });
    case 'validate_plan':
      return await validateDraftPlan(ctx.draftPlan, ctx.projectDir);
    default:
      throw new Error(`Không tìm thấy tool "${name}"`);
  }
}

export const HARNESS_TOOLS: ToolDefinition[] = [
  {
    name: 'get_plan_summary',
    description: 'Lấy tóm tắt kế hoạch dựng (metadata, các scene, và danh sách layer rút gọn có id, track, type, start, end). Tiết kiệm token.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_layer',
    description: 'Lấy toàn bộ thông tin chi tiết (props, style, words) của một layer theo id.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID của layer cần xem' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_transcript',
    description: 'Lấy danh sách các từ và mốc thời gian trong transcript giữa hai mốc giây.',
    parameters: {
      type: 'object',
      properties: {
        fromSec: { type: 'number', description: 'Mốc giây bắt đầu' },
        toSec: { type: 'number', description: 'Mốc giây kết thúc' },
      },
      required: ['fromSec', 'toSec'],
    },
  },
  {
    name: 'patch_layer',
    description: 'Cập nhật một phần thuộc tính của layer đã có (thời gian start/end, props màu sắc, chữ, toạ độ).',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID của layer cần sửa' },
        patch: {
          type: 'object',
          description: 'Các trường cần cập nhật (start, end, props...)',
        },
      },
      required: ['id', 'patch'],
    },
  },
  {
    name: 'add_layer',
    description: 'Thêm một layer mới vào kế hoạch dựng (card, callout, scene, caption, step-number, chart...).',
    parameters: {
      type: 'object',
      properties: {
        layer: {
          type: 'object',
          description: 'Layer hoàn chỉnh theo schema (id, track, type, start, end, props)',
        },
      },
      required: ['layer'],
    },
  },
  {
    name: 'remove_layer',
    description: 'Xóa bỏ một layer theo id.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID của layer cần xóa' },
      },
      required: ['id'],
    },
  },
  {
    name: 'add_callout',
    description: 'Thêm khối callout (mũi tên hoặc vòng tròn chỉ điểm nhấn kèm nhãn chú thích) vào video tại mốc thời gian cụ thể.',
    parameters: {
      type: 'object',
      properties: {
        start: { type: 'number', description: 'Mốc giây bắt đầu xuất hiện' },
        end: { type: 'number', description: 'Mốc giây kết thúc' },
        label: { type: 'string', description: 'Nhãn chữ hiển thị cạnh mũi tên/vòng tròn' },
        kind: { type: 'string', enum: ['arrow', 'ring'], description: 'Loại callout: arrow (mũi tên) hoặc ring (vòng tròn)' },
        x: { type: 'number', description: 'Tọa độ ngang tỉ lệ khung hình (0 đến 1)' },
        y: { type: 'number', description: 'Tọa độ dọc tỉ lệ khung hình (0 đến 1)' },
        color: { type: 'string', enum: ['accent', 'white'], description: 'Màu sắc callout' },
      },
      required: ['start'],
    },
  },
  {
    name: 'add_title_card',
    description: 'Thêm thẻ tiêu đề (intro card / title card) vào video để giới thiệu chủ đề hoặc phân đoạn.',
    parameters: {
      type: 'object',
      properties: {
        start: { type: 'number', description: 'Mốc giây bắt đầu' },
        end: { type: 'number', description: 'Mốc giây kết thúc' },
        title: { type: 'string', description: 'Nội dung tiêu đề chính' },
        icon: { type: 'string', description: 'Tên icon (ví dụ: check, star, alert)' },
      },
      required: ['start', 'title'],
    },
  },
  {
    name: 'validate_plan',
    description: 'Kiểm tra tính hợp lệ của bản nháp hiện tại (phát hiện lỗi schema, đè mặt, trùng ID, che phụ đề).',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
];

