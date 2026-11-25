// Événements du ciel à venir :
//  - pluies de météores : « Working List of Visual Meteor Showers » du calendrier officiel de l'IMO (PDF annuel, année en cours + suivante)
//  - oppositions des planètes, plus grandes élongations de Mercure et Vénus, rapprochements entre planètes : calculés à partir
//    des éphémérides JPL Horizons (API officielle NASA/JPL), pas à pas d'un jour sur 24 mois.
// -> data/sky-events.json
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { writeJson } from './lib/common.mjs';

const H = { 'User-Agent': 'encyclopedie-spatiale-import/0.1' };
const today = new Date(), todayIso = today.toISOString().slice(0, 10);
const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const pad = n => String(n).padStart(2, '0');
const objects = [];

/* ---------- pluies de météores (IMO) ---------- */
const FR = { QUA: 'Quadrantides', LYR: 'Lyrides', ETA: 'Êta-Aquarides', PER: 'Perséides', ORI: 'Orionides', LEO: 'Léonides', GEM: 'Géminides', DRA: 'Draconides', URS: 'Ursides',
  SDA: 'Delta-Aquarides du Sud', CAP: 'Alpha-Capricornides', STA: 'Taurides du Sud', NTA: 'Taurides du Nord', AUR: 'Aurigides', JBO: 'Bootides de juin', ACE: 'Alpha-Centaurides', MON: 'Monocérotides' };
async function imoTable(year) {
  const r = await fetch(`https://www.imo.net/files/meteor-shower/cal${year}.pdf`, { headers: H, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`IMO ${year} : HTTP ${r.status}`);
  const doc = await getDocument({ data: new Uint8Array(await r.arrayBuffer()), useSystemFonts: true }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent(); const rows = {};
    for (const it of tc.items) (rows[Math.round(it.transform[5])] ??= []).push([it.transform[4], it.str]);
    for (const y of Object.keys(rows).map(Number).sort((a, b) => b - a)) lines.push(rows[y].sort((a, b) => a[0] - b[0]).map(x => x[1]).join(' ').replace(/\s+/g, ' ').trim());
  }
  const out = [];
  const re = /^(.+?) \((\d{3}) ([A-Z]{3})\) ([A-Z][a-z]{2} \d{2})–([A-Z][a-z]{2} \d{2}) \(?([A-Z][a-z]{2} \d{2})\)? \(?(\d+(?: \. \d+)?) ?\)? (\d+) ([+−-]) ?(\d+) (\d+) ([\d.]+) (\d+\+?|Var)$/;
  for (const l of lines) {
    const m = l.match(re); if (!m) continue;
    const [, name, iau, code, a, b, max, lam, ra, sgn, dec, v, rr, zhr] = m;
    const [mm, dd] = max.split(' ');
    out.push({ name: name.replace(/\s+-/g, '-').replace(/ \./g, '.').trim(), iau: `${iau} ${code}`, code, start: a, end: b, max: `${year}-${pad(MON[mm])}-${dd}`,
      lambda: Number(lam.replace(/ /g, '')), ra: Number(ra), dec: Number((sgn === '+' ? '' : '-') + dec), v: Number(v), r: Number(rr), zhr: zhr === 'Var' ? null : Number(zhr.replace('+', '')), variable: zhr === 'Var' });
  }
  return out;
}
for (const year of [today.getUTCFullYear(), today.getUTCFullYear() + 1]) {
  let rows = [];
  try { rows = await imoTable(year); } catch (e) { console.warn('⚠', e.message); continue; }
  for (const s of rows) {
    const props = {
      date: { t: `${s.max} (${s.start} – ${s.end})`, g: 'event', s: 'imo' }, etype: { t: 'pluie de météores (maximum)', g: 'event', s: 'imo' },
      zhr: s.zhr != null ? { v: s.zhr, u: 'météores/h', g: 'event', s: 'imo' } : { t: 'variable', g: 'event', s: 'imo' },
      met_v: { v: s.v, u: 'km/s', g: 'event', s: 'imo' }, met_rad: { t: `α ${s.ra}°, δ ${s.dec > 0 ? '+' : ''}${s.dec}°`, g: 'event', s: 'imo' },
      met_lambda: { v: s.lambda, u: '°', g: 'event', s: 'imo' }, met_r: { v: s.r, u: '', g: 'event', s: 'imo' }, iau: { t: s.iau, g: 'event', s: 'imo' },
    };
    objects.push({ id: `meteor-${s.code.toLowerCase()}-${year}`, cat: 'other', sub: 'meteor-shower', name: `${s.name} ${year}`, nameFr: `${FR[s.code] ?? s.name} ${year}`, code: `IAU ${s.iau}`,
      aliases: [s.name, s.code], tags: ['event', 'meteor-shower'], props, src: 'imo', imoYear: year, updated: todayIso, eventDate: s.max, eventKind: 'meteor', zhr: s.zhr });
  }
  console.log(`  pluies de météores ${year} : ${rows.length}`);
}

/* ---------- planètes : JPL Horizons ---------- */
const PLANETS = { 199: ['Mercury', 'Mercure'], 299: ['Venus', 'Vénus'], 499: ['Mars', 'Mars'], 599: ['Jupiter', 'Jupiter'], 699: ['Saturn', 'Saturne'], 799: ['Uranus', 'Uranus'], 899: ['Neptune', 'Neptune'] };
const start = todayIso, stop = new Date(today.getTime() + 730 * 86400000).toISOString().slice(0, 10);
async function ephem(id) {
  const q = new URLSearchParams({ format: 'json', COMMAND: `'${id}'`, OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'OBSERVER', CENTER: "'500@399'",
    START_TIME: `'${start}'`, STOP_TIME: `'${stop}'`, STEP_SIZE: "'1 d'", QUANTITIES: "'1,9,23'", ANG_FORMAT: 'DEG', CSV_FORMAT: 'YES' });
  const j = await (await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${q}`, { headers: H, signal: AbortSignal.timeout(60000) })).json();
  const body = j.result.split('$$SOE')[1]?.split('$$EOE')[0]; if (!body) throw new Error(`Horizons ${id} : réponse inattendue`);
  return body.trim().split('\n').map(l => {
    const c = l.split(',').map(x => x.trim()); // date, (solar presence), (lunar), RA, DEC, APmag, S-brt, S-O-T, /r
    const nums = c.filter(x => /^-?\d+(\.\d+)?$/.test(x)).map(Number);
    const [ra, dec, mag, , elong] = nums;
    const d = c[0].match(/(\d{4})-([A-Za-z]{3})-(\d{2})/);
    return { date: `${d[1]}-${pad(MON[d[2]])}-${d[3]}`, ra, dec, mag, elong, side: c.find(x => /^\/[LT]$/.test(x)) };
  });
}
const eph = {};
for (const id of Object.keys(PLANETS)) { eph[id] = await ephem(id); await new Promise(r => setTimeout(r, 600)); }
const HZ = { id: 'horizons', url: 'https://ssd.jpl.nasa.gov/horizons/' };
const ev = (id, sub, name, nameFr, date, props, extra = {}) => objects.push({ id, cat: 'other', sub, name, nameFr, code: date, aliases: [], tags: ['event', sub], props, src: 'horizons', updated: todayIso, eventDate: date, eventKind: sub, ...extra });
// oppositions (élongation maximale proche de 180°) des planètes extérieures
for (const id of ['499', '599', '699', '799', '899']) {
  const e = eph[id];
  for (let i = 1; i < e.length - 1; i++) if (e[i].elong > 170 && e[i].elong >= e[i - 1].elong && e[i].elong >= e[i + 1].elong) {
    const [en, fr] = PLANETS[id];
    ev(`opposition-${en.toLowerCase()}-${e[i].date}`, 'opposition', `${en} at opposition — ${e[i].date}`, `Opposition ${/^[AEIOUÉ]/.test(fr) ? 'd’' : 'de '}${fr} — ${e[i].date}`, e[i].date, {
      date: { t: `${e[i].date} (±1 jour)`, g: 'event', s: 'horizons', calc: true, calcNote: 'horizons' }, etype: { t: 'opposition (planète à l’opposé du Soleil, visible toute la nuit)', g: 'event', s: 'horizons' },
      app_mag: { v: e[i].mag, u: 'mag', g: 'event', s: 'horizons' }, elong: { v: +e[i].elong.toFixed(1), u: '°', g: 'event', s: 'horizons' } }, { planet: id });
  }
}
// plus grandes élongations de Mercure et Vénus
for (const id of ['199', '299']) {
  const e = eph[id];
  for (let i = 1; i < e.length - 1; i++) if (e[i].elong >= e[i - 1].elong && e[i].elong > e[i + 1].elong && e[i].elong > 15) {
    const [en, fr] = PLANETS[id], evening = e[i].side === '/T';
    ev(`elongation-${en.toLowerCase()}-${e[i].date}`, 'elongation', `${en} at greatest ${evening ? 'eastern (evening)' : 'western (morning)'} elongation — ${e[i].date}`,
      `${fr} à sa plus grande élongation ${evening ? 'du soir' : 'du matin'} — ${e[i].date}`, e[i].date, {
        date: { t: `${e[i].date} (±1 jour)`, g: 'event', s: 'horizons', calc: true, calcNote: 'horizons' }, etype: { t: `plus grande élongation ${evening ? 'est (visible le soir)' : 'ouest (visible le matin)'}`, g: 'event', s: 'horizons' },
        elong: { v: +e[i].elong.toFixed(1), u: '°', g: 'event', s: 'horizons' }, app_mag: { v: e[i].mag, u: 'mag', g: 'event', s: 'horizons' } }, { planet: id });
  }
}
// rapprochements entre planètes visibles à l'œil nu (séparation minimale < 2,5°, hors éblouissement solaire)
const sep = (a, b) => { const r = Math.PI / 180; return Math.acos(Math.min(1, Math.sin(a.dec * r) * Math.sin(b.dec * r) + Math.cos(a.dec * r) * Math.cos(b.dec * r) * Math.cos((a.ra - b.ra) * r))) / r; };
const BRIGHT = ['199', '299', '499', '599', '699'];
for (let x = 0; x < BRIGHT.length; x++) for (let y = x + 1; y < BRIGHT.length; y++) {
  const A = eph[BRIGHT[x]], B = eph[BRIGHT[y]];
  for (let i = 1; i < A.length - 1; i++) {
    const s0 = sep(A[i - 1], B[i - 1]), s1 = sep(A[i], B[i]), s2 = sep(A[i + 1], B[i + 1]);
    if (s1 <= s0 && s1 < s2 && s1 < 2.5 && Math.min(A[i].elong, B[i].elong) > 15) {
      const [an, af] = PLANETS[BRIGHT[x]], [bn, bf] = PLANETS[BRIGHT[y]];
      ev(`conjunction-${an.toLowerCase()}-${bn.toLowerCase()}-${A[i].date}`, 'conjunction', `${an}–${bn} conjunction — ${A[i].date}`, `Rapprochement ${af}–${bf} — ${A[i].date}`, A[i].date, {
        date: { t: `${A[i].date} (±1 jour)`, g: 'event', s: 'horizons', calc: true, calcNote: 'horizons' }, etype: { t: 'rapprochement apparent de deux planètes dans le ciel', g: 'event', s: 'horizons' },
        sep_deg: { v: +s1.toFixed(2), u: '°', g: 'event', s: 'horizons', calc: true, calcNote: 'horizons' }, elong: { v: +Math.min(A[i].elong, B[i].elong).toFixed(1), u: '°', g: 'event', s: 'horizons' } });
    }
  }
}
const c = {}; for (const o of objects) c[o.sub] = (c[o.sub] ?? 0) + 1;
console.log(c);
await writeJson('sky-events.json', { source: { id: 'sky', name: 'IMO (pluies de météores) et JPL Horizons (phénomènes planétaires)', url: HZ.url, license: 'IMO : citation ; JPL Horizons : données publiques NASA/JPL', fetched: todayIso }, objects });
