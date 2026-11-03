// "Director" step of the m1 end-to-end run: builds plans/m1-e2e/plan.json from transcript.json by the rules in styles/m1/rules.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { probe } from '../../src/media/probe';
import { normalizeWord } from '../../src/qa/text';
import type { Layer, Plan } from '../../src/plan/types';

const dir = process.argv[2];
const words: { t: string; s: number; e: number }[] = JSON.parse(readFileSync(join(dir, 'transcript.json'), 'utf8')).words;
const duration = (await probe(join(dir, 'cleaned.mp4'))).durationSec; // layers must not outlast the video
const KEY = new Set(['đẳng', 'cấp', 'chuyên', 'nghiệp', 'claude', 'editor', 'graphic', 'motion', 'token', 'tiếng', '50', 'skill', 'pro', 'tiktok', 'ai', 'render']);

const chunks: typeof words[] = [];
let cur: typeof words = [];
words.forEach((w, i) => {
  cur.push(w);
  const next = words[i + 1];
  if (cur.length === 4 || /[.,?!]$/.test(w.t) || (next && next.s - w.e > 0.5)) { chunks.push(cur); cur = []; }
});
if (cur.length) chunks.push(cur);
// make room for big captions: a 4-word chunk with a key word after its first word becomes 1 + 3 words, so the short claim can be big
for (let i = 0, lastBigAt = -Infinity; i < chunks.length; i++) {
  const c = chunks[i];
  if (c.length === 4 && c[1].s - lastBigAt >= 8 && c.slice(1).some(w => KEY.has(normalizeWord(w.t)))) {
    chunks.splice(i, 1, [c[0]], c.slice(1));
    lastBigAt = c[1].s;
    i++;
  }
}

// Caption variants per styles/m1/rules.md: ~60% phrase at the bottom, ~20% label (tool names and terms), 10-15% big (key claims of <= 3 words, at most once per 8 s).
const TERM_LABEL: Record<string, string> = {
  claude: 'công cụ', editor: 'giao diện', token: 'chi phí', typography: 'chữ', graphic: 'đồ họa', motion: 'chuyển động',
  tiktok: 'kênh', skill: 'bộ skill', render: 'xuất video', opus: 'mô hình',
};
let lastBig = -Infinity;
let labels = 0;
const startOf = (c: typeof words) => Math.max(0, c[0].s - 0.05); // the phrase appears at the layer start, so start just before the first word

const captions: Layer[] = chunks.map((c, i) => {
  let marked = 0;
  const start = startOf(c);
  const nextStart = chunks[i + 1] ? startOf(chunks[i + 1]) : Infinity;
  const hlFlags = c.map(w => { const hl = marked < 2 && KEY.has(normalizeWord(w.t)); if (hl) marked++; return hl; });
  const term = c.map(w => normalizeWord(w.t)).find(t => t in TERM_LABEL);
  let props: Record<string, unknown> | undefined;
  if (c.length <= 3 && hlFlags.some(Boolean) && start - lastBig >= 8) { props = { variant: 'big' }; lastBig = start; }
  else if (term && c.length >= 3 && labels < chunks.length * 0.2) { props = { variant: 'label', label: TERM_LABEL[term] }; labels++; }
  return {
    id: `c${i + 1}`, track: 'caption', start,
    end: Math.min(c[c.length - 1].e + 0.4, nextStart, duration),
    ...(props ? { props } : {}),
    words: c.map((w, k) => ({ t: w.t, s: w.s, e: w.e, hl: hlFlags[k] })),
  };
});
console.log('caption variants:', captions.reduce((n: Record<string, number>, l) => { const v = String(l.props?.variant ?? 'phrase'); n[v] = (n[v] ?? 0) + 1; return n; }, {}));

const title = (id: string, start: number, end: number, icon: string, t: string, sub?: string): Layer =>
  ({ id, track: 'title', type: 'title-card', start, end, props: { icon, title: t, ...(sub ? { sub } : {}) } });

const plan: Plan = {
  version: 1,
  meta: { source: 'cleaned.mp4', fps: 30, width: 1080, height: 1920, style: 'm1' },
  scenes: [
    { id: 'sc1', start: 0, end: 25, role: 'talking-head' },
    { id: 'sc2', start: 25, end: 29.5, role: 'explainer' },
    { id: 'sc3', start: 29.5, end: duration, role: 'talking-head' },
  ],
  layers: [
    ...captions,
    title('t1', 1.5, 3.8, 'sparkles', 'CLAUDE EDIT'),
    title('t2', 4.6, 9.6, 'layers', 'EDITOR TRỰC TIẾP', 'Hiển thị toàn bộ timeline'),
    { id: 'k1', track: 'graphic', type: 'chip-stack', start: 16.1, end: 21.3, props: { chips: [
      { icon: 'typography', label: 'Typography', sub: 'đủ kiểu' }, { icon: 'graphic', label: 'Graphic', sub: 'đa dạng' },
      { icon: 'motion', label: 'Motion', sub: 'mượt mà' }, { icon: 'audio', label: 'Âm thanh', sub: 'khớp từng khung' }] } },
    { id: 'x1', track: 'graphic', type: 'transition', start: 24.6, end: 25.2, props: { kind: 'push' } },
    { id: 'e1', track: 'graphic', type: 'explainer-scene', start: 25.2, end: 29.4, props: {
      label: 'THAY VÌ PROMPT TỪNG LỖI', title: 'GIAO DIỆN EDITOR', mode: 'overlay', body: { kind: 'list', items: ['Prompt sửa từng chi tiết', 'Tốn thời gian', 'Tốn token'] }, avatar: false } },
    title('t3', 30.8, 34, 'zap', 'KHÔNG TỐN THÊM TOKEN', 'Chỉnh rồi render'),
    { id: 'x2', track: 'graphic', type: 'transition', start: 38.9, end: 39.3, props: { kind: 'flash' } },
    title('t4', 39.4, 43.4, 'clock', 'HƠN NỬA TIẾNG', 'Claude làm + 50 phút tự chỉnh'),
    // camera: punch-ins on emphasised words about every 6-10 s, one light shake on the cost line
    ...[[0.3, 1.4], [10.2, 11.4], [17, 18.3], [23.2, 24.4], [34.5, 35.7], [39.7, 40.9]].map(([s, e], i): Layer => ({ id: `z${i + 1}`, track: 'camera', type: 'zoom-punch', start: s, end: e, props: {} })),
    { id: 'k2', track: 'camera', type: 'shake', start: 26, end: 26.6, props: { intensity: 1 } },
  ],
};
writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan, null, 2));
console.log(`${captions.length} captions, ${plan.layers.length} layers, ${duration.toFixed(2)}s`);
