// Usage: tsx scripts/analyze-demo.ts <video> <outDir>
// Writes <outDir>/scenes.json (scene-change timestamps) and <outDir>/frames/ (one frame every 0.5 s).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runFfmpeg } from '../src/media/ffmpeg';
import { probe } from '../src/media/probe';

const [video, outArg] = process.argv.slice(2);
if (!video || !outArg) { console.error('Dùng: tsx scripts/analyze-demo.ts <video> <outDir>'); process.exit(2); }
const out = resolve(outArg);
mkdirSync(join(out, 'frames'), { recursive: true });

const info = await probe(video);
const log = await runFfmpeg(['-i', video, '-vf', "select='gt(scene,0.3)',showinfo", '-an', '-f', 'null', '-']);
const cuts = [...log.matchAll(/pts_time:([\d.]+)/g)].map(m => Number(m[1]));
const gaps = cuts.slice(1).map((t, i) => t - cuts[i]);
const summary = {
  durationSec: info.durationSec,
  cuts,
  cutCount: cuts.length,
  avgSecBetweenCuts: gaps.length ? Number((gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(2)) : null,
  minGap: gaps.length ? Number(Math.min(...gaps).toFixed(2)) : null,
  maxGap: gaps.length ? Number(Math.max(...gaps).toFixed(2)) : null,
};
writeFileSync(join(out, 'scenes.json'), JSON.stringify(summary, null, 2));
await runFfmpeg(['-y', '-i', video, '-vf', 'fps=2,scale=360:-1', join(out, 'frames', 'f%03d.jpg')]);
console.log(JSON.stringify(summary));
