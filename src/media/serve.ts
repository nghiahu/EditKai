import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream, statSync, existsSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import type { AddressInfo } from 'node:net';

const TYPES: Record<string, string> = {
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain',
};

/** Answer a request with a file from `dir` (relative URL path), honouring Range; 404 if missing or outside `dir`. */
export function serveFile(dir: string, urlPath: string, req: IncomingMessage, res: ServerResponse): void {
  let decoded: string;
  try { decoded = decodeURIComponent(urlPath.split('?')[0]); } catch { res.writeHead(400).end(); return; }
  const rel = normalize(decoded).replace(/^([\/])+/, '');
  const file = join(dir, rel);
  if (rel.startsWith('..') || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end(); return; }
  const size = statSync(file).size;
  const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
    createReadStream(file).pipe(res);
  }
}

/** Serve a folder over http on 127.0.0.1 (with Range support, which video decoding needs). */
export function serveDir(dir: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => serveFile(dir, req.url ?? '/', req, res));
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    const { port } = server.address() as AddressInfo;
    resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise(r => { server.closeAllConnections?.(); server.close(() => r()); }) });
  }));
}
