// Import NASA Exoplanet Archive (TAP, table pscomppars = toutes les exoplanètes confirmées)
// -> data/exoplanets.json au schéma commun.
import { getText, parseCsv, num, writeJson, slug } from './lib/common.mjs';

const TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
const SRC = { name: 'NASA Exoplanet Archive', url: 'https://exoplanetarchive.ipac.caltech.edu/', license: 'Données publiques NASA/IPAC' };

// [clé, colonne, unité, groupe]  — err1 = +, err2 = − (négatif), lim = limite sup/inf
const PROPS = [
  ['mass', 'pl_bmasse', 'M⊕', 'planet'], ['radius', 'pl_rade', 'R⊕', 'planet'],
  ['period', 'pl_orbper', 'jours', 'planet'], ['sma', 'pl_orbsmax', 'UA', 'planet'],
  ['ecc', 'pl_orbeccen', '', 'planet'], ['incl', 'pl_orbincl', '°', 'planet'],
  ['teq', 'pl_eqt', 'K', 'planet'], ['insol', 'pl_insol', 'S⊕', 'planet'], ['density', 'pl_dens', 'g/cm³', 'planet'],
  ['st_teff', 'st_teff', 'K', 'star'], ['st_rad', 'st_rad', 'R☉', 'star'], ['st_mass', 'st_mass', 'M☉', 'star'],
  ['st_lum', 'st_lum', 'log10(L/L☉)', 'star'], ['st_met', 'st_met', 'dex', 'star'], ['st_age', 'st_age', 'Gyr', 'star'],
  ['dist', 'sy_dist', 'pc', 'sys'], ['vmag', 'sy_vmag', 'mag', 'sys'],
];
const COLS = ['pl_name', 'hostname', 'pl_letter', 'hd_name', 'hip_name', 'tic_id', 'gaia_dr3_id', 'disc_year', 'discoverymethod',
  'disc_facility', 'disc_pubdate', 'sy_snum', 'sy_pnum', 'cb_flag', 'pl_controv_flag', 'pl_bmassprov', 'st_spectype', 'ra', 'dec', 'pl_pubdate',
  'disc_refname',
  ...PROPS.flatMap(([, c]) => [c, c + 'err1', c + 'err2', c + 'lim', c + '_reflink']),
];

function parseRef(html) { // <a refstr=... href=... target=ref>Texte</a>
  if (!html) return null;
  const href = html.match(/href=(?:"|')?([^\s"'>]+)/)?.[1];
  const t = html.replace(/<[^>]+>/g, '').trim();
  return href ? { t, url: href.startsWith('/') ? 'https://exoplanetarchive.ipac.caltech.edu' + href : href } : t ? { t } : null;
}

// Zone habitable conservative (Kopparapu et al. 2013, ApJ 765, 131) : calculée, pas mesurée.
const HZ = { in: [1.0385, 1.2456e-4, 1.4612e-8, -7.6345e-12, -1.7511e-15], out: [0.3507, 5.9578e-5, 1.6707e-9, -3.0058e-12, -5.1925e-16] };
function hzLimits(teff, logL) {
  if (teff == null || logL == null || teff < 2600 || teff > 7200) return null;
  const T = teff - 5780, L = 10 ** logL;
  const f = ([s0, a, b, c, d]) => Math.sqrt(L / (s0 + a * T + b * T ** 2 + c * T ** 3 + d * T ** 4));
  return { inner: f(HZ.in), outer: f(HZ.out) };
}

// Classification par rayon (convention NASA Exoplanet Exploration), repli sur la masse.
function classify(r, m) {
  if (r != null) return r < 1.25 ? 'terrestrial' : r < 2 ? 'super-earth' : r < 6 ? 'neptune-like' : 'gas-giant';
  if (m != null) return m < 2 ? 'terrestrial' : m < 10 ? 'super-earth' : m < 50 ? 'neptune-like' : 'gas-giant';
  return 'unclassified';
}

const url = `${TAP}?query=${encodeURIComponent(`select ${COLS.join(',')} from pscomppars`)}&format=csv`;
console.log('Téléchargement pscomppars…');
const csv = await getText(url, { cacheKey: 'pscomppars.csv', ttlHours: 6, headers: { Accept: 'text/csv' } });
const rows = parseCsv(csv);
console.log(`${rows.length} exoplanètes confirmées reçues`);
const today = new Date().toISOString().slice(0, 10);

const seen = new Set();
const objects = [];
for (const r of rows) {
  const props = {};
  for (const [key, col, unit, group] of PROPS) {
    const v = num(r[col]); if (v == null) continue;
    const p = { v, u: unit };
    const ep = num(r[col + 'err1']), em = num(r[col + 'err2']);
    if (ep != null) p.ep = ep; if (em != null) p.em = em;
    const lim = num(r[col + 'lim']); if (lim) p.lim = lim > 0 ? '<' : '>';
    const ref = parseRef(r[col + '_reflink']); if (ref) p.ref = ref;
    p.g = group; props[key] = p;
  }
  if (r.pl_bmassprov && props.mass) props.mass.note = r.pl_bmassprov; // Mass / Msini / Msin(i)/sin(i)
  const hz = hzLimits(props.st_teff?.v, props.st_lum?.v);
  if (hz && props.sma) {
    const a = props.sma.v;
    props.hz_inner = { v: +hz.inner.toFixed(3), u: 'UA', g: 'calc', calc: true };
    props.hz_outer = { v: +hz.outer.toFixed(3), u: 'UA', g: 'calc', calc: true };
    props.in_hz = { v: a >= hz.inner && a <= hz.outer ? 1 : 0, u: '', g: 'calc', calc: true };
  }
  const sub = classify(props.radius?.v, props.mass?.v);
  const tags = ['exoplanet', sub, (r.discoverymethod || '').toLowerCase().replace(/\s+/g, '-')].filter(Boolean);
  if (props.in_hz?.v === 1) tags.push('habitable-zone');
  if (r.cb_flag === '1') tags.push('circumbinary');
  let id = slug(r.pl_name); if (seen.has(id)) id += '-2'; seen.add(id);
  const aliases = [r.hd_name, r.hip_name, r.tic_id, r.gaia_dr3_id && `Gaia DR3 ${r.gaia_dr3_id.replace(/^Gaia DR3 /, '')}`].filter(Boolean);
  objects.push({
    id, cat: 'exoplanet', sub, name: r.pl_name, code: r.pl_name, aliases, tags,
    host: r.hostname, nPlanets: num(r.sy_pnum), nStars: num(r.sy_snum),
    disc: { year: num(r.disc_year), pubdate: r.disc_pubdate || null, method: r.discoverymethod || null, facility: r.disc_facility || null, ref: parseRef(r.disc_refname) },
    spectype: r.st_spectype || null, ra: num(r.ra), dec: num(r.dec),
    controversial: r.pl_controv_flag === '1',
    props, src: 'nea', updated: r.pl_pubdate || today,
  });
}
await writeJson('exoplanets.json', { source: { ...SRC, id: 'nea', fetched: today, query: 'TAP: select … from pscomppars' }, objects });


