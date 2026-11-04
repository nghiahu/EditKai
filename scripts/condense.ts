// Rút gọn nội dung: giữ các đoạn lời chọn trước (theo cụm từ đầu và cuối), cắt phần còn lại.
// Dùng: tsx scripts/condense.ts <projectDir> <condense.json>
// condense.json = { "keep": [{ "from": "<cụm mở đầu>", "to": "<cụm kết thúc>" }, ...] }; cụm tìm theo thứ tự trong transcript, không phân biệt dấu/hoa thường.
//
// Mốc cắt không lấy thẳng từ thời gian từng từ của Whisper (các từ nối liền nhau nên cắt đúng mốc là cắt giữa âm). Mỗi mốc được đặt vào giữa một
// khoảng ngừng thật trong âm thanh (src/media/pauses.ts) nếu có khoảng ngừng gần đó; không có thì mới kéo về chỗ năng lượng thấp nhất sát mốc và in
// cảnh báo "không có chỗ ngừng". Mỗi đoạn mờ vào/ra 30 ms; hai đoạn liền nhau trong lời gốc được nối làm một.
// Sau khi cắt, chép lời lại và đối chiếu với lời dự kiến: mảnh từ thừa hoặc thiếu ngay tại chỗ ghép (ví dụ "chính" của câu trước lọt vào đoạn sau)
// được in ra để chọn lại mốc. Ghi thêm vào condense.json: segments (mốc cắt thật, tính theo full.mp4) và joins (thời điểm các chỗ ghép trên
// cleaned.mp4) để đạo diễn đặt chuyển cảnh.
// cleaned.mp4 và transcript.json cũ được giữ thành full.mp4 và transcript.full.json.
import { copyFileSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cutVideo } from '../src/media/cut';
import { findPauses, loudnessEnvelope } from '../src/media/pauses';
import { shotChanges } from '../src/media/shots';
import { transcribe } from '../src/media/transcribe';
import { normalizeLoose } from '../src/director/text';

const FADE_SEC = 0.03;
const SHOT_REACH = 0.15; // a source cut this close to a segment edge is respected
const PAUSE_MIN_SEC = 0.15;
const REACH_BEFORE = 0.6; // a pause this far before the word-time of a start, or after the word-time of an end, is still "the" pause
const REACH_AFTER = 0.25;
// without a pause the cut stays close to Whisper's time and leans away from the neighbouring word: a start may move a little later, an end a little earlier
const FALLBACK_INSIDE = 0.14;
const FALLBACK_OUTSIDE = 0.04;
const WEAK_DB = -12;

const [dir, specFile] = process.argv.slice(2);
if (!dir || !specFile) throw new Error('Dùng: tsx scripts/condense.ts <projectDir> <condense.json>');
const spec = JSON.parse(readFileSync(specFile, 'utf8')) as { keep: { from: string; to: string }[] };
const full = join(dir, 'full.mp4');
if (!existsSync(full)) {
  renameSync(join(dir, 'cleaned.mp4'), full);
  copyFileSync(join(dir, 'transcript.json'), join(dir, 'transcript.full.json'));
}
const words: { t: string; s: number; e: number }[] = JSON.parse(readFileSync(join(dir, 'transcript.full.json'), 'utf8')).words;
const norm = words.map(w => normalizeLoose(w.t));

/** Index of the first word of `phrase` at or after `from` (an error when it is not found, so a typo never cuts the wrong part). */
function find(phrase: string, from: number): number {
  const p = phrase.split(/\s+/).map(normalizeLoose).filter(Boolean);
  for (let i = from; i + p.length <= norm.length; i++) if (p.every((x, k) => norm[i + k] === x)) return i;
  throw new Error(`Không tìm thấy cụm "${phrase}" sau từ thứ ${from}`);
}

const pauses = await findPauses(full, { minSec: PAUSE_MIN_SEC });
const shots = await shotChanges(full); // the source's own cuts (to b-roll, say): a segment must not keep a frame from the other side of one
const { env, level } = await loudnessEnvelope(full);

/** The cut for a boundary near word-time `t`: the middle of the nearest real pause, else the quietest moment right next to `t`. */
function cutPoint(t: number, kind: 'start' | 'end'): { time: number; how: string } {
  const lo = kind === 'start' ? t - REACH_BEFORE : t - REACH_AFTER;
  const hi = kind === 'start' ? t + REACH_AFTER : t + REACH_BEFORE;
  const near = pauses.filter(p => p.end >= lo && p.start <= hi);
  if (near.length) {
    const p = near.reduce((a, b) => (Math.abs((a.start + a.end) / 2 - t) <= Math.abs((b.start + b.end) / 2 - t) ? a : b));
    return { time: (p.start + p.end) / 2, how: `ngừng ${(p.end - p.start).toFixed(2)} s` };
  }
  const before = kind === 'start' ? FALLBACK_OUTSIDE : FALLBACK_INSIDE;
  const after = kind === 'start' ? FALLBACK_INSIDE : FALLBACK_OUTSIDE;
  const from = Math.max(0, Math.round((t - before) * 100));
  const to = Math.min(env.length - 1, Math.round((t + after) * 100));
  let best = from;
  for (let f = from; f <= to; f++) if (env[f] < env[best]) best = f;
  const db = 20 * Math.log10(Math.max(env[best], 1e-3) / level);
  return { time: (best + 0.5) / 100, how: `KHÔNG có chỗ ngừng, chỗ nhỏ nhất ${db.toFixed(0)} dB${db > WEAK_DB ? ' (cắt giữa tiếng nói)' : ''}` };
}

type Span = { first: number; last: number };
const spans: Span[] = [];
let cursor = 0;
for (const k of spec.keep) {
  const a = find(k.from, cursor);
  const z = find(k.to, a);
  const last = z + k.to.split(/\s+/).filter(Boolean).length - 1;
  const prev = spans[spans.length - 1];
  if (prev && prev.last + 1 === a) prev.last = last; // adjacent in the original speech: one continuous part, no join
  else spans.push({ first: a, last });
  cursor = last + 1;
}

const segments = spans.map(sp => {
  const s = cutPoint(words[sp.first].s, 'start');
  const e = cutPoint(words[sp.last].e, 'end');
  // a source cut just inside the segment: the first frames would belong to the previous shot (start) or the next one (end)
  const sc = shots.find(c => c > s.time && c - s.time <= SHOT_REACH);
  if (sc !== undefined) { console.log('    đầu đoạn lùi theo cảnh cắt của video gốc ' + s.time.toFixed(2) + ' -> ' + sc.toFixed(2)); s.time = sc; }
  const ec = shots.find(c => c < e.time && e.time - c <= SHOT_REACH);
  if (ec !== undefined) { console.log('    cuối đoạn lùi theo cảnh cắt của video gốc ' + e.time.toFixed(2) + ' -> ' + (ec - 0.02).toFixed(2)); e.time = ec - 0.02; }
  console.log(`${s.time.toFixed(2)} → ${e.time.toFixed(2)} s  [đầu: ${s.how}] [cuối: ${e.how}]\n    ${words[sp.first].t} … ${words[sp.last].t}`);
  return { start: Math.max(0, s.time), end: e.time };
});
const total = segments.reduce((n, r) => n + r.end - r.start, 0);
const joins: number[] = [];
let acc = 0;
for (const r of segments.slice(0, -1)) { acc += r.end - r.start; joins.push(Math.round(acc * 1000) / 1000); }
console.log(`Giữ ${total.toFixed(1)} s trên ${words[words.length - 1].e.toFixed(1)} s, ${joins.length} chỗ ghép`);

await cutVideo(full, segments, join(dir, 'cleaned.mp4'), { fadeSec: FADE_SEC });
rmSync(join(dir, 'transcript.whisper.json'), { force: true }); // the old backup belongs to the previous cut
const heard = (await transcribe(join(dir, 'cleaned.mp4'), join(dir, 'transcript.json'))).words;
writeFileSync(join(dir, 'condense.json'), JSON.stringify({ ...spec, segments, joins }, null, 2));

// --- check the joins: line the words that should be there up with what Whisper hears in the cut video ---
const expected = spans.flatMap(sp => norm.slice(sp.first, sp.last + 1));
const got = heard.map(w => normalizeLoose(w.t));
const n = expected.length, m = got.length;
const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (expected[i - 1] === got[j - 1] ? 0 : 1));
const extra = new Set<number>(); // heard words with nothing to match in the expected text (a different spelling of a wanted word is not one of them)
for (let i = n, j = m; j > 0; ) {
  if (i > 0 && d[i][j] === d[i - 1][j - 1] + (expected[i - 1] === got[j - 1] ? 0 : 1)) { i--; j--; }
  else if (i > 0 && d[i][j] === d[i - 1][j] + 1) i--;
  else { extra.add(j - 1); j--; }
}
let problems = 0;
for (const j of joins) {
  const around = heard.map((w, idx) => ({ w, idx })).filter(({ w }) => w.e >= j - 0.5 && w.s <= j + 0.5);
  const odd = around.filter(({ idx }) => extra.has(idx));
  const ctx = heard.filter(w => w.e >= j - 1.2 && w.s <= j + 1.2).map(w => (w.s < j + 0.05 && w.e > j - 0.05 ? `[${w.t}]` : w.t)).join(' ');
  if (odd.length) problems++;
  console.log(`${odd.length ? '!! ' : 'ok '}chỗ ghép ${j.toFixed(2)} s: ${ctx}${odd.length ? `   <-- từ lạ: ${odd.map(({ w }) => `"${w.t}"`).join(', ')}` : ''}`);
}
console.log(problems ? `${problems} chỗ ghép có mảnh từ lạ: chọn lại cụm đầu hoặc cuối của đoạn đó` : 'Các chỗ ghép không có mảnh từ lạ');
