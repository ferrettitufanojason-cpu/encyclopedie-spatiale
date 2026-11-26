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
import { renderObjectPage } from '../lib/objet-page.mjs';
import { handlePublic, handleAdmin } from '../lib/feedback.mjs';

await loadEnv();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' };
const API = { iss: () => issNow(), 'iss-tv': () => issStreams(), apod, epic, rovers, simbad: u => simbadLookup(u.searchParams.get('q')) };
const PORT = Number(process.env.PORT ?? 4322);
// Avis en local : fichier .cache/feedback.json ; mot de passe de modération = ADMIN_TOKEN du .env, sinon « moderation-locale »
const FB_ENV = { ...process.env, KV_REST_API_URL: '', UPSTASH_REDIS_REST_URL: '', FEEDBACK_LOCAL_FILE: join(ROOT, '.cache', 'feedback.json'), ADMIN_TOKEN: process.env.ADMIN_TOKEN || 'moderation-locale' };
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/feedback' || url.pathname === '/api/feedback-admin') { // avis : stockage dans un fichier local
    let body = null;
    if (req.method === 'POST') { let raw = ''; for await (const ch of req) { raw += ch; if (raw.length > 20000) break; } try { body = JSON.parse(raw); } catch { body = null; } }
    const r = url.pathname === '/api/feedback' ? await handlePublic({ method: req.method, body, ip: req.socket.remoteAddress }, FB_ENV)
      : await handleAdmin({ method: req.method, body, auth: req.headers.authorization }, FB_ENV);
    res.writeHead(r.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(r.json)); return;
  }
  const m = url.pathname.match(/^\/api\/([\w-]+)$/);
  if (m) {
    try { if (!API[m[1]]) throw new Error('inconnu'); const d = await API[m[1]](url); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(d)); }
    catch (e) { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: String(e.message).replace(/api_key=[^&\s]+/g, 'api_key=***') })); }
    return;
  }
  const om = url.pathname.match(/^\/objet\/([^/]+)\/?$/);
  if (om) { // comme la réécriture /objet/:id -> /api/objet de vercel.json
    const getText = async f => { const q = join(ROOT, 'dist', normalize(f).replace(/^([/\\])+/, '')); return existsSync(q) ? readFile(q, 'utf8') : null; };
    const { status, html } = await renderObjectPage(om[1], getText, `http://localhost:${PORT}`);
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); return;
  }
  let p = join(ROOT, 'dist', normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, ''));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { const nf = join(ROOT, 'dist', '404.html'); res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(existsSync(nf) ? await readFile(nf) : '404'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(p)] ?? 'application/octet-stream' });
  res.end(await readFile(p));
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
