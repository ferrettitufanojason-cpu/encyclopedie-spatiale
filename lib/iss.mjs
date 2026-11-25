// Position de l'ISS à partir de l'éphéméride OFFICIELLE de la NASA (JSC) : fichier OEM CCSDS, un vecteur d'état toutes les 4 min.
// https://nasa-public-data.s3.amazonaws.com/iss-coords/current/ISS_OEM/ISS.OEM_J2K_EPH.xml
// Interpolation d'Hermite cubique entre deux vecteurs d'état, puis J2000 -> date (précession) -> terrestre (GMST) -> géodésique WGS84.
export const OEM_URL = 'https://nasa-public-data.s3.amazonaws.com/iss-coords/current/ISS_OEM/ISS.OEM_J2K_EPH.xml';

let cache = { at: 0, states: null };

function epochMs(s) { // "2026-327T12:00:00.000Z" (année-jour de l'année)
  const m = s.match(/^(\d{4})-(\d{3})T(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)Z$/);
  return Date.UTC(+m[1], 0, 1) + (+m[2] - 1) * 86400000 + (+m[3]) * 3600000 + (+m[4]) * 60000 + parseFloat(m[5]) * 1000;
}

export async function loadStates(force = false) {
  if (!force && cache.states && Date.now() - cache.at < 30 * 60000) return cache.states;
  const r = await fetch(OEM_URL, { headers: { 'User-Agent': 'encyclopedie-spatiale/0.1' } });
  if (!r.ok) throw new Error(`OEM HTTP ${r.status}`);
  const xml = await r.text();
  const states = [];
  const re = /<stateVector>([\s\S]*?)<\/stateVector>/g; let m;
  while ((m = re.exec(xml))) {
    const g = k => parseFloat(m[1].match(new RegExp(`<${k}[^>]*>([^<]+)<`))[1]);
    states.push({ t: epochMs(m[1].match(/<EPOCH>([^<]+)</)[1]), p: [g('X'), g('Y'), g('Z')], v: [g('X_DOT'), g('Y_DOT'), g('Z_DOT')] });
  }
  if (states.length < 10) throw new Error('éphéméride vide');
  cache = { at: Date.now(), states };
  return states;
}

function hermite(a, b, t) {
  const dt = (b.t - a.t) / 1000, s = (t - a.t) / (b.t - a.t);
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
  const p = [0, 1, 2].map(i => h00 * a.p[i] + h10 * dt * a.v[i] + h01 * b.p[i] + h11 * dt * b.v[i]);
  const v = [0, 1, 2].map(i => a.v[i] + (b.v[i] - a.v[i]) * s);
  return { p, v };
}

const rad = Math.PI / 180;
function jd(ms) { return ms / 86400000 + 2440587.5; }
const rotZ = (a, [x, y, z]) => [Math.cos(a) * x + Math.sin(a) * y, -Math.sin(a) * x + Math.cos(a) * y, z];
const rotY = (a, [x, y, z]) => [Math.cos(a) * x - Math.sin(a) * z, y, Math.sin(a) * x + Math.cos(a) * z];

/** J2000 (EME2000) -> repère terrestre à la date t (précession IAU 1976 + rotation GMST ; la nutation, < 20″, est négligée). */
function toEcef(p, ms) {
  const T = (jd(ms) - 2451545.0) / 36525;
  const as = Math.PI / 180 / 3600;
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) * as;
  const theta = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) * as;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) * as;
  let r = rotZ(-zeta, p); r = rotY(theta, r); r = rotZ(-z, r);
  let gmst = (67310.54841 + (876600 * 3600 + 8640184.812866) * T + 0.093104 * T * T - 6.2e-6 * T ** 3) % 86400;
  if (gmst < 0) gmst += 86400;
  return rotZ(gmst / 86400 * 2 * Math.PI, r);
}

function geodetic([x, y, zc]) { // WGS84
  const a = 6378.137, f = 1 / 298.257223563, e2 = f * (2 - f);
  const lon = Math.atan2(y, x), pr = Math.hypot(x, y);
  let lat = Math.atan2(zc, pr * (1 - e2));
  for (let i = 0; i < 6; i++) { const N = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2); lat = Math.atan2(zc + e2 * N * Math.sin(lat), pr); }
  const N = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  return { lat: lat / rad, lon: lon / rad, alt: pr / Math.cos(lat) - N };
}

export function positionAt(states, ms) {
  let i = states.findIndex(s => s.t > ms) - 1;
  if (i < 0) return null; // hors de l'intervalle couvert
  const { p, v } = hermite(states[i], states[i + 1] ?? states[i], ms);
  const g = geodetic(toEcef(p, ms));
  return { lat: g.lat, lon: g.lon, alt_km: g.alt, speed_kms: Math.hypot(...v) };
}

export async function issNow(now = Date.now()) {
  let states = await loadStates();
  if (now > states.at(-1).t - 3600e3) states = await loadStates(true);
  const cur = positionAt(states, now);
  if (!cur) throw new Error('instant hors éphéméride');
  const track = [];
  for (let m = -5; m <= 100; m += 1) { const p = positionAt(states, now + m * 60000); if (p) track.push([+p.lat.toFixed(2), +p.lon.toFixed(2), m]); }
  return {
    time: new Date(now).toISOString(), lat: +cur.lat.toFixed(4), lon: +cur.lon.toFixed(4), alt_km: +cur.alt_km.toFixed(1), speed_kms: +cur.speed_kms.toFixed(3),
    speed_kmh: Math.round(cur.speed_kms * 3600), track,
    source: 'NASA JSC — ISS Trajectory Data (OEM)', source_url: 'https://www.nasa.gov/international-space-station/space-station-trajectory-data/',
    ephemeris: { start: new Date(states[0].t).toISOString(), stop: new Date(states.at(-1).t).toISOString() },
  };
}
