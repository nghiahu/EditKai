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

const captions: Layer[] = chunks.map((c, i) => {
  let marked = 0;
  const start = c[0].s;
  const nextStart = chunks[i + 1]?.[0].s ?? Infinity;
  return {
    id: `c${i + 1}`, track: 'caption', start,
    end: Math.min(c[c.length - 1].e + 0.15, nextStart, duration),
    words: c.map(w => {
      const hl = marked < 2 && KEY.has(normalizeWord(w.t));
      if (hl) marked++;
      return { t: w.t, s: w.s, e: w.e, hl };
    }),
  };
});

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
    title('t1', 1.5, 3.8, 'chat', 'CLAUDE EDIT'),
    title('t2', 4.6, 9.6, 'video', 'EDITOR TRỰC TIẾP', 'Hiển thị toàn bộ timeline'),
    { id: 'k1', track: 'graphic', type: 'chip-stack', start: 16.1, end: 21.3, props: { chips: [
      { icon: 'typography', label: 'Typography', sub: 'đủ kiểu' }, { icon: 'graphic', label: 'Graphic', sub: 'đa dạng' },
      { icon: 'motion', label: 'Motion', sub: 'mượt mà' }, { icon: 'audio', label: 'Âm thanh', sub: 'khớp từng khung' }] } },
    { id: 'x1', track: 'graphic', type: 'transition', start: 24.6, end: 25.2, props: { kind: 'blur' } },
    { id: 'e1', track: 'graphic', type: 'explainer-scene', start: 25.2, end: 29.4, props: {
      label: 'THAY VÌ PROMPT TỪNG LỖI', title: 'GIAO DIỆN EDITOR', body: { kind: 'list', items: ['Prompt sửa từng chi tiết', 'Tốn thời gian', 'Tốn token'] }, avatar: false } },
    title('t3', 30.8, 34, 'check', 'KHÔNG TỐN THÊM TOKEN', 'Chỉnh rồi render'),
    title('t4', 39.4, 43.4, 'clock', 'HƠN NỬA TIẾNG', 'Claude làm + 50 phút tự chỉnh'),
  ],
};
writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan, null, 2));
console.log(`${captions.length} captions, ${plan.layers.length} layers, ${duration.toFixed(2)}s`);
