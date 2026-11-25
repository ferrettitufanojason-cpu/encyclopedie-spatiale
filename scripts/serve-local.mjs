// Serveur local « comme Vercel » : sert dist/ et les fonctions /api/* (ISS, APOD, EPIC, rovers, SIMBAD) pour tester les parties en direct.
//   npm run build && node scripts/serve-local.mjs   ->  http://localhost:4322
// La clé NASA est lue dans .env (jamais envoyée au navigateur).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { ROOT, loadEnv } from './lib/common.mjs';
import { issNow } from '../lib/iss.mjs';
import { apod, epic, rovers, simbadLookup } from '../lib/nasa.mjs';
import { issStreams } from '../lib/iss-tv.mjs';

await loadEnv();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' };
const API = { iss: () => issNow(), 'iss-tv': () => issStreams(), apod, epic, rovers, simbad: u => simbadLookup(u.searchParams.get('q')) };
const PORT = Number(process.env.PORT ?? 4322);
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const m = url.pathname.match(/^\/api\/([\w-]+)$/);
  if (m) {
    try { if (!API[m[1]]) throw new Error('inconnu'); const d = await API[m[1]](url); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(d)); }
    catch (e) { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: String(e.message).replace(/api_key=[^&\s]+/g, 'api_key=***') })); }
    return;
  }
  let p = join(ROOT, 'dist', normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, ''));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(p)] ?? 'application/octet-stream' });
  res.end(await readFile(p));
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
