// Chạy CLI của skill từ bất kỳ thư mục nào: node <thư mục skill>/scripts/ev.mjs <lệnh> <thư-mục-project> [tùy chọn]
// Thư mục project (ví dụ projects/ten) tính từ thư mục gốc của skill; file đầu vào do người dùng đưa (--source, file của `assets add`)
// tính từ thư mục bạn đang đứng, rồi đổi thành đường dẫn tuyệt đối trước khi chạy.
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const here = process.cwd();
const args = process.argv.slice(2);

const out = args.map((a, i) => {
  if (args[i - 1] === '--source') return resolve(here, a);
  // assets add <thư-mục-project> <file> ...
  if (args[0] === 'assets' && args[1] === 'add' && i === 3) return resolve(here, a);
  return a;
});

const tsx = join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const child = spawn(process.execPath, [tsx, join(root, 'src', 'cli.ts'), ...out], { cwd: root, stdio: 'inherit' });
child.on('close', code => process.exit(code ?? 1));
