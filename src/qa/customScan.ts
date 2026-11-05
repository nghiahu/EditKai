import { buildSync, transformSync } from 'esbuild';

export const MAX_SOURCE_BYTES = 20 * 1024;
export interface ScanProblem { code: 'custom-syntax' | 'custom-too-large' | 'custom-forbidden-api' | 'custom-forbidden-import'; message: string }

const ALLOWED_IMPORTS = ['react', 'remotion', '@kit'];
/** Names a component must not touch: network, storage, dynamic code, windows, workers. */
const FORBIDDEN = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'eval', 'Function', 'localStorage', 'sessionStorage', 'indexedDB', 'postMessage', 'sendBeacon', 'importScripts', 'Worker', 'SharedWorker', 'globalThis', 'cookie', 'open'];
const FORBIDDEN_RE = new RegExp(`(?<![\\w$])(${FORBIDDEN.join('|')})(?![\\w$])`);
const COMPUTED_GLOBAL_RE = /(?<![\w$.])(window|self|top|parent|frames)\s*\[/;

/** The source with comments and the text of strings and templates blanked out (line breaks kept), so the scan sees code only. */
function codeOnly(src: string): string {
  let out = '';
  let i = 0;
  const templates: number[] = []; // brace depth at which each open `${` started
  let depth = 0;
  const blank = (c: string) => (c === '\n' ? '\n' : ' ');
  const readTemplateText = () => {
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') { out += blank(c) + blank(src[i + 1] ?? ''); i += 2; continue; }
      if (c === '`') { out += '`'; i++; return; }
      if (c === '$' && src[i + 1] === '{') { out += '${'; i += 2; templates.push(depth); depth++; return; }
      out += blank(c); i++;
    }
  };
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && n === '*') { while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += blank(src[i]); i++; } out += '  '; i += 2; continue; }
    if (c === '"' || c === "'") {
      out += c; i++;
      while (i < src.length && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') { out += ' '; i++; } out += blank(src[i] ?? ''); i++; }
      out += c; i++; continue;
    }
    if (c === '`') { out += '`'; i++; readTemplateText(); continue; }
    if (c === '{') depth++;
    if (c === '}') { depth--; if (templates.length && templates[templates.length - 1] === depth) { templates.pop(); out += '}'; i++; readTemplateText(); continue; } }
    out += c; i++;
  }
  return out;
}

const lineOf = (text: string, index: number) => text.slice(0, index).split('\n').length;

/** A static look at the source of a project component: size, syntax, imports and forbidden names. It cannot prove the code is safe (see the design's safety section). */
export function scanCustomSource(source: string): ScanProblem[] {
  const out: ScanProblem[] = [];
  if (Buffer.byteLength(source) > MAX_SOURCE_BYTES) out.push({ code: 'custom-too-large', message: `mã dài hơn ${MAX_SOURCE_BYTES / 1024} KB; tách phần dùng chung ra file khác hoặc đơn giản hóa` });
  try {
    transformSync(source, { loader: 'tsx' });
  } catch (e) {
    const err = (e as { errors?: { text: string; location?: { line: number } | null }[] }).errors?.[0];
    out.push({ code: 'custom-syntax', message: err ? `lỗi cú pháp ở dòng ${err.location?.line ?? '?'}: ${err.text}` : `lỗi cú pháp: ${(e as Error).message}` });
    return out;
  }
  // imports, dynamic imports and require calls, as esbuild reads them
  const built = buildSync({ stdin: { contents: source, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, metafile: true, external: ['*'], format: 'esm', logLevel: 'silent', treeShaking: false, tsconfigRaw: { compilerOptions: { verbatimModuleSyntax: true } } });
  for (const output of Object.values(built.metafile.outputs)) {
    for (const imp of output.imports) {
      const p = imp.path;
      const sibling = /^\.\/[^/\\]+$/.test(p);
      if (imp.kind !== 'import-statement' || !(ALLOWED_IMPORTS.includes(p) || sibling))
        out.push({ code: 'custom-forbidden-import', message: `import "${p}" (${imp.kind}) không được phép; chỉ react, remotion, @kit và file cùng thư mục (./tên)` });
    }
  }
  const code = codeOnly(source);
  const hit = FORBIDDEN_RE.exec(code);
  if (hit) out.push({ code: 'custom-forbidden-api', message: `dòng ${lineOf(code, hit.index)}: dùng "${hit[1]}" không được phép (mạng, lưu trữ, mã động hoặc cửa sổ khác)` });
  const computed = COMPUTED_GLOBAL_RE.exec(code);
  if (computed) out.push({ code: 'custom-forbidden-api', message: `dòng ${lineOf(code, computed.index)}: truy cập "${computed[1]}[...]" không được phép` });
  return out;
}
