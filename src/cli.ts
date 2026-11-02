import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanStage } from './stages/clean';
import { runQa } from './stages/qa';
import { renderStage } from './stages/render';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASPECTS: Record<string, [number, number]> = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080] };
const COMMANDS = 'init | clean | validate | editor | render';

type Out = (s: string) => void;

function parse(argv: string[]) {
  const [cmd, dir, ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) if (rest[i]?.startsWith('--')) flags[rest[i].slice(2)] = rest[i + 1];
  return { cmd, dir, flags };
}

export async function runCli(argv: string[], out: Out = console.log, err: Out = console.error): Promise<number> {
  const { cmd, dir, flags } = parse(argv);
  if (!['init', 'clean', 'validate', 'editor', 'render'].includes(cmd ?? '')) { err(`Lệnh không hợp lệ: ${cmd ?? '(trống)'}. Dùng: ${COMMANDS}`); return 2; }
  if (!dir) { err(`Thiếu thư mục project. Dùng: ${cmd} <thư-mục-project>`); return 2; }
  const projectDir = resolve(dir);

  try {
    if (cmd === 'init') {
      const style = flags.style ?? 's1', aspect = flags.aspect ?? '9:16', source = flags.source;
      if (!existsSync(join(root, 'styles', style, 'theme.json'))) { err(`Không có phong cách: ${style}`); return 2; }
      if (!ASPECTS[aspect]) { err(`Khung hình không hợp lệ: ${aspect}. Chọn: ${Object.keys(ASPECTS).join(', ')}`); return 2; }
      if (!source || !existsSync(source)) { err('Thiếu --source <file video> hoặc không tìm thấy file'); return 2; }
      if (existsSync(join(projectDir, 'source.mp4'))) { err(`Project đã tồn tại: ${projectDir}`); return 2; }
      mkdirSync(projectDir, { recursive: true });
      copyFileSync(source, join(projectDir, 'source.mp4'));
      const [width, height] = ASPECTS[aspect];
      writeFileSync(join(projectDir, 'project.json'), JSON.stringify({ style, aspect, width, height, fps: 30 }, null, 2));
      out(`Đã tạo project ${projectDir} (${style}, ${aspect}, ${width}x${height})`);
      return 0;
    }

    if (!existsSync(projectDir)) { err(`Không tìm thấy thư mục project: ${projectDir}`); return 2; }

    if (cmd === 'clean') {
      const r = await cleanStage(projectDir);
      out(`Đã làm sạch: ${r.cuts.length} đoạn cắt, ${r.transcript.words.length} từ → ${r.cleaned}`);
      return 0;
    }
    if (cmd === 'validate') {
      const report = await runQa(projectDir);
      out(JSON.stringify(report, null, 2));
      return report.issues.some(i => i.severity === 'error') ? 1 : 0;
    }
    if (cmd === 'render') {
      out(`Đã render: ${await renderStage(projectDir)}`);
      return 0;
    }
    // editor
    if (!existsSync(join(projectDir, 'plan.json'))) { err(`Chưa có plan.json trong ${projectDir}`); return 2; }
    return await new Promise<number>(res => {
      const p = spawn('npx', ['tsx', join(root, 'scripts', 'editor.ts'), projectDir], { stdio: 'inherit', shell: true, cwd: root });
      p.on('close', code => res(code ?? 0));
    });
  } catch (e) {
    err((e as Error).message);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(await runCli(process.argv.slice(2)));
}
