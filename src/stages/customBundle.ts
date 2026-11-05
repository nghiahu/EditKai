import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { NAME_RE } from '../plan/custom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const posix = (p: string) => p.split('\\').join('/');

/** Names of the components a project has: `components/<name>.tsx` with a valid name, sorted. */
export function customComponentNames(projectDir: string): string[] {
  const dir = join(projectDir, 'components');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.tsx') && NAME_RE.test(f.slice(0, -4)))
    .map(f => f.slice(0, -4))
    .sort();
}

export interface ProjectBundle {
  serveUrl: string;
  /** Removes the bundle folder (and the temporary entry file). */
  close: () => Promise<void>;
}

/**
 * Bundles the composition together with the project's own components. A temporary entry file registers every
 * `components/<name>.tsx` of the project, and webpack is told where `react`, `remotion` and `@kit` live (the skill's own).
 * Without components it bundles remotion/index.ts as it is.
 */
export async function bundleProject(projectDir: string, opts: { outDir?: string } = {}): Promise<ProjectBundle> {
  const names = customComponentNames(projectDir);
  let entryDir: string | undefined;
  let entryPoint = resolve(root, 'remotion', 'index.ts');
  if (names.length) {
    entryDir = mkdtempSync(join(tmpdir(), 'editkai-entry-'));
    const imp = (p: string) => JSON.stringify(posix(p));
    const lines = [
      `import { customComponents } from ${imp(join(root, 'remotion', 'customRegistry'))};`,
      ...names.map((n, i) => `import C${i} from ${imp(join(projectDir, 'components', n))};`),
      ...names.map((n, i) => `customComponents[${JSON.stringify(n)}] = C${i};`),
      `import ${imp(join(root, 'remotion', 'index'))};`,
    ];
    entryPoint = join(entryDir, 'entry.tsx');
    writeFileSync(entryPoint, lines.join('\n') + '\n');
  }
  let serveUrl: string;
  try {
    serveUrl = await bundle({
      entryPoint,
      outDir: opts.outDir,
      ignoreRegisterRootWarning: names.length > 0, // registerRoot is called by remotion/index, which the entry imports
      webpackOverride: c => (names.length
        ? { ...c, resolve: { ...c.resolve, modules: [join(root, 'node_modules'), ...(c.resolve?.modules ?? ['node_modules'])], alias: { ...(c.resolve?.alias as object), '@kit': join(root, 'remotion', 'kit.ts') } } }
        : c),
    });
  } catch (e) {
    if (entryDir) rmSync(entryDir, { recursive: true, force: true });
    throw e;
  }
  return { serveUrl, close: async () => { rmSync(serveUrl, { recursive: true, force: true }); if (entryDir) rmSync(entryDir, { recursive: true, force: true }); } };
}
