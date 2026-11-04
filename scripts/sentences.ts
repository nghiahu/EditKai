// Liệt kê các khoảng ngừng thật trong lời nói của video gốc, mỗi khoảng kèm vài từ trước và sau nó:
// đó là những chỗ cắt được mà không cụt chữ. Mốc cắt trong condense phải nằm trong một khoảng ngừng như vậy.
// Dùng: tsx scripts/sentences.ts <projectDir> [số-giây-ngừng-tối-thiểu, mặc định 0.18]
// Đọc full.mp4 và transcript.full.json (sau khi condense) hoặc cleaned.mp4 và transcript.json (trước khi condense).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findPauses } from '../src/media/pauses';

const [dir, minArg] = process.argv.slice(2);
if (!dir) throw new Error('Dùng: tsx scripts/sentences.ts <projectDir> [giây-ngừng-tối-thiểu]');
const hasFull = existsSync(join(dir, 'full.mp4'));
const video = join(dir, hasFull ? 'full.mp4' : 'cleaned.mp4');
const words: { t: string; s: number; e: number }[] = JSON.parse(readFileSync(join(dir, hasFull ? 'transcript.full.json' : 'transcript.json'), 'utf8')).words;
const min = Number(minArg ?? 0.18);
const pauses = await findPauses(video, { minSec: min });
const CONTEXT = 6; // words shown on each side

const centre = (w: { s: number; e: number }) => (w.s + w.e) / 2;
console.log(`${pauses.length} khoảng ngừng ≥ ${min} s trên ${words[words.length - 1].e.toFixed(0)} s lời (thời gian từ của Whisper chỉ gần đúng, nên "trước" và "sau" là ước lượng)`);
pauses.forEach((p, i) => {
  const mid = (p.start + p.end) / 2;
  const before = words.filter(w => centre(w) < mid).slice(-CONTEXT).map(w => w.t).join(' ');
  const after = words.filter(w => centre(w) >= mid).slice(0, CONTEXT).map(w => w.t).join(' ');
  console.log(`${String(i + 1).padStart(2)}. ${p.start.toFixed(2)}–${p.end.toFixed(2)} (${(p.end - p.start).toFixed(2)} s)  …${before}  ‖  ${after}…`);
});
