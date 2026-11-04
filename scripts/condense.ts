// Rút gọn nội dung: giữ các đoạn lời chọn trước (theo cụm từ đầu và cuối), cắt phần còn lại.
// Dùng: tsx scripts/condense.ts <projectDir> <condense.json>
// condense.json = { "keep": [{ "from": "<cụm mở đầu>", "to": "<cụm kết thúc>" }, ...] }; cụm tìm theo thứ tự trong transcript, không phân biệt dấu/hoa thường.
//
// Mốc cắt không lấy thẳng từ thời gian từng từ của Whisper (các từ nối liền nhau nên cắt đúng mốc là cắt giữa âm), mà được kéo về
// chỗ năng lượng âm thanh thấp nhất gần đó; mỗi đoạn mờ vào/ra 30 ms để không có tiếng "tách"; hai đoạn liền nhau trong lời gốc được nối làm một.
// Ghi thêm vào condense.json: segments (mốc cắt thật, tính theo full.mp4) và joins (thời điểm các chỗ ghép trên cleaned.mp4) để đạo diễn đặt chuyển cảnh.
// cleaned.mp4 và transcript.json cũ được giữ thành full.mp4 và transcript.full.json; sau đó chép lời lại bản đã rút gọn.
import { copyFileSync, existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cutVideo } from '../src/media/cut';
import { runFfmpeg } from '../src/media/ffmpeg';
import { transcribe } from '../src/media/transcribe';
import { normalizeLoose } from '../src/director/text';

const SAMPLE_RATE = 16000;
const HOP = SAMPLE_RATE / 100; // 10 ms
const FADE_SEC = 0.03;
const SEARCH_BEFORE = 0.3;
const SEARCH_AFTER = 0.3;
const WEAK_PAUSE_DB = -12; // a boundary less than 12 dB below normal speech is not a real pause

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

// loudness envelope: RMS per 10 ms, smoothed over 50 ms
const pcmFile = join(dir, 'full.pcm');
await runFfmpeg(['-y', '-i', full, '-vn', '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 's16le', pcmFile]);
const pcm = readFileSync(pcmFile);
rmSync(pcmFile);
const frames = Math.floor(pcm.length / 2 / HOP);
const raw: number[] = [];
for (let f = 0; f < frames; f++) {
  let sum = 0;
  for (let i = 0; i < HOP; i++) { const v = pcm.readInt16LE((f * HOP + i) * 2); sum += v * v; }
  raw.push(Math.sqrt(sum / HOP));
}
const env = raw.map((_, f) => { let s = 0, n = 0; for (let k = -2; k <= 2; k++) if (raw[f + k] !== undefined) { s += raw[f + k]; n++; } return s / n; });
const speechLevel = [...env].sort((a, b) => a - b)[Math.floor(env.length * 0.75)] || 1;

/** The quietest moment within [t - before, t + after] and how far (dB) it is below normal speech. */
function valley(t: number, before: number, after: number): { time: number; db: number } {
  const lo = Math.max(0, Math.round((t - before) * 100));
  const hi = Math.min(frames - 1, Math.round((t + after) * 100));
  let best = lo;
  for (let f = lo; f <= hi; f++) if (env[f] < env[best]) best = f;
  return { time: (best + 0.5) / 100, db: 20 * Math.log10(Math.max(env[best], 1e-3) / speechLevel) };
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
  const s = valley(words[sp.first].s, SEARCH_BEFORE, 0.05);
  const e = valley(words[sp.last].e, 0.05, SEARCH_AFTER);
  const flag = (d: number) => (d > WEAK_PAUSE_DB ? '  <-- không có chỗ lặng, mốc có thể cắt vào giữa âm' : '');
  console.log(`${s.time.toFixed(2)}${flag(s.db)} → ${e.time.toFixed(2)}${flag(e.db)} s (${s.db.toFixed(0)} dB, ${e.db.toFixed(0)} dB): ${words[sp.first].t} … ${words[sp.last].t}`);
  return { start: s.time, end: e.time };
});
const total = segments.reduce((n, r) => n + r.end - r.start, 0);
const joins: number[] = [];
let t = 0;
for (const r of segments.slice(0, -1)) { t += r.end - r.start; joins.push(Math.round(t * 1000) / 1000); }
console.log(`Giữ ${total.toFixed(1)} s trên ${words[words.length - 1].e.toFixed(1)} s, ${joins.length} chỗ ghép`);

await cutVideo(full, segments, join(dir, 'cleaned.mp4'), { fadeSec: FADE_SEC });
rmSync(join(dir, 'transcript.whisper.json'), { force: true }); // the old backup belongs to the previous cut
await transcribe(join(dir, 'cleaned.mp4'), join(dir, 'transcript.json'));
writeFileSync(join(dir, 'condense.json'), JSON.stringify({ ...spec, segments, joins }, null, 2));
