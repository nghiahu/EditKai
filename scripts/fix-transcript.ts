// Sửa lỗi chép lời: thay từ theo bảng { "từ sai": "từ đúng" } trong file JSON, giữ nguyên thời gian từng từ.
// Dùng: tsx scripts/fix-transcript.ts <projectDir> <fixes.json> — transcript.json cũ được giữ ở transcript.whisper.json.
// Chỉ thay từ đứng riêng (bỏ dấu câu ở đầu/cuối khi so khớp, giữ lại dấu câu khi thay); "sau" và "tiep" tùy chọn là từ đứng ngay trước và ngay sau từ cần sửa.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, fixesFile] = process.argv.slice(2);
if (!dir || !fixesFile) throw new Error('Dùng: tsx scripts/fix-transcript.ts <projectDir> <fixes.json>');
type Fix = { sai: string; dung: string; sau?: string; tiep?: string };
const fixes = JSON.parse(readFileSync(fixesFile, 'utf8')) as Fix[];
const file = join(dir, 'transcript.json');
const backup = join(dir, 'transcript.whisper.json');
if (!existsSync(backup)) copyFileSync(file, backup);
const transcript = JSON.parse(readFileSync(backup, 'utf8')) as { words: { t: string; s: number; e: number }[] };
const bare = (s: string) => s.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

const orig = transcript.words.map(w => w.t); // "sau" is compared with the original word, not one already fixed
let changed = 0;
transcript.words.forEach((w, i) => {
  for (const f of fixes) {
    if (bare(w.t) !== bare(f.sai)) continue;
    if (f.sau && bare(orig[i - 1] ?? '') !== bare(f.sau)) continue;
    if (f.tiep && bare(orig[i + 1] ?? '') !== bare(f.tiep)) continue;
    const m = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/su.exec(w.t)!;
    w.t = `${m[1]}${f.dung}${m[3]}`;
    changed++;
    break;
  }
});
writeFileSync(file, JSON.stringify(transcript, null, 2));
console.log(`Đã sửa ${changed} từ`);
