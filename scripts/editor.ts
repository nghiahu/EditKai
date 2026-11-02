import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { startEditorServer } from '../editor/server/server';

const projectDir = resolve(process.argv[2] ?? '');
if (!process.argv[2] || !existsSync(resolve(projectDir, 'plan.json'))) {
  console.error('Dùng: npm run editor -- <thư-mục-project> (cần có plan.json bên trong)');
  process.exit(2);
}
const api = await startEditorServer(projectDir, 5186);
process.env.EDITKAI_API = api.url;
const vite = await createServer({ configFile: resolve('editor/vite.config.ts') });
await vite.listen();
console.log(`Editor: http://127.0.0.1:5187  (API ${api.url}, project ${projectDir})`);
