// Serves the player on http://127.0.0.1:4173 (set PORT to change it).
// Only the player and flows/ are served: capture/ holds unredacted images and is never exposed.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const PUBLIC = [resolve(ROOT, 'index.html'), resolve(ROOT, 'player') + sep, resolve(ROOT, 'flows') + sep];
const PORT = Number(process.env.PORT) || 4173;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  let file;
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    file = resolve(ROOT, `.${path === '/' ? '/index.html' : path}`);
  } catch {
    return res.writeHead(400).end('Bad request');
  }
  if (!PUBLIC.some((allowed) => file === allowed || (allowed.endsWith(sep) && file.startsWith(allowed)))) {
    return res.writeHead(404).end('Not found');
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Demo player running at http://127.0.0.1:${PORT}/`));
