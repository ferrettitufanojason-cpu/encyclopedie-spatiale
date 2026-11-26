// Positions héliocentriques des planètes (et de Pluton) à une date donnée.
// Source : E. M. Standish (JPL), « Keplerian Elements for Approximate Positions of the Major Planets », table 1
// (éléments valables de 1800 à 2050) — https://ssd.jpl.nasa.gov/planets/approx_pos.html
// Pour chaque élément : valeur à J2000.0 puis variation par siècle julien.
// a (UA), e, I (°), L longitude moyenne (°), ϖ longitude du périhélie (°), Ω longitude du nœud ascendant (°).
// La ligne « earth » est en fait le barycentre Terre-Lune (écart avec la Terre ≈ 4 700 km, négligeable ici).
export const ELEMENTS = {
  mercury: [[0.38709927, 0.00000037], [0.20563593, 0.00001906], [7.00497902, -0.00594749], [252.25032350, 149472.67411175], [77.45779628, 0.16047689], [48.33076593, -0.12534081]],
  venus: [[0.72333566, 0.00000390], [0.00677672, -0.00004107], [3.39467605, -0.00078890], [181.97909950, 58517.81538729], [131.60246718, 0.00268329], [76.67984255, -0.27769418]],
  earth: [[1.00000261, 0.00000562], [0.01671123, -0.00004392], [-0.00001531, -0.01294668], [100.46457166, 35999.37244981], [102.93768193, 0.32327364], [0, 0]],
  mars: [[1.52371034, 0.00001847], [0.09339410, 0.00007882], [1.84969142, -0.00813131], [-4.55343205, 19140.30268499], [-23.94362959, 0.44441088], [49.55953891, -0.29257343]],
  jupiter: [[5.20288700, -0.00011607], [0.04838624, -0.00013253], [1.30439695, -0.00183714], [34.39644051, 3034.74612775], [14.72847983, 0.21252668], [100.47390909, 0.20469106]],
  saturn: [[9.53667594, -0.00125060], [0.05386179, -0.00050991], [2.48599187, 0.00193609], [49.95424423, 1222.49362201], [92.59887831, -0.41897216], [113.66242448, -0.28867794]],
  uranus: [[19.18916464, -0.00196176], [0.04725744, -0.00004397], [0.77263783, -0.00242939], [313.23810451, 428.48202785], [170.95427630, 0.40805281], [74.01692503, 0.04240589]],
  neptune: [[30.06992276, 0.00026291], [0.00859048, 0.00005105], [1.77004347, 0.00035372], [-55.12002969, 218.45945325], [44.96476227, -0.32241464], [131.78422574, -0.00508664]],
  pluto: [[39.48211675, -0.00031596], [0.24882730, 0.00005170], [17.14001206, 0.00004818], [238.92903833, 145.20780515], [224.06891629, -0.04062942], [110.30393684, -0.01183482]],
};
export const PLANET_IDS = Object.keys(ELEMENTS);
export const VALID = [Date.UTC(1800, 0, 1), Date.UTC(2050, 11, 31)];
const RAD = Math.PI / 180;
const J2000 = Date.UTC(2000, 0, 1, 12); // 2000-01-01 12:00 (TT ≈ UTC à une minute près, sans effet ici)

// éléments osculateurs à la date (siècles juliens depuis J2000)
function elementsAt(id, ms) {
  const T = (ms - J2000) / 86400000 / 36525;
  const [a, e, I, L, w, O] = ELEMENTS[id].map(([v, r]) => v + r * T);
  return { a, e, I, L, w, O };
}
// position dans le plan de l'orbite pour une anomalie excentrique E, puis rotation vers l'écliptique J2000
function toEcliptic({ a, e, I, w, O }, E) {
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const om = (w - O) * RAD, Om = O * RAD, i = I * RAD;
  const co = Math.cos(om), so = Math.sin(om), cO = Math.cos(Om), sO = Math.sin(Om), ci = Math.cos(i), si = Math.sin(i);
  return {
    x: (co * cO - so * sO * ci) * xp + (-so * cO - co * sO * ci) * yp,
    y: (co * sO + so * cO * ci) * xp + (-so * sO + co * cO * ci) * yp,
    z: (so * si) * xp + (co * si) * yp,
  };
}
// Position héliocentrique écliptique J2000, en UA.
export function helio(id, date = new Date()) {
  const el = elementsAt(id, +date);
  let M = ((el.L - el.w) % 360 + 540) % 360 - 180; // anomalie moyenne ramenée dans [-180°, 180°]
  M *= RAD;
  let E = M + el.e * Math.sin(M);
  for (let k = 0; k < 12; k++) { const dE = (E - el.e * Math.sin(E) - M) / (1 - el.e * Math.cos(E)); E -= dE; if (Math.abs(dE) < 1e-12) break; }
  return toEcliptic(el, E);
}
// Points de l'orbite (pour la dessiner), aux éléments de la date donnée.
export function orbitPoints(id, date = new Date(), n = 180) {
  const el = elementsAt(id, +date);
  return Array.from({ length: n + 1 }, (_, k) => toEcliptic(el, (k / n) * 2 * Math.PI));
}
export const dist = (p, q = { x: 0, y: 0, z: 0 }) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
export const AU_KM = 149597870.7;
export const C_KMS = 299792.458;
