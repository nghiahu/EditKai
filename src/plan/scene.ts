// Browser-safe (no node imports): the `scene` layer, a free composition of a few basic blocks with their own animation.

export const SCENE_ANCHORS = ['top', 'center', 'bottom', 'left', 'right'] as const;
export const LEAF_KINDS = ['box', 'text', 'icon', 'image', 'line'] as const;
export const CONTAINER_KINDS = ['row', 'column', 'grid', 'stack'] as const;
export const NODE_KINDS = [...LEAF_KINDS, ...CONTAINER_KINDS] as const;
export const COLOR_TOKENS = ['accent', 'white', 'ink', 'panel', 'dim'] as const;
export const EASES = ['linear', 'out', 'inOut', 'spring'] as const;
export const ENTER_KINDS = ['fade', 'rise', 'pop', 'slide-left', 'slide-right', 'draw'] as const;
/** Numbers that can be animated, and colours that can be animated. `progress` is how much of a line is drawn (0-1). */
export const NUMBER_PROPS = ['opacity', 'scale', 'x', 'y', 'rotate', 'strokeWidth', 'progress'] as const;
export const COLOR_PROPS = ['fill', 'stroke', 'color'] as const;
export const MAX_NODES = 40;
export const MAX_DEPTH = 4;

export type Ease = (typeof EASES)[number];
/** Seconds from the start of the scene, or a spoken word: `compose` turns the second form into seconds from `transcript.json`. */
export type Anchor = number | { word: number; offset?: number; edge?: 'start' | 'end' };
export interface Keyframe { at: Anchor; v: number | string; ease?: Ease }
export type Keys = Partial<Record<(typeof NUMBER_PROPS)[number] | (typeof COLOR_PROPS)[number], Keyframe[]>>;
export interface Enter { kind: (typeof ENTER_KINDS)[number]; at?: Anchor; duration?: number }
export interface Highlight { at: Anchor; until: Anchor; to: Partial<Record<(typeof NUMBER_PROPS)[number] | (typeof COLOR_PROPS)[number], number | string>> }

export interface SceneNode {
  id: string;
  kind: (typeof NODE_KINDS)[number];
  children?: SceneNode[];
  // layout and style (numbers are pixels of a 1080-wide canvas, scaled to the frame when drawn)
  w?: number; h?: number; padding?: number; gap?: number; radius?: number; align?: 'start' | 'center' | 'end';
  fill?: string; stroke?: string; strokeWidth?: number; shadow?: boolean;
  opacity?: number; scale?: number; x?: number; y?: number; rotate?: number;
  // text, icon, image, line, grid
  text?: string; size?: number; weight?: number; color?: string; italic?: boolean;
  name?: string; src?: string; points?: [number, number][]; cols?: number;
  // animation
  keys?: Keys; enter?: Enter; exit?: boolean | { at?: Anchor }; highlight?: Highlight | Highlight[]; stagger?: number;
}

export interface SceneProps { anchor?: (typeof SCENE_ANCHORS)[number]; w: number; h: number; root: SceneNode }

class Bad extends Error {}
const bad = (path: string, msg: string): never => { throw new Bad(`${path}: ${msg}`); };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const inList = (v: unknown, list: readonly string[]) => typeof v === 'string' && list.includes(v);
const isColor = (v: unknown) => typeof v === 'string' && (COLOR_TOKENS.includes(v as never) || /^#[0-9a-fA-F]{6}$/.test(v));

function checkAnchor(v: unknown, path: string): void {
  if (isNum(v)) { if (v < 0) bad(path, 'giây phải từ 0 trở lên'); return; }
  if (isObj(v) && Number.isInteger(v.word) && (v.word as number) >= 0 && (v.offset === undefined || isNum(v.offset)) && (v.edge === undefined || v.edge === 'start' || v.edge === 'end')) return;
  bad(path, 'phải là số giây (từ 0) hoặc { word: chỉ số từ, offset?: giây, edge?: "start" | "end" }');
}

const NUMERIC_RANGE: Record<string, [number, number]> = {
  opacity: [0, 1], scale: [0.05, 5], x: [-3000, 3000], y: [-3000, 3000], rotate: [-720, 720], strokeWidth: [0, 60], progress: [0, 1],
  w: [0, 3000], h: [0, 3000], padding: [0, 300], gap: [0, 300], radius: [0, 500], size: [8, 600], weight: [100, 900],
};

function checkNumber(v: unknown, key: string, path: string): void {
  const [lo, hi] = NUMERIC_RANGE[key] ?? [-Infinity, Infinity];
  if (!isNum(v) || v < lo || v > hi) bad(path, `phải là số từ ${lo} đến ${hi}`);
}

function checkValue(prop: string, v: unknown, path: string): void {
  if ((COLOR_PROPS as readonly string[]).includes(prop)) { if (!isColor(v)) bad(path, `phải là màu: ${COLOR_TOKENS.join(', ')} hoặc #rrggbb`); }
  else checkNumber(v, prop, path);
}

function checkKeys(keys: unknown, path: string): void {
  if (!isObj(keys)) return bad(path, 'phải là một đối tượng { thuộc tính: [keyframe...] }');
  for (const [prop, list] of Object.entries(keys)) {
    const p = `${path}.${prop}`;
    if (!(NUMBER_PROPS as readonly string[]).includes(prop) && !(COLOR_PROPS as readonly string[]).includes(prop)) bad(p, `thuộc tính không hoạt cảnh được; chọn trong: ${[...NUMBER_PROPS, ...COLOR_PROPS].join(', ')}`);
    if (!Array.isArray(list) || list.length < 2 || list.length > 12) bad(p, 'phải là mảng từ 2 đến 12 keyframe');
    let last = -Infinity;
    (list as unknown[]).forEach((k, i) => {
      const kp = `${p}[${i}]`;
      if (!isObj(k)) return bad(kp, 'phải là { at, v, ease? }');
      checkAnchor(k.at, `${kp}.at`);
      checkValue(prop, k.v, `${kp}.v`);
      if (k.ease !== undefined && !inList(k.ease, EASES)) bad(`${kp}.ease`, `phải là một trong: ${EASES.join(', ')}`);
      if (typeof k.at === 'number') { if (k.at < last) bad(`${kp}.at`, 'phải không nhỏ hơn mốc trước'); last = k.at; }
    });
  }
}

function checkPresets(n: Record<string, unknown>, path: string): void {
  if (n.keys !== undefined) checkKeys(n.keys, `${path}.keys`);
  if (n.enter !== undefined) {
    const e = n.enter;
    if (!isObj(e) || !inList(e.kind, ENTER_KINDS)) bad(`${path}.enter.kind`, `phải là một trong: ${ENTER_KINDS.join(', ')}`);
    const en = e as Record<string, unknown>;
    if (en.at !== undefined) checkAnchor(en.at, `${path}.enter.at`);
    if (en.duration !== undefined && !(isNum(en.duration) && en.duration >= 0.05 && en.duration <= 3)) bad(`${path}.enter.duration`, 'phải là số giây từ 0,05 đến 3');
  }
  if (n.exit !== undefined && typeof n.exit !== 'boolean') {
    if (!isObj(n.exit)) bad(`${path}.exit`, 'phải là true, false hoặc { at }');
    else if ((n.exit as Record<string, unknown>).at !== undefined) checkAnchor((n.exit as Record<string, unknown>).at, `${path}.exit.at`);
  }
  if (n.highlight !== undefined) {
    const list = Array.isArray(n.highlight) ? n.highlight : [n.highlight];
    list.forEach((h, i) => {
      const hp = Array.isArray(n.highlight) ? `${path}.highlight[${i}]` : `${path}.highlight`;
      if (!isObj(h)) return bad(hp, 'phải là { at, until, to }');
      for (const k of ['at', 'until'] as const) { if (h[k] === undefined) bad(`${hp}.${k}`, 'bắt buộc'); checkAnchor(h[k], `${hp}.${k}`); }
      if (!isObj(h.to) || Object.keys(h.to).length === 0) bad(`${hp}.to`, 'phải là { thuộc tính: giá trị } không rỗng');
      for (const [prop, v] of Object.entries(h.to as Record<string, unknown>)) {
        if (!(NUMBER_PROPS as readonly string[]).includes(prop) && !(COLOR_PROPS as readonly string[]).includes(prop)) bad(`${hp}.to.${prop}`, 'thuộc tính không hoạt cảnh được');
        checkValue(prop, v, `${hp}.to.${prop}`);
      }
    });
  }
  if (n.stagger !== undefined && !(isNum(n.stagger) && n.stagger >= 0 && n.stagger <= 30)) bad(`${path}.stagger`, 'phải là số khung từ 0 đến 30');
}

function walk(node: unknown, path: string, depth: number, seen: Set<string>, counter: { n: number }): void {
  if (!isObj(node)) return bad(path, 'phải là một đối tượng phần tử');
  if (++counter.n > MAX_NODES) bad(path, `quá ${MAX_NODES} phần tử trong một cảnh`);
  if (depth > MAX_DEPTH) bad(path, `quá ${MAX_DEPTH} cấp lồng nhau`);
  if (typeof node.id !== 'string' || node.id.length === 0 || node.id.length > 32) bad(`${path}.id`, 'bắt buộc, chuỗi từ 1 đến 32 ký tự');
  if (seen.has(node.id as string)) bad(`${path}.id`, `"${String(node.id)}" trùng với một phần tử khác`);
  seen.add(node.id as string);
  if (!inList(node.kind, NODE_KINDS)) bad(`${path}.kind`, `phải là một trong: ${NODE_KINDS.join(', ')}`);
  const kind = node.kind as (typeof NODE_KINDS)[number];

  for (const key of ['w', 'h', 'padding', 'gap', 'radius', 'size', 'weight', 'opacity', 'scale', 'x', 'y', 'rotate', 'strokeWidth']) if (node[key] !== undefined) checkNumber(node[key], key, `${path}.${key}`);
  for (const key of COLOR_PROPS) if (node[key] !== undefined && !isColor(node[key])) bad(`${path}.${key}`, `phải là màu: ${COLOR_TOKENS.join(', ')} hoặc #rrggbb`);
  if (node.align !== undefined && !inList(node.align, ['start', 'center', 'end'])) bad(`${path}.align`, 'phải là start, center hoặc end');
  for (const key of ['shadow', 'italic']) if (node[key] !== undefined && typeof node[key] !== 'boolean') bad(`${path}.${key}`, 'phải là true hoặc false');

  if (kind === 'text' && !(typeof node.text === 'string' && node.text.length >= 1 && node.text.length <= 80)) bad(`${path}.text`, 'phải là chuỗi từ 1 đến 80 ký tự');
  if (kind === 'icon' && !(typeof node.name === 'string' && node.name.length > 0)) bad(`${path}.name`, 'phải là tên icon (chuỗi không rỗng)');
  if (kind === 'image' && !(typeof node.src === 'string' && node.src.length > 0)) bad(`${path}.src`, 'phải là đường dẫn ảnh trong assets (chuỗi không rỗng)');
  if (kind === 'line') {
    const pts = node.points;
    if (!Array.isArray(pts) || pts.length < 2 || pts.length > 8 || !pts.every(p => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]))) bad(`${path}.points`, 'phải là mảng từ 2 đến 8 điểm [x, y]');
  }
  if (kind === 'grid' && !(Number.isInteger(node.cols) && (node.cols as number) >= 1 && (node.cols as number) <= 6)) bad(`${path}.cols`, 'phải là số nguyên từ 1 đến 6');
  checkPresets(node, path);

  const isContainer = (CONTAINER_KINDS as readonly string[]).includes(kind) || kind === 'box';
  if (node.children !== undefined) {
    if (!isContainer) bad(`${path}.children`, `phần tử kind ${kind} không có con`);
    if (!Array.isArray(node.children)) bad(`${path}.children`, 'phải là mảng');
    (node.children as unknown[]).forEach((c, i) => walk(c, `${path}.children[${i}]`, depth + 1, seen, counter));
  }
}

/** Why scene props are invalid (Vietnamese message that starts with the path to the mistake, e.g. `root.children[2].keys.scale[1].at`), or undefined. */
export function sceneProblem(props: Record<string, unknown>): string | undefined {
  try {
    if (props.root === undefined) bad('props.root', 'bắt buộc: phần tử gốc của cảnh');
    if (props.anchor !== undefined && !inList(props.anchor, SCENE_ANCHORS)) bad('props.anchor', `phải là một trong: ${SCENE_ANCHORS.join(', ')}`);
    for (const k of ['w', 'h'] as const) if (!(isNum(props[k]) && (props[k] as number) >= 0.05 && (props[k] as number) <= 1)) bad(`props.${k}`, 'bắt buộc, số từ 0,05 đến 1 (tỉ lệ khung, để kiểm né mặt)');
    walk(props.root, 'root', 1, new Set(), { n: 0 });
    return undefined;
  } catch (e) {
    if (e instanceof Bad) return e.message;
    throw e;
  }
}
