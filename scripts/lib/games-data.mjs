// Données compactes pour les jeux (public/data/jeux.json), extraites des MÊMES objets que le reste du site.
import { MOON_TRAITS, MISSION_GOALS } from '../../lib/games-content.mjs';
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
  const byId = new Map(objects.map(o => [o.id, o]));
  const imgOf = id => { const m = images[id]; return m ? { src: m.thumb ?? m.url, alt: m.alt ?? id, credit: m.credit, license: m.license, source: m.source, kind: m.kind ?? null } : null; };
  const ly = o => { const d = pos(o?.props?.dist); return d == null ? null : d * PC_LY; };

  // « Qui est le plus grand ? » : corps du Système solaire (rayon km, masse kg, température K ; null si inconnue)
  const bodies = objects.filter(o => o.src === 'ssod' && pos(o.props.radius)).map(o => [o.id, o.name, o.nameFr ?? o.name, o.sub, pos(o.props.radius), pos(o.props.mass), pos(o.props.teq)]);

  // lunes et missions : description du site (même texte que la fiche) + image créditée
  const withDesc = ids => ids.map(id => byId.get(id)).filter(o => o?.desc).map(o => ({ i: o.id, n: o.name, nf: o.nameFr ?? o.name, desc: o.desc, img: imgOf(o.id) }));
  const moons = withDesc(MOON_TRAITS.map(t => t.id));
  const missions = withDesc(MISSION_GOALS.map(t => t.id)).map(m => ({ ...m, launch: byId.get(m.i).props.launch?.t ?? byId.get(m.i).launchDate ?? null }));

  // « Vie d'une étoile » : vrais exemples de chaque fin de vie présents dans l'encyclopédie
  // les trous noirs supermassifs (ex. Sagittarius A*) ne proviennent pas de la mort d'une étoile : écartés
  const remnants = objects.filter(o => ['brown-dwarf', 'white-dwarf', 'neutron-star', 'pulsar', 'magnetar', 'black-hole'].includes(o.sub) && !o.tags?.includes('supermassive'))
    .map(o => [o.id, o.name, o.sub === 'pulsar' || o.sub === 'magnetar' ? 'neutron-star' : o.sub, ly(o) == null ? null : Math.round(ly(o))]);

  // « Zoom sur l'univers » : chaque étape est une valeur de l'encyclopédie (rien n'est saisi à la main) ; étape absente si la donnée manque
  const KM_LY = 9.4607e12;
  const farthest = objects.filter(o => ly(o) && !['gravitational-wave'].includes(o.sub)).sort((a, b) => ly(b) - ly(a))[0];
  const step = (key, id, km, what) => (km > 0 ? { key, i: id, n: byId.get(id)?.name, nf: byId.get(id)?.nameFr ?? byId.get(id)?.name, km, what } : null);
  const zoom = [
    step('earth', 'earth', pos(byId.get('earth')?.props.radius), 'radius'),
    step('moon', 'moon', pos(byId.get('moon')?.props.sma), 'sma'),
    step('sun', 'earth', pos(byId.get('earth')?.props.sma), 'sma'),
    step('neptune', 'neptune', pos(byId.get('neptune')?.props.sma), 'sma'),
    step('proxima', 'proxima-cen', ly(byId.get('proxima-cen')) * KM_LY, 'dist'),
    step('galaxy', 'cygnus-x-1', ly(byId.get('cygnus-x-1')) * KM_LY, 'dist'),
    step('lmc', 'large-magellanic-cloud', ly(byId.get('large-magellanic-cloud')) * KM_LY, 'dist'),
    step('andromeda', 'andromeda-galaxy', ly(byId.get('andromeda-galaxy')) * KM_LY, 'dist'),
    farthest ? step('farthest', farthest.id, ly(farthest) * KM_LY, 'dist') : null,
  ].filter(Boolean).map(s => ({ ...s, img: imgOf(s.i) }));

  // « Trous noirs : vrai ou faux ? » : trous noirs de masse stellaire dont la distance est connue
  const blackHoles = objects.filter(o => o.sub === 'black-hole' && ly(o)).map(o => [o.id, o.name, Math.round(ly(o))]);

  // « Chasseur d'exoplanètes » : planètes découvertes par transit, avec rayon, rayon de l'étoile et période connus
  const R_EARTH_SUN = 6371.0084 / 695700;
  const transits = [];
  for (const o of objects) {
    if (o.cat !== 'exoplanet' || !/transit/i.test(o.disc?.method ?? '')) continue;
    const r = o.props.radius?.u === 'R⊕' ? pos(o.props.radius) : null, rs = o.props.st_rad?.u === 'R☉' ? pos(o.props.st_rad) : null, per = pos(o.props.period);
    if (r == null || rs == null || per == null) continue;
    const depth = (r * R_EARTH_SUN / rs) ** 2; // fraction de lumière masquée
    if (depth >= 0.002 && depth < 0.05) transits.push([o.id, o.name, r, rs, per, Number(depth.toPrecision(4))]); // baisse d'au moins 0,2 % : visible sur la courbe
  }

  transits.sort((a, b) => a[0].localeCompare(b[0]));
  const transitsKept = transits.filter((t, k) => k % Math.max(1, Math.ceil(transits.length / 500)) === 0); // ~500 planètes suffisent au jeu

  // « Relie les étoiles » : les étoiles les plus brillantes de constellations connues (positions SIMBAD) + carte officielle UAI
  const CONST = ['orion', 'ursa-major', 'cassiopeia', 'cygnus', 'scorpius', 'leo', 'crux', 'lyra', 'gemini', 'taurus', 'ursa-minor', 'andromeda'];
  const constellations = CONST.map(k => byId.get(`constellation-${k}`)).filter(Boolean).map(c => {
    const stars = objects.filter(o => o.constId === c.id && o.cat === 'star' && typeof o.ra === 'number' && typeof o.dec === 'number' && num(o.props.vmag) != null)
      .sort((a, b) => a.props.vmag.v - b.props.vmag.v)
      .filter((o, k, arr) => !arr.slice(0, k).some(p => Math.abs(p.ra - o.ra) < 0.02 && Math.abs(p.dec - o.dec) < 0.02)) // même étoile sous deux noms (ex. Alnitak / ζ Ori A)
      .slice(0, 7).map(o => [o.id, o.name, o.ra, o.dec, o.props.vmag.v]);
    return { i: c.id, n: c.name, nf: c.nameFr ?? c.name, stars, chart: imgOf(c.id) };
  }).filter(c => c.stars.length >= 5);

  // « Le ciel de ce soir » : événements des 18 prochains mois
  const until = new Date(Date.parse(built) + 548 * 86400000).toISOString().slice(0, 10);
  const EV = ['meteor-shower', 'solar-eclipse', 'lunar-eclipse', 'opposition', 'elongation', 'conjunction'];
  const events = objects.filter(o => EV.includes(o.sub) && o.eventDate && o.eventDate >= built && o.eventDate <= until).sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    .map(o => ({ i: o.id, n: o.name, nf: o.nameFr ?? o.name, s: o.sub, date: o.eventDate, zhr: num(o.props.zhr), v: pos(o.props.met_v), sep: num(o.props.sep_deg), mag: num(o.props.app_mag) }));

  // « Choisis ta destination » : la Lune, les planètes, Pluton et l'étoile la plus proche, avec leurs vraies valeurs
  const destinations = ['moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'proxima-cen'].map(id => byId.get(id)).filter(Boolean).map(o => ({
    i: o.id, n: o.name, nf: o.nameFr ?? o.name, s: o.sub, kind: o.id === 'moon' ? 'moon' : o.cat === 'star' ? 'star' : 'planet',
    sma: pos(o.props.sma), km: ly(o) ? ly(o) * KM_LY : null, g: pos(o.props.gravity), teq: pos(o.props.teq), img: imgOf(o.id),
  })).filter(o => (o.kind === 'star' ? o.km : o.sma));

  return { built, planets, exoplanets, destinations, exoFields: ['i', 'n', 'sma_au', 'hz_inner_au', 'hz_outer_au', 'in_hz', 'teq_K', 'radius_earth', 'star_teff_K', 'host', 'distance_ly'],
    bodies, bodyFields: ['i', 'n', 'nf', 'sub', 'radius_km', 'mass_kg', 'teq_K'], moons, missions, remnants, zoom, blackHoles, transits: transitsKept, transitFields: ['i', 'n', 'radius_earth', 'star_radius_sun', 'period_days', 'depth'], constellations, events };
}
