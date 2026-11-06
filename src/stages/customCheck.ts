import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';
import { customBox, type CustomProps } from '../plan/custom';
import type { Issue } from '../plan/types';
import { diffBox } from '../qa/imageDiff';
import { openRenderSession } from './render';

/** A picture may stick out of the declared box by this share of the frame before it is a warning (shadows, glow, rounding). */
const BOX_MARGIN = 0.05;
/** One picture that takes longer than this means a component too heavy to render a whole video. */
export const SLOW_MS = 10000;

export interface CustomCheckFrame { layerId: string; t: number; file: string; ms: number }
export interface CustomCheckResult { dir: string; issues: Issue[]; frames: CustomCheckFrame[] }

const firstLine = (e: unknown) => String((e as Error)?.message ?? e).split('\n').find(l => l.trim()) ?? 'lỗi không rõ';

/**
 * Renders each `custom` layer (all of them, or those using component `name`) at its start, middle and last frame, alone on top of the video,
 * into `custom-check/`, and reports what a render would trip over: a component that throws (error), draws nothing at all (error),
 * draws outside the w and h it declared (warning) or takes too long per picture (warning). Looking at the pictures is still up to the AI.
 */
export async function customCheck(projectDir: string, opts: { name?: string } = {}): Promise<CustomCheckResult> {
  const session = await openRenderSession(projectDir); // the same refusal as render: a plan with errors (bad props, missing or forbidden code) stops here
  try {
    const { fps, width, height } = session.plan.meta;
    const all = session.plan.layers.filter(l => l.type === 'custom');
    if (!all.length) throw new Error('plan.json không có layer custom nào để kiểm');
    const layers = opts.name ? all.filter(l => l.props?.component === opts.name) : all;
    if (!layers.length) throw new Error(`Không có layer custom nào dùng thành phần "${opts.name}" (có: ${[...new Set(all.map(l => l.props?.component))].join(', ')})`);

    const dir = join(projectDir, 'custom-check');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const issues: Issue[] = [];
    const frames: CustomCheckFrame[] = [];
    const browser = await openBrowser('chrome');
    const lastFrame = session.composition.durationInFrames - 1;
    const still = (composition: typeof session.composition, inputProps: Record<string, unknown>, frame: number, output: string) =>
      renderStill({ composition, serveUrl: session.serveUrl, output, frame, inputProps, puppeteerInstance: browser });
    try {
      for (const l of layers) {
        const first = Math.min(lastFrame, Math.round(l.start * fps));
        const last = Math.min(lastFrame, Math.max(first, Math.round(l.end * fps) - 1));
        const moments = [...new Set([first, Math.round((first + last) / 2), last])];
        const without = { ...session.inputProps, plan: { ...session.plan, layers: session.plan.layers.filter(o => o.id !== l.id) } };
        const baseComposition = await selectComposition({ serveUrl: session.serveUrl, id: 'PlanVideo', inputProps: without }); // the composition carries its props, so the picture without the layer needs its own
        const box = customBox(l.props as unknown as CustomProps, session.theme.limits.safeZone);
        let drawn = false;
        let outside = false;
        let broke = false;
        for (const [i, frame] of moments.entries()) {
          const file = join(dir, `${l.id}-${i + 1}.png`);
          const t0 = Date.now();
          try {
            await still(session.composition, session.inputProps, frame, file);
          } catch (e) {
            issues.push({ severity: 'error', code: 'custom-throws', layerId: l.id, message: `${l.id}: thành phần "${l.props?.component}" báo lỗi khi dựng khung ${frame}: ${firstLine(e)}` });
            broke = true;
            await new Promise(r => setTimeout(r, 600));
            break;
          }
          const ms = Date.now() - t0;
          frames.push({ layerId: l.id, t: frame / fps, file, ms: Math.max(1, ms) });
          if (ms > SLOW_MS) issues.push({ severity: 'warning', code: 'custom-slow', layerId: l.id, message: `${l.id}: một khung mất ${(ms / 1000).toFixed(1)} s để dựng (quá ${SLOW_MS / 1000} s); đơn giản hóa thành phần` });
          // what the component added to the picture: this frame against the same frame without the layer
          const base = join(dir, `${l.id}-${i + 1}.base.png`);
          await still(baseComposition, without, frame, base);
          const added = await diffBox(base, file, { width, height });
          rmSync(base, { force: true });
          if (added) {
            drawn = true;
            if (box && (added.x < box.x - BOX_MARGIN || added.y < box.y - BOX_MARGIN || added.x + added.w > box.x + box.w + BOX_MARGIN || added.y + added.h > box.y + box.h + BOX_MARGIN)) outside = true;
          }
        }
        if (broke) continue;
        if (!drawn) issues.push({ severity: 'error', code: 'custom-blank', layerId: l.id, message: `${l.id}: thành phần "${l.props?.component}" không vẽ gì ở đầu, giữa và cuối layer; kiểm tra khoảng thời gian của layer và logic hiện hình` });
        else if (outside) issues.push({ severity: 'warning', code: 'custom-out-of-box', layerId: l.id, message: `${l.id}: thành phần vẽ ra ngoài hộp khai báo (props.w, props.h, anchor, offset); đổi hộp hoặc thu nhỏ hình để việc né mặt và phụ đề có tác dụng` });
      }
    } finally {
      await new Promise(r => setTimeout(r, 600));
      await browser.close({ silent: true }).catch(() => {});
    }
    return { dir, issues, frames };
  } finally {
    await session.close();
  }
}

