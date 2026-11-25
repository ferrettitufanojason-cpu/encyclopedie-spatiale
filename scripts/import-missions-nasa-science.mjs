// Source de repli pour les missions absentes du catalogue NSSDCA (pages en erreur) : les pages « mission » de NASA Science.
// Lues : titre, date de lancement, type de mission, cible, description officielle (méta og:description). Rien n'est deviné :
// un champ absent de la page reste absent. Les missions déjà importées depuis le NSSDCA ne sont pas dupliquées.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA_DIR, writeJson, getText, slug } from './lib/common.mjs';

const PAGES = ['hubble', 'cassini', 'galileo', 'soho', 'ulysses', 'magellan', 'dart', 'juice', 'europa-clipper'];
const today = new Date().toISOString().slice(0, 10);
const txt = h => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<br\s*\/?>/g, '\n').replace(/<\/(div|p|li|h\d|dt|dd|tr)>/g, '\n')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/[ \t]+/g, ' ').replace(/(\s*\n\s*)+/g, '\n');
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
function isoDate(s) {
  const m = s?.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),\s*(\d{4})$/); if (!m) return null;
  const mo = MONTHS[m[1].toLowerCase().slice(0, 3)]; return mo ? `${m[3]}-${String(mo).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}` : null;
}

const have = new Set(); // noms déjà couverts par le NSSDCA
try { for (const o of JSON.parse(await readFile(join(DATA_DIR, 'missions.json'), 'utf8')).objects) have.add(slug(o.name)); } catch {}
const objects = [];
for (const page of PAGES) {
  let h;
  try { h = await getText(`https://science.nasa.gov/mission/${page}/`, { cacheKey: `nasasci-${page}.html`, ttlHours: 168 }); }
  catch (e) { console.warn(`⚠ ${page}: ${e.message}`); continue; }
  const t = txt(h);
  const name = (h.match(/<title>([^<]*)/)?.[1] ?? '').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').replace(/\s*-\s*NASA Science\s*$/, '').trim();
  if (!name) { console.warn(`⚠ ${page}: titre introuvable`); continue; }
  if (have.has(slug(name))) continue;
  const get = k => t.match(new RegExp(`\\n${k}\\n([^\\n]+)`))?.[1]?.trim();
  const launch = isoDate(get('Launch')), type = get('Type'), target = get('Target');
  let og = h.match(/property="og:description" content="([^"]*)/)?.[1]?.replace(/&#0?39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"') ?? null;
  if (og && /unable to render/i.test(og)) og = null;
  const props = {};
  const T = (k, v) => { if (v) props[k] = { t: v, g: 'mission', s: 'nasasci' }; };
  T('launch', launch); T('mtype', type); T('target', target);
  objects.push({ id: `mission-${slug(name)}`, cat: 'other', sub: 'mission', name, code: page, aliases: [], tags: ['mission'], props, nssdcaDesc: og, launchDate: launch,
    src: 'nasasci', mslug: page, updated: today });
}
await writeJson('missions-nasasci.json', { source: { id: 'nasasci', name: 'NASA Science (pages missions)', url: 'https://science.nasa.gov/missions/', license: 'Contenu public NASA', fetched: today }, objects });
console.log(objects.map(o => `${o.mslug}: ${o.name} | lancement ${o.launchDate ?? 'non disponible'} | ${o.props.mtype?.t ?? '—'} | ${o.props.target?.t ?? '—'}`).join('\n'));
