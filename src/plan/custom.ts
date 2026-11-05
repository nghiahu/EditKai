import { SCENE_ANCHORS, sceneBox, type SceneProps } from './scene';

export const MAX_DATA_BYTES = 8 * 1024;
export const MAX_NAME_LENGTH = 40;
export const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface CustomProps { component: string; data?: Record<string, unknown>; anchor?: SceneProps['anchor']; w?: number; h?: number; offset?: SceneProps['offset'] }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const sizeOk = (v: unknown) => isNum(v) && v >= 0.05 && v <= 1;

/** Why the props of a `custom` layer are invalid (Vietnamese message that starts with the path, e.g. `props.data`), or undefined. */
export function customProblem(props: Record<string, unknown>): string | undefined {
  const c = props.component;
  if (typeof c !== 'string' || c.length > MAX_NAME_LENGTH || !NAME_RE.test(c)) return `props.component: bắt buộc, tên thành phần gồm chữ thường a-z, số và dấu gạch nối đơn, tối đa ${MAX_NAME_LENGTH} ký tự`;
  if (props.data !== undefined) {
    if (!isObj(props.data)) return 'props.data: phải là một đối tượng JSON';
    if (JSON.stringify(props.data).length > MAX_DATA_BYTES) return 'props.data: quá lớn, tối đa 8 KB';
  }
  if (props.anchor !== undefined && !(SCENE_ANCHORS as readonly unknown[]).includes(props.anchor)) return `props.anchor: phải là một trong: ${SCENE_ANCHORS.join(', ')}`;
  if (props.offset !== undefined) {
    if (!isObj(props.offset)) return 'props.offset: phải là { x?, y? } (tỉ lệ khung, từ -0,5 đến 0,5)';
    for (const k of ['x', 'y']) { const v = props.offset[k]; if (v !== undefined && !(isNum(v) && Math.abs(v) <= 0.5)) return `props.offset.${k}: phải là số từ -0,5 đến 0,5 (tỉ lệ khung)`; }
  }
  for (const [k, other] of [['w', 'h'], ['h', 'w']] as const) {
    if (props[k] !== undefined && !sizeOk(props[k])) return `props.${k}: số từ 0,05 đến 1 (tỉ lệ khung)`;
    if (props[k] !== undefined && props[other] === undefined) return `props.${other}: phải có cùng với props.${k} (để kiểm né mặt và phụ đề)`;
  }
  return undefined;
}

/** The box a custom layer declares (shares of the frame, like a scene), or undefined when it gives no w and h. */
export function customBox(props: Partial<CustomProps>, safeZone: { top: number; bottom: number; left: number; right: number }): { x: number; y: number; w: number; h: number } | undefined {
  if (props.w === undefined || props.h === undefined) return undefined;
  return sceneBox({ anchor: props.anchor, w: props.w, h: props.h, offset: props.offset }, safeZone);
}
