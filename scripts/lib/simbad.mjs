// Client minimal TAP/ADQL pour SIMBAD (CDS). Bascule automatiquement sur un miroir officiel.
import { parseCsv } from './common.mjs';

const MIRRORS = ['https://simbad.cds.unistra.fr', 'https://simbad.harvard.edu'];
let mirror = 0;

export async function tap(adql, { retries = 3 } = {}) {
  let err;
  for (let i = 0; i < retries * MIRRORS.length; i++) {
    const base = MIRRORS[(mirror + i) % MIRRORS.length];
    try {
      const r = await fetch(`${base}/simbad/sim-tap/sync`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'encyclopedie-spatiale-import/0.1' },
        body: new URLSearchParams({ request: 'doQuery', lang: 'adql', format: 'csv', query: adql }),
        signal: AbortSignal.timeout(120000),
      });
      const t = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status} ${t.slice(0, 200)}`);
      mirror = (mirror + i) % MIRRORS.length;
      return parseCsv(t);
    } catch (e) { err = e; if (/HTTP 400/.test(e.message)) throw e; await new Promise(r => setTimeout(r, 800)); }
  }
  throw err;
}

export const sq = s => `'${String(s).replace(/'/g, "''")}'`;
