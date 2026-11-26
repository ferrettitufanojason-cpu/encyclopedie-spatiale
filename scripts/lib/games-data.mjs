// Données compactes pour les jeux (public/data/jeux.json), extraites des MÊMES objets que le reste du site.
// Règle : une valeur absente, nulle ou physiquement impossible (ex. 0 K) est laissée à null, et le jeu n'utilise pas cette valeur.
const num = p => (p && typeof p.v === 'number' && Number.isFinite(p.v) ? p.v : null);
const pos = p => { const v = num(p); return v != null && v > 0 ? v : null; }; // grandeurs qui ne peuvent pas être nulles (0 K = valeur manquante dans la source)
const PC_LY = 3.26156;
const PLANET_SUBS = ['terrestrial', 'gas-giant', 'ice-giant'];

export function buildGamesData(objects, images, built) {
  const planets = objects.filter(o => o.cat === 'planet' && PLANET_SUBS.includes(o.sub) && o.rank).sort((a, b) => a.rank - b.rank).map(o => {
    const P = o.props, img = images[o.id];
    return {
      i: o.id, n: o.name, nf: o.nameFr ?? o.name, s: o.sub, rank: o.rank,
      sma: pos(P.sma),                 // km
      teq: pos(P.teq),                 // K
      rot: num(P.rotation) || null,    // h (négatif = rotation rétrograde)
      per: pos(P.period),              // jours
      g: pos(P.gravity),               // m/s²
      tilt: num(P.axial_tilt),         // ° (0 possible)
      r: pos(P.radius),                // km
      m: pos(P.mass),                  // kg
      moons: (o.related ?? []).filter(r => r.rel === 'moon').length, // lunes répertoriées dans l'encyclopédie (source SSOD)
      img: img ? { src: img.thumb ?? img.url, alt: img.alt ?? o.name, credit: img.credit, license: img.license, source: img.source } : null,
    };
  });
  // exoplanètes : seulement celles dont la zone habitable a pu être calculée, avec toutes les valeurs montrées dans le jeu
  const exoplanets = [];
  for (const o of objects) {
    if (o.cat !== 'exoplanet') continue;
    const P = o.props, sma = pos(P.sma), hi = pos(P.hz_inner), ho = pos(P.hz_outer), inHz = num(P.in_hz);
    const teq = pos(P.teq), r = P.radius?.u === 'R⊕' ? pos(P.radius) : null, st = pos(P.st_teff), dist = pos(P.dist);
    if (sma == null || hi == null || ho == null || ho <= hi || (inHz !== 0 && inHz !== 1) || teq == null || r == null || st == null) continue;
    if ((sma >= hi && sma <= ho) !== (inHz === 1)) continue; // incohérence entre le drapeau et les bornes : objet écarté
    exoplanets.push([o.id, o.name, sma, hi, ho, inHz, teq, r, st, o.host ?? null, dist == null ? null : Math.round(dist * PC_LY)]);
  }
  return { built, planets, exoplanets, exoFields: ['i', 'n', 'sma_au', 'hz_inner_au', 'hz_outer_au', 'in_hz', 'teq_K', 'radius_earth', 'star_teff_K', 'host', 'distance_ly'] };
}
