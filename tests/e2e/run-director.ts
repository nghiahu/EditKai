// End-to-end run through the director: analyze → (the "AI" accepts every suggestion, with one override) → compose → validate.
// Usage: tsx tests/e2e/run-director.ts <projectDir>. The previous plan.json is kept as plan.prev.json once, and the new plan replaces plan.json.
import { copyFileSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { readStoryboard, writeStoryboard } from '../../src/director/storyboard';
import { analyzeStage } from '../../src/stages/analyze';
import { composeStage } from '../../src/stages/compose';
import { checkProject } from '../../src/stages/qa';

const dir = process.argv[2];
if (!dir) throw new Error('Usage: tsx tests/e2e/run-director.ts <projectDir>');

await analyzeStage(dir, { force: true });
const sb = readStoryboard(dir);
for (const b of sb.beats) b.reviewed = true;
// the one fixed override of this run: the AI removes the first logo-badge it was offered
for (const b of sb.beats) {
  const i = b.treatment.inserts.findIndex(x => x.type === 'logo-badge');
  if (i >= 0) { b.treatment.inserts.splice(i, 1); b.treatment.note = 'đạo diễn bỏ logo-badge đầu tiên'; break; }
}
writeStoryboard(dir, sb);

const { planFile, report } = await composeStage(dir);
if (planFile.endsWith('plan.next.json')) {
  if (!existsSync(join(dir, 'plan.prev.json'))) copyFileSync(join(dir, 'plan.json'), join(dir, 'plan.prev.json'));
  renameSync(planFile, join(dir, 'plan.json'));
}
console.log(JSON.stringify(report, null, 2));
const issues = await checkProject(dir);
console.log(`validate: ${issues.length} issue(s)`);
for (const i of issues) console.log(`  ${i.severity} ${i.code}: ${i.message}`);
