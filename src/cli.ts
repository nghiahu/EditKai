import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSET_KINDS, addAsset, readManifest, type AssetKind } from './assets/manifest';
import { runDoctor } from './doctor';
import { probe } from './media/probe';
import { aspectNote, framingProblem } from './plan/framing';
import { analyzeStage } from './stages/analyze';
import { cleanStage } from './stages/clean';
import { condenseStage } from './stages/condense';
import { fixTranscript } from './stages/fixTranscript';
import { listPauses } from './stages/pauses';
import { composeStage } from './stages/compose';
import { mergeRegenerated } from './plan/merge';
import { readPlan } from './plan/io';
import { validatePlanSchema } from './plan/schema';
import { resetQaRounds, runQa } from './stages/qa';
import { previewStage, previewVideo } from './stages/preview';
import { sampleFrames } from './stages/sampleFrames';
import { facesStage } from './stages/faces';
import { renderStage } from './stages/render';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASPECTS: Record<string, [number, number]> = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080] };
const COMMANDS = 'doctor | init | clean | fix-transcript | pauses | condense | frames | faces | analyze | compose | validate | merge | assets | editor | preview | render';

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

/** doctor: checks the machine and prints one line per check; exit 1 when an error-level check fails. */
async function runDoctorCommand(out: Out): Promise<number> {
  const checks = await runDoctor(root);
  for (const c of checks) out(`${c.ok ? '✓' : c.level === 'error' ? '✗' : '!'} ${c.name}: ${c.detail}${c.ok || !c.fix ? '' : `
    → ${c.fix}`}`);
  const errors = checks.filter(c => !c.ok && c.level === 'error').length;
  out(errors ? `${errors} lỗi cần sửa trước khi chạy skill` : checks.some(c => !c.ok) ? 'Chạy được, còn vài cảnh báo ở trên' : 'Mọi thứ đã sẵn sàng');
  return errors ? 1 : 0;
}

function parse(argv: string[]) {
  const [cmd, dir, ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) if (rest[i]?.startsWith('--')) flags[rest[i].slice(2)] = rest[i + 1];
  return { cmd, dir, flags };
}

export async function runCli(argv: string[], out: Out = console.log, err: Out = console.error): Promise<number> {
  if (argv[0] === 'assets') return runAssets(argv.slice(1), out, err);
  if (argv[0] === 'doctor') return runDoctorCommand(out);
  const { cmd, dir, flags } = parse(argv);
  if (!['init', 'clean', 'fix-transcript', 'pauses', 'condense', 'frames', 'faces', 'analyze', 'compose', 'validate', 'merge', 'editor', 'preview', 'render'].includes(cmd ?? '')) { err(`Lệnh không hợp lệ: ${cmd ?? '(trống)'}. Dùng: ${COMMANDS}`); return 2; }
  if (!dir) { err(`Thiếu thư mục project. Dùng: ${cmd} <thư-mục-project>`); return 2; }
  const projectDir = resolve(dir);

  try {
    if (cmd === 'init') {
      const style = flags.style ?? 's1', aspect = flags.aspect ?? '9:16', source = flags.source;
      if (!existsSync(join(root, 'styles', style, 'theme.json'))) { err(`Không có phong cách: ${style}`); return 2; }
      if (!ASPECTS[aspect]) { err(`Khung hình không hợp lệ: ${aspect}. Chọn: ${Object.keys(ASPECTS).join(', ')}`); return 2; }
      if (!source || !existsSync(source)) { err('Thiếu --source <file video> hoặc không tìm thấy file'); return 2; }
      if (existsSync(join(projectDir, 'source.mp4'))) { err(`Project đã tồn tại: ${projectDir}`); return 2; }
      // how the source sits in the frame: --fit cover|contain and --focus x,y (0-1); checked before anything is created
      const framing: { fit?: string; focus?: { x: number; y: number } } = {};
      if (flags.fit !== undefined) framing.fit = flags.fit;
      if (flags.focus !== undefined) { const [x, y] = flags.focus.split(',').map(Number); framing.focus = { x, y }; }
      const bad = framingProblem(framing);
      if (bad) { err(`${bad.replace('meta.', '--')}${flags.focus !== undefined ? ' (dạng --focus 0.4,0.5)' : ''}`); return 2; }
      mkdirSync(projectDir, { recursive: true });
      copyFileSync(source, join(projectDir, 'source.mp4'));
      const [width, height] = ASPECTS[aspect];
      writeFileSync(join(projectDir, 'project.json'), JSON.stringify({ style, aspect, width, height, fps: 30, ...framing }, null, 2));
      out(`Đã tạo project ${projectDir} (${style}, ${aspect}, ${width}x${height})`);
      const src = await probe(source);
      const note = aspectNote(src.width, src.height, width, height);
      if (note) out(note);
      return 0;
    }

    if (!existsSync(projectDir)) { err(`Không tìm thấy thư mục project: ${projectDir}`); return 2; }

    if (cmd === 'clean') {
      const r = await cleanStage(projectDir);
      resetQaRounds(projectDir); // new timeline, new QA count
      out(`Đã làm sạch: ${r.cuts.length} đoạn cắt, ${r.transcript.words.length} từ → ${r.cleaned}`);
      return 0;
    }
    if (cmd === 'fix-transcript') {
      const r = fixTranscript(projectDir, flags.fixes ? resolve(flags.fixes) : undefined);
      out(`Đã sửa ${r.changed} từ trong transcript.json (bản Whisper gốc ở transcript.whisper.json)`);
      r.unmatched.forEach(u => out(`  không khớp chỗ nào: "${u.sai}" → "${u.dung}"${u.sau ? ` (sau "${u.sau}")` : ''}${u.tiep ? ` (trước "${u.tiep}")` : ''}: kiểm tra chính tả của "sai", "sau", "tiep"`));
      return 0;
    }
    if (cmd === 'pauses') {
      (await listPauses(projectDir, flags.min ? Number(flags.min) : undefined)).forEach(l => out(l));
      return 0;
    }
    if (cmd === 'condense') {
      const r = await condenseStage(projectDir, flags.spec ? resolve(flags.spec) : undefined);
      r.lines.forEach(l => out(l));
      resetQaRounds(projectDir); // new timeline
      return 0;
    }
    if (cmd === 'frames') {
      const r = await sampleFrames(projectDir, flags.count ? { count: Number(flags.count) } : {});
      out(`Đã chụp ${r.frames.length} khung của cleaned.mp4 vào ${r.dir}; bảng tổng hợp: ${r.sheet}`);
      r.frames.forEach(f => out(`  ${f.t.toFixed(1)} s  ${f.file}`));
      return 0;
    }
    if (cmd === 'faces') {
      (await facesStage(projectDir)).lines.forEach(l => out(l));
      return 0;
    }
    if (cmd === 'analyze') {
      const sb = await analyzeStage(projectDir, { force: 'force' in flags }); // --force is a bare flag
      const cues = sb.beats.reduce((n, b) => n + b.cues.length, 0);
      const byType: Record<string, number> = {};
      let joinsDone = 0;
      for (const b of sb.beats) for (const i of b.treatment.inserts) { if (i.type === 'transition') joinsDone++; else byType[i.type] = (byType[i.type] ?? 0) + 1; }
      const inserts = Object.values(byType).reduce((n, v) => n + v, 0);
      const kinds = Object.entries(byType).map(([t, n]) => `${t} ${n}`).join(', ');
      const guesses = sb.beats.reduce((n, b) => n + b.treatment.inserts.filter(i => i.maybe).length, 0);
      out(`Đã phân tích: ${sb.beats.length} nhịp, ${cues} gợi ý, ${inserts} insert đề xuất${kinds ? ` (${kinds})` : ''}${guesses ? `, trong đó ${guesses} chưa chắc (lấp khoảng trống, cần xem lại)` : ''}${joinsDone ? `, ${joinsDone} chuyển cảnh ở các chỗ ghép` : ''} → storyboard.json`);
      return 0;
    }
    if (cmd === 'compose') {
      const { planFile, report } = await composeStage(projectDir);
      const c = report.captions;
      out(`Đã compose → ${planFile}: ${c.phrase + c.label + c.big} caption (${c.label} label, ${c.big} big), ${report.inserts.kept} insert (${report.inserts.moved.length} dời, ${report.inserts.dropped.length} bỏ), ${report.camera.kept} camera, ${report.unreviewedBeats} nhịp chưa duyệt`);
      if (report.unusedAssets.length) out(`Asset chưa dùng: ${report.unusedAssets.join(', ')}`);
      report.issues.forEach(i => out(`! ${i}`));
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
    if (cmd === 'preview') {
      if ('video' in flags) { // --video is a bare flag
        const t0 = Date.now();
        const file = await previewVideo(projectDir);
        out(`Đã dựng bản xem nhanh (nhỏ, chất lượng thấp): ${file} trong ${Math.round((Date.now() - t0) / 1000)} giây`);
        return 0;
      }
      const r = await previewStage(projectDir, { ...(flags.frames ? { max: Number(flags.frames) } : {}), ...(flags.at ? { at: flags.at.split(',').map(Number) } : {}) }); // --frames N and --at t1,t2,... go before --video
      out(`Đã chụp ${r.frames.length} khung vào ${r.dir}; bảng tổng hợp: ${r.sheet}`);
      r.frames.forEach(f => out(`  ${f.t.toFixed(1)} s  ${f.label}  ${f.file}`));
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
