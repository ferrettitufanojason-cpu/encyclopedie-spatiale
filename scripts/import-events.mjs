// Événements : ondes gravitationnelles (GWOSC — LIGO/Virgo/KAGRA) et éclipses de Soleil / de Lune 2001-2100 (NASA GSFC, F. Espenak).
// -> data/events.json
import { getText, writeJson, slug } from './lib/common.mjs';

const today = new Date().toISOString().slice(0, 10);
const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const objects = [];

/* ---------- ondes gravitationnelles ---------- */
const GW_URL = 'https://gwosc.org/eventapi/json/allevents/';
const RANK = ['GWTC-5.0', 'GWTC-4.1', 'GWTC-4.0', 'GWTC-3-confident', 'GWTC-2.1-confident', 'GWTC-2', 'GWTC-1-confident', 'O4_Discovery_Papers', 'O3_Discovery_Papers'];
const all = Object.values(JSON.parse(await getText(GW_URL, { cacheKey: 'gwosc-allevents.json', ttlHours: 12 })).events);
const groups = new Map(); // regroupe les entrées d'un même événement (même instant à 10 s près)
for (const e of all) {
  const r = RANK.indexOf(e['catalog.shortName']);
  if (r < 0 || e.mass_1_source == null || e.GPS == null) continue;            // catalogues « marginal », « preliminary », IAS… et entrées sans paramètres : écartés
  if (e.p_astro != null && e.p_astro < 0.9) continue;                          // seulement les candidats très probablement astrophysiques
  const k = Math.round(e.GPS / 10);
  const prev = groups.get(k);
  if (!prev || r < prev.r || (r === prev.r && e.version > prev.e.version)) groups.set(k, { r, e });
}
const gpsToDate = gps => { const leap = gps > 1167264017 ? 18 : gps > 1119744016 ? 17 : 16; return new Date((gps + 315964800 - leap) * 1000); };
const nm = (v, lo, up, unit) => (v == null ? null : { v, ...(lo != null ? { em: lo } : {}), ...(up != null ? { ep: up } : {}), u: unit ?? '' });
for (const { e } of groups.values()) {
  const d = gpsToDate(e.GPS), date = d.toISOString().slice(0, 10), time = d.toISOString().slice(11, 19);
  const m1 = e.mass_1_source, m2 = e.mass_2_source;
  const kind = m2 == null ? 'gw' : m1 < 3 && m2 < 3 ? 'bns' : m2 < 3 ? 'nsbh' : 'bbh'; // déduit des masses (seuil ~3 M☉)
  const KIND = { bbh: ['binary black hole merger', 'fusion de deux trous noirs'], bns: ['binary neutron star merger', 'fusion de deux étoiles à neutrons'], nsbh: ['neutron star–black hole merger', 'fusion trou noir – étoile à neutrons'], gw: ['gravitational-wave event', 'événement d’onde gravitationnelle'] }[kind];
  const props = {};
  const P = (k, o, g = 'event') => { if (o) props[k] = { ...o, g, s: 'gwosc' }; };
  props.date = { t: `${date} ${time} UTC`, g: 'event', s: 'gwosc' };
  props.etype = { t: KIND[1], g: 'event', s: 'gwosc', calc: true, calcNote: 'masses' };
  P('gw_m1', nm(m1, e.mass_1_source_lower, e.mass_1_source_upper, 'M☉')); P('gw_m2', nm(m2, e.mass_2_source_lower, e.mass_2_source_upper, 'M☉'));
  P('gw_mf', nm(e.final_mass_source, e.final_mass_source_lower, e.final_mass_source_upper, 'M☉'));
  P('gw_dist', nm(e.luminosity_distance, e.luminosity_distance_lower, e.luminosity_distance_upper, 'Mpc'));
  P('gw_snr', nm(e.network_matched_filter_snr, e.network_matched_filter_snr_lower, e.network_matched_filter_snr_upper, ''));
  if (e.p_astro != null) props.p_astro = { v: e.p_astro, u: '', g: 'event', s: 'gwosc' };
  const name = e.commonName.replace(/_\d{6}$/, '');
  objects.push({ id: `gw-${slug(name)}`, cat: 'other', sub: 'gravitational-wave', name, nameFr: name, code: `${e.commonName} (${e['catalog.shortName']})`, aliases: [e.commonName],
    tags: ['event', 'gravitational-wave', kind], props, src: 'gwosc', gwUrl: e.jsonurl, updated: today, eventDate: date, eventKind: kind });
}
console.log(`  ondes gravitationnelles : ${objects.length}`);

/* ---------- éclipses (catalogues de F. Espenak, NASA GSFC) ---------- */
const FR_TYPE = { T: 'totale', A: 'annulaire', H: 'hybride', P: 'partielle', N: 'par la pénombre' };
const EN_TYPE = { T: 'total', A: 'annular', H: 'hybrid', P: 'partial', N: 'penumbral' };
function parseCatalog(text, lunar) {
  const out = [];
  const rows = text.replace(/<[^>]+>/g, '').split('\n');
  for (const l of rows) {
    const m = l.match(/^\s*(\d{5})\s+(\d{4}) ([A-Z][a-z]{2}) (\d{1,2})\s+(\d\d):(\d\d):(\d\d)\s+(-?\d+)\s+(\d+)\s+(\d+)\s+([A-Z][a-z0-9+\-]?)\s+(\S{2})\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(.*)$/);
    if (!m) continue;
    const [, no, y, mo, d, hh, mi, ss, dT, luna, saros, type, qse, gamma, mag, rest] = m;
    const td = Date.UTC(+y, MON[mo] - 1, +d, +hh, +mi, +ss), ut = new Date(td - Number(dT) * 1000); // TD -> UT
    const locM = rest.match(/(\d+[NS])\s+(\d+[EW])/);
    const tail = rest.slice(locM ? rest.indexOf(locM[0]) + locM[0].length : 0).trim().split(/\s+/);
    out.push({ no, td, ut, dT: Number(dT), luna: Number(luna), saros: Number(saros), t: type[0], type, gamma: Number(gamma), mag: Number(mag), loc: locM ? `${locM[1]} ${locM[2]}` : null,
      width: !lunar && /^\d+$/.test(tail[1] ?? '') ? Number(tail[1]) : null, dur: !lunar ? (tail[2]?.match(/^\d+m\d+s$/) ? tail[2] : null) : null });
  }
  return out;
}
for (const [lunar, url, label] of [[false, 'https://eclipse.gsfc.nasa.gov/SEcat5/SE2001-2100.html', 'solaires'], [true, 'https://eclipse.gsfc.nasa.gov/LEcat5/LE2001-2100.html', 'lunaires']]) {
  const rows = parseCatalog(await getText(url, { cacheKey: `ecl-${lunar ? 'L' : 'S'}.html`, ttlHours: 24 * 7 }), lunar);
  for (const r of rows) {
    const date = r.ut.toISOString().slice(0, 10), time = r.ut.toISOString().slice(11, 16);
    const kindEn = `${EN_TYPE[r.t] ?? r.t} ${lunar ? 'lunar' : 'solar'} eclipse`, kindFr = lunar ? `éclipse lunaire ${FR_TYPE[r.t] ?? r.t}` : `éclipse solaire ${FR_TYPE[r.t] ?? r.t}`;
    const props = {};
    props.date = { t: `${date} ${time} UT`, g: 'event', s: 'nasaecl' };
    props.etype = { t: kindFr, g: 'event', s: 'nasaecl' };
    props.gamma = { v: r.gamma, u: '', g: 'event', s: 'nasaecl' }; props.ecl_mag = { v: r.mag, u: '', g: 'event', s: 'nasaecl' };
    props.saros = { t: String(r.saros), g: 'event', s: 'nasaecl' };
    if (r.loc) props.ecl_loc = { t: r.loc, g: 'event', s: 'nasaecl' };
    if (r.width) props.ecl_width = { v: r.width, u: 'km', g: 'event', s: 'nasaecl' };
    if (r.dur) props.ecl_dur = { t: r.dur.replace('m', ' min ').replace('s', ' s'), g: 'event', s: 'nasaecl' };
    objects.push({ id: `${lunar ? 'lunar' : 'solar'}-eclipse-${date}`, cat: 'other', sub: lunar ? 'lunar-eclipse' : 'solar-eclipse', name: `${kindEn[0].toUpperCase()}${kindEn.slice(1)} — ${date}`,
      nameFr: `${kindFr[0].toUpperCase()}${kindFr.slice(1)} — ${date}`, code: `${lunar ? 'LE' : 'SE'} ${r.no}`, aliases: [`Saros ${r.saros}`], tags: ['event', lunar ? 'lunar-eclipse' : 'solar-eclipse', EN_TYPE[r.t] ?? r.t], props, src: 'nasaecl',
      updated: today, eventDate: date, eventKind: r.t, lunar });
  }
  console.log(`  éclipses ${label} : ${rows.length}`);
}
await writeJson('events.json', { source: { id: 'events', name: 'GWOSC (LIGO/Virgo/KAGRA) et NASA GSFC Eclipse Web Site', url: 'https://gwosc.org/', license: 'GWOSC : CC BY 4.0 ; éclipses : F. Espenak, NASA GSFC (citation demandée)', fetched: today }, objects });
const c = {}; for (const o of objects) c[o.sub] = (c[o.sub] ?? 0) + 1; console.log(c);
