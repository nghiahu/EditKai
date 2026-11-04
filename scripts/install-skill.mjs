// Đăng ký skill để Claude Code tìm thấy: tạo liên kết ~/.claude/skills/edit-video-pro trỏ tới thư mục skill này (một bản duy nhất, không sao chép).
// Dùng: node scripts/install-skill.mjs [--dry-run] [--remove] [--home <thư-mục>]
//   --dry-run  chỉ nói sẽ làm gì, không đổi gì
//   --remove   gỡ đăng ký: chỉ xóa liên kết, không đụng vào thư mục skill
//   --home     thư mục người dùng khác (mặc định thư mục home hiện tại; dùng khi thử)
// Codex đọc AGENTS.md trong thư mục skill nên không cần đăng ký.
import { existsSync, lstatSync, mkdirSync, readlinkSync, realpathSync, rmdirSync, symlinkSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const home = args.includes('--home') ? resolve(args[args.indexOf('--home') + 1]) : homedir();
const target = join(home, '.claude', 'skills', 'edit-video-pro');
const dry = flag('--dry-run');

const isLink = p => { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } };
const pointsHere = p => { try { return realpathSync(p) === realpathSync(root); } catch { return false; } };

if (flag('--remove')) {
  if (!existsSync(target) && !isLink(target)) { console.log(`Chưa đăng ký: ${target}`); process.exit(0); }
  if (!isLink(target)) { console.error(`${target} không phải liên kết do script này tạo, không xóa.`); process.exit(1); }
  console.log(`${dry ? '[thử] ' : ''}Gỡ liên kết ${target} (thư mục skill ${root} giữ nguyên)`);
  if (!dry) { try { unlinkSync(target); } catch { rmdirSync(target); } } // a Windows junction is removed like an empty folder
  process.exit(0);
}

if (existsSync(target) || isLink(target)) {
  if (isLink(target) && pointsHere(target)) { console.log(`Skill đã đăng ký: ${target} → ${root}`); process.exit(0); }
  console.error(`Đã có một mục tên edit-video-pro ở ${target}${isLink(target) ? ` (trỏ tới ${readlinkSync(target)})` : ''}; không ghi đè. Xóa hoặc đổi tên mục đó rồi chạy lại.`);
  process.exit(1);
}
console.log(`${dry ? '[thử] ' : ''}Đăng ký skill: ${target} → ${root}`);
if (!dry) {
  mkdirSync(dirname(target), { recursive: true });
  symlinkSync(root, target, 'junction'); // 'junction' works without admin rights on Windows and is ignored elsewhere
}
