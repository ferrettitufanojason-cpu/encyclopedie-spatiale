// Serveur local « comme Vercel » : sert dist/ et la fonction /api/iss (pour tester les parties en direct).
//   npm run build && node scripts/serve-local.mjs   ->  http://localhost:4322
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { ROOT } from './lib/common.mjs';
import { issNow } from '../lib/iss.mjs';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' };
const PORT = Number(process.env.PORT ?? 4322);
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/iss') {
    try { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(await issNow())); }
    catch (e) { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: String(e.message) })); }
    return;
  }
  let p = join(ROOT, 'dist', normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, ''));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(p)] ?? 'application/octet-stream' });
  res.end(await readFile(p));
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
