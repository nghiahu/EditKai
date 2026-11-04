// "Director" step of the s1 end-to-end run: builds plan.json from transcript.json by the rules in styles/s1/rules.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { probe } from '../../src/media/probe';
import { normalizeWord } from '../../src/qa/text';
import type { Layer, Plan } from '../../src/plan/types';

const dir = process.argv[2];
const words: { t: string; s: number; e: number }[] = JSON.parse(readFileSync(join(dir, 'transcript.json'), 'utf8')).words;
const duration = (await probe(join(dir, 'cleaned.mp4'))).durationSec;
const KEY = new Set(['skill', 'quota', 'edit', 'ai', 'workflow', 'render', 'footage', 'text', 'graphic', 'motion', 'phong', 'quy', 'token']);

const chunks: typeof words[] = [];
let cur: typeof words = [];
words.forEach((w, i) => {
  cur.push(w);
  const next = words[i + 1];
  if (cur.length === 8 || /[.,?!]$/.test(w.t) && cur.length >= 4 || (next && next.s - w.e > 0.6)) { chunks.push(cur); cur = []; }
});
if (cur.length) chunks.push(cur);

// Caption variants per styles/s1/rules.md: mostly phrase at the bottom (underline emphasis is the theme default), label rarely for tool names, never big.
const TERM_LABEL: Record<string, string> = { skill: 'bộ hướng dẫn', codex: 'công cụ', quota: 'giới hạn' };
let labels = 0;
const startOf = (c: typeof words) => Math.max(0, c[0].s - 0.05); // the phrase appears at the layer start, so start just before the first word

const captions: Layer[] = chunks.map((c, i) => {
  let marked = 0;
  const start = startOf(c);
  const nextStart = chunks[i + 1] ? startOf(chunks[i + 1]) : Infinity;
  const hlFlags = c.map(w => { const hl = marked < 2 && KEY.has(normalizeWord(w.t)); if (hl) marked++; return hl; });
  const term = c.map(w => normalizeWord(w.t)).find(t => t in TERM_LABEL);
  const label = term && c.length >= 4 && labels < 3 ? (labels++, TERM_LABEL[term]) : undefined;
  return {
    id: `c${i + 1}`, track: 'caption', start,
    end: Math.min(c[c.length - 1].e + 0.4, nextStart, duration),
    ...(label ? { props: { variant: 'label', label } } : {}),
    words: c.map((w, k) => ({ t: w.t, s: w.s, e: w.e, hl: hlFlags[k] })),
  };
});

const title = (id: string, start: number, end: number, icon: string, t: string, sub: string, override?: Record<string, unknown>): Layer =>
  ({ id, track: 'title', type: 'title-card', start, end, props: { icon, title: t, sub }, ...(override ? { override } : {}) });
const blur = (id: string, start: number): Layer => ({ id, track: 'graphic', type: 'transition', start, end: start + 0.5, props: { kind: 'blur' } });
const scene = (id: string, start: number, end: number, props: Record<string, unknown>): Layer => ({ id, track: 'graphic', type: 'explainer-scene', start, end, props });

const plan: Plan = {
  version: 1,
  meta: { source: 'cleaned.mp4', fps: 30, width: 1080, height: 1920, style: 's1' },
  scenes: [
    { id: 'sc1', start: 0, end: 21.5, role: 'talking-head' }, { id: 'sc2', start: 21.5, end: 30.5, role: 'explainer' },
    { id: 'sc3', start: 30.5, end: 47.5, role: 'talking-head' }, { id: 'sc4', start: 47.5, end: 57.5, role: 'explainer' },
    { id: 'sc5', start: 57.5, end: duration, role: 'talking-head' },
  ],
  layers: [
    ...captions,
    title('t1', 0.3, 4, 'video', 'EDIT VIDEO', 'Hoàn toàn bằng ChatGPT'),
    title('t2', 4.3, 7.9, 'skill', 'SKILL', 'Chi phí về quota ≈ 2–3%'),
    title('t3', 10, 15.4, 'lightbulb', 'AI CŨNG CÓ THỂ HIỂU', 'Giải thích và demo cách dùng'),
    title('t4', 15.6, 20.8, 'layers', 'SKILL: QUY TRÌNH CÀI SẴN', 'Hướng dẫn AI làm việc cụ thể'),
    { id: 'x1', track: 'graphic', type: 'transition', start: 21, end: 21.5, props: { kind: 'push' } },
    scene('e1', 21.5, 30.5, { label: 'TỪ FOOTAGE GỐC', title: 'EDIT TỪNG LỚP', body: { kind: 'waveform', items: ['Cắt khoảng lặng · nói vấp · phụ đề sát giọng'] }, avatar: true }),
    title('t5', 31, 35, 'clock', 'TỐN THỜI GIAN & CHI PHÍ', 'Mỗi lần đều phải làm lại', { colors: { teal: '#FF9A3C' } }),
    title('t6', 35.2, 41.2, 'rocket', 'ĐÓNG GÓI THÀNH SKILL', 'Quy tắc bố cục, vị trí text'),
    blur('x2', 47),
    scene('e2', 47.5, 57.5, { label: 'QUY TRÌNH CÀI SẴN', title: 'AI CHẠY QUY TRÌNH', body: { kind: 'progress', items: [{ label: 'Phân tích nội dung', value: 100 }, { label: 'Dựng theo workflow', value: 100 }, { label: 'Kiểm tra & render', value: 100 }] }, avatar: true }),
    title('t7', 58, 63, 'check', 'XEM LẠI & CHỈNH SỬA', 'Chỉ sửa cảnh chưa ưng'),
    title('t8', 66, 71, 'rocket', 'EDIT VIDEO PRO', 'Xây quy trình edit bằng AI'),
    // inserts chosen by what is being said (rules.md): a window frame for the screen recording, a badge when the product is named
    { id: 'fw', track: 'footage', type: 'footage', start: 43.5, end: 47, props: { src: 'assets/screen.mp4', frame: 'window', title: 'edit-video-pro', motion: 'zoom-in', from: 2 } },
    { id: 'lb', track: 'graphic', type: 'logo-badge', start: 64, end: 66, props: { icon: 'rocket', label: 'Edit Video Pro' } },
    { id: 'z1', track: 'camera', type: 'zoom-punch', start: 36, end: 37.2, props: {} },
    { id: 'z2', track: 'camera', type: 'zoom-punch', start: 66, end: 67.2, props: {} },
  ],
};
writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan, null, 2));
console.log(`${captions.length} captions, ${plan.layers.length} layers, ${duration.toFixed(2)}s`);
