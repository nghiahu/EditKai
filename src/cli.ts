import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSET_KINDS, addAsset, readManifest, type AssetKind } from './assets/manifest';
import { cleanStage } from './stages/clean';
import { mergeRegenerated } from './plan/merge';
import { readPlan } from './plan/io';
import { validatePlanSchema } from './plan/schema';
import { resetQaRounds, runQa } from './stages/qa';
import { renderStage } from './stages/render';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASPECTS: Record<string, [number, number]> = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080] };
const COMMANDS = 'init | clean | validate | merge | assets | editor | render';

type Out = (s: string) => void;

/** Node + the tsx CLI, with the project path as a single argument (no shell, so spaces in paths are safe). */
export function editorCommand(projectDir: string): { cmd: string; args: string[] } {
  return { cmd: process.execPath, args: [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(root, 'scripts', 'editor.ts'), projectDir] };
}

function flagsOf(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) if (args[i]?.startsWith('--')) flags[args[i].slice(2)] = args[i + 1];
  return flags;
}

const ASSETS_USAGE = 'Dùng: assets add <thư-mục-project> <file> --desc "<mô tả>" [--kind screen|phone|photo|logo|other] | assets list <thư-mục-project>';

async function runAssets(args: string[], out: Out, err: Out): Promise<number> {
  const [sub, dir, ...rest] = args;
  if ((sub !== 'add' && sub !== 'list') || !dir) { err(ASSETS_USAGE); return 2; }
  const projectDir = resolve(dir);
  if (!existsSync(projectDir)) { err(`Không tìm thấy thư mục project: ${projectDir}`); return 2; }
  try {
    if (sub === 'list') { out(JSON.stringify(readManifest(projectDir), null, 2)); return 0; }
    const [file, ...flagArgs] = rest;
    const flags = flagsOf(flagArgs);
    if (!file) { err(ASSETS_USAGE); return 2; }
    if (!flags.desc) { err('Thiếu --desc "<mô tả>": AI đạo diễn dùng mô tả để ghép footage với lời nói'); return 2; }
    if (flags.kind && !(ASSET_KINDS as readonly string[]).includes(flags.kind)) { err(`--kind không hợp lệ: ${flags.kind}. Chọn: ${ASSET_KINDS.join(', ')}`); return 2; }
    if (!existsSync(file)) { err(`Không tìm thấy file: ${file}`); return 2; }
    out(JSON.stringify(await addAsset(projectDir, file, { description: flags.desc, kind: flags.kind as AssetKind | undefined }), null, 2));
    return 0;
  } catch (e) {
    err((e as Error).message);
    return 1;
  }
}

function parse(argv: string[]) {
  const [cmd, dir, ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) if (rest[i]?.startsWith('--')) flags[rest[i].slice(2)] = rest[i + 1];
  return { cmd, dir, flags };
}

export async function runCli(argv: string[], out: Out = console.log, err: Out = console.error): Promise<number> {
  if (argv[0] === 'assets') return runAssets(argv.slice(1), out, err);
  const { cmd, dir, flags } = parse(argv);
  if (!['init', 'clean', 'validate', 'merge', 'editor', 'render'].includes(cmd ?? '')) { err(`Lệnh không hợp lệ: ${cmd ?? '(trống)'}. Dùng: ${COMMANDS}`); return 2; }
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
      resetQaRounds(projectDir); // new timeline, new QA count
      out(`Đã làm sạch: ${r.cuts.length} đoạn cắt, ${r.transcript.words.length} từ → ${r.cleaned}`);
      return 0;
    }
    if (cmd === 'validate') {
      const report = await runQa(projectDir);
      out(JSON.stringify(report, null, 2));
      return report.issues.some(i => i.severity === 'error') ? 1 : 0;
    }
    if (cmd === 'merge') {
      // The director writes a regenerated plan to plan.next.json; locked layers of plan.json survive the merge.
      const nextFile = join(projectDir, 'plan.next.json');
      if (!existsSync(nextFile)) { err(`Chưa có plan.next.json trong ${projectDir}`); return 2; }
      const next = JSON.parse(readFileSync(nextFile, 'utf8'));
      const check = validatePlanSchema(next);
      if (!check.ok) { err(`plan.next.json không hợp lệ:\n${check.issues.map(i => `- ${i.message}`).join('\n')}`); return 1; }
      const merged = mergeRegenerated(readPlan(projectDir), next);
      writeFileSync(join(projectDir, 'plan.json'), JSON.stringify(merged, null, 2));
      rmSync(nextFile);
      out(`Đã gộp: ${merged.layers.filter(l => l.locked).length} layer đã khóa được giữ, ${merged.layers.length} layer tổng cộng`);
      return 0;
    }
    if (cmd === 'render') {
      out(`Đã render: ${await renderStage(projectDir)}`);
      return 0;
    }
    // editor
    if (!existsSync(join(projectDir, 'plan.json'))) { err(`Chưa có plan.json trong ${projectDir}`); return 2; }
    resetQaRounds(projectDir); // editing in the editor starts a new QA count
    const { cmd: bin, args } = editorCommand(projectDir);
    return await new Promise<number>(res => {
      const p = spawn(bin, args, { stdio: 'inherit', cwd: root });
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
