// Utilitaires partagés par les scripts d'import.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DATA_DIR = join(ROOT, 'data');
export const CACHE_DIR = join(ROOT, '.cache');

/** Charge .env sans dépendance (les variables déjà définies gagnent). */
export async function loadEnv() {
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return;
  for (const line of (await readFile(p, 'utf8')).split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

/** fetch avec retries et cache disque optionnel (ttl en heures). */
export async function getText(url, { headers = {}, cacheKey, ttlHours = 0, retries = 3 } = {}) {
  const cfile = cacheKey ? join(CACHE_DIR, cacheKey) : null;
  if (cfile && ttlHours && existsSync(cfile)) {
    const { statSync } = await import('node:fs');
    if (Date.now() - statSync(cfile).mtimeMs < ttlHours * 3600e3) return readFile(cfile, 'utf8');
  }
  let err;
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'encyclopedie-spatiale-import/0.1', ...headers } });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText} — ${url.split('?')[0]}`);
      const t = await r.text();
      if (cfile) { await mkdir(dirname(cfile), { recursive: true }); await writeFile(cfile, t); }
      return t;
    } catch (e) { err = e; await new Promise(r => setTimeout(r, 1500 * (i + 1))); }
  }
  throw err;
}

export async function writeJson(name, obj) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, name), JSON.stringify(obj));
  console.log(`✔ data/${name}  (${Array.isArray(obj.objects) ? obj.objects.length + ' objets' : ''})`);
}

export const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9+]+/g, '-').replace(/^-|-$/g, '');

/** Parser CSV minimal (RFC 4180). */
export function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

export const num = v => (v === '' || v == null || Number.isNaN(Number(v))) ? null : Number(v);
