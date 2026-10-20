// Serves the player on http://localhost:4173 (set PORT to change it).
// Listens on 127.0.0.1 only, so nothing else on the network can reach it.
// Only the player, flows/ and the embed test page are served: capture/ holds unredacted
// images and is never exposed. Nothing reached through a symbolic link is served either.
import { createServer } from 'node:http';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = Number(process.env.PORT) || 4173;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

const publicPaths = (root) => [
  resolve(root, 'index.html'),
  resolve(root, 'tests', 'host.html'),
  resolve(root, 'player') + sep,
  resolve(root, 'flows') + sep,
];
const allowed = (file, root) => publicPaths(root).some((p) => file === p || (p.endsWith(sep) && file.startsWith(p)));

// The real file to serve for a URL path, or null. The real path (links resolved) must be
// inside an allowed folder and must be the path asked for: a link anywhere on the way,
// even one pointing inside the site, is refused.
export async function resolveServed(pathname, root = ROOT) {
  const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!allowed(file, root)) return null;
  try {
    if ((await lstat(file)).isSymbolicLink()) return null;
    const realRoot = await realpath(root);
    const real = await realpath(file);
    if (!allowed(real, realRoot) || real !== resolve(realRoot, relative(root, file))) return null;
    return real;
  } catch {
    return null;
  }
}

// Browsers fetch video in pieces ("Range: bytes=0-"). Returns [start, end], undefined for a
// whole-file request, or null for a range that can't be satisfied.
function byteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!match || (match[1] === '' && match[2] === '')) return undefined;
  let start;
  let end;
  if (match[1] === '') {
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  return start <= end && start < size ? [start, end] : null;
}

async function handle(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return res.writeHead(400).end('Bad request');
  }
  const file = await resolveServed(pathname);
  if (!file) return res.writeHead(404).end('Not found');
  let body;
  try {
    body = await readFile(file);
  } catch {
    return res.writeHead(404).end('Not found');
  }
  const headers = { 'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes' };
  const range = byteRange(req.headers.range, body.length);
  if (range === null) return res.writeHead(416, { 'Content-Range': `bytes */${body.length}` }).end();
  if (range) {
    const [start, end] = range;
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${body.length}` });
    return res.end(body.subarray(start, end + 1));
  }
  res.writeHead(200, headers);
  return res.end(body);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer(handle).listen(PORT, '127.0.0.1', () => console.log(`Demo player running at http://localhost:${PORT}/`));
}
