// Générateurs des autres jeux (/jeux/) — même règle que lib/games.mjs : uniquement les données du site, jamais une valeur manquante.
// Chaque question renvoie { q, choices:[{id,label}], answer, explain, objects:[{id,n}], unlock:[{id,n,k}] }.
import { pick, shuffle, fmt, nameOf } from './games.mjs';
import { MOON_TRAITS, MISSION_GOALS, BH_STATEMENTS, STAR_FATES, fateOf, lifetimeGyr } from './games-content.mjs';

const tx = (lang, fr, en) => (lang === 'en' ? en : fr);
const C = k => k - 273.15;
const nm = (o, lang) => (lang === 'fr' ? o.nf ?? o.n : o.n);
// arrondi parlant : 2 chiffres significatifs, en millions / milliards au-delà
export function approx(x, lang) {
  const big = [[1e9, 'milliards', 'billion'], [1e6, 'millions', 'million']].find(([v]) => x >= v);
  if (big) return `${Number((x / big[0]).toPrecision(2)).toLocaleString(lang === 'en' ? 'en' : 'fr')} ${lang === 'en' ? big[2] : big[1]}`;
  return x.toLocaleString(lang === 'en' ? 'en' : 'fr', { maximumSignificantDigits: 2 });
}
export const bodyFromRow = r => ({ i: r[0], n: r[1], nf: r[2], s: r[3], r: r[4], m: r[5], teq: r[6] });

/* ---------- Qui est le plus grand ? ---------- */
const CRIT = {
  radius: { key: 'r', fr: ['Lequel est le plus grand ?', 'plus grand'], en: ['Which one is bigger?', 'bigger'] },
  teq: { key: 'teq', fr: ['Lequel est le plus chaud ?', 'plus chaud'], en: ['Which one is hotter?', 'hotter'] },
  mass: { key: 'm', fr: ['Lequel est le plus lourd ?', 'plus lourd'], en: ['Which one is heavier?', 'heavier'] },
};
const valText = (crit, b, lang, mode) => {
  const s = mode === 'simple';
  if (crit === 'radius') return s ? tx(lang, `${approx(b.r * 2, lang)} km de diamètre`, `${approx(b.r * 2, lang)} km across`) : tx(lang, `rayon moyen ${fmt(b.r, lang, 5)} km`, `mean radius ${fmt(b.r, lang, 5)} km`);
  if (crit === 'teq') return s ? tx(lang, `environ ${Math.round(C(b.teq))} °C`, `about ${Math.round(C(b.teq))} °C`) : tx(lang, `température moyenne ${fmt(b.teq, lang, 4)} K`, `mean temperature ${fmt(b.teq, lang, 4)} K`);
  return s ? tx(lang, `${approx(b.m / 5.9722e24, lang)} fois la masse de la Terre`, `${approx(b.m / 5.9722e24, lang)} times Earth’s mass`) : tx(lang, `masse ${b.m.toExponential(3).replace('.', lang === 'fr' ? ',' : '.')} kg`, `mass ${b.m.toExponential(3)} kg`);
};
/** Deux astres et un critère tiré au hasard ; seuls des astres dont la valeur est connue, et assez différents (≥ 10 %) pour ne pas être ambigus. */
export function biggerQuestion(rows, rng, lang = 'fr', mode = 'simple') {
  const all = rows.map(bodyFromRow).filter(b => b.s !== 'moon' || b.r >= 150); // lunes de moins de 300 km de diamètre : peu parlantes
  for (let tries = 0; tries < 50; tries++) {
    const crit = pick(Object.keys(CRIT), rng), k = CRIT[crit].key;
    const pool = all.filter(b => b[k] > 0);
    if (pool.length < 2) continue;
    const a = pick(pool, rng), b = pick(pool, rng);
    if (a.i === b.i || Math.max(a[k], b[k]) / Math.min(a[k], b[k]) < 1.1) continue;
    const win = a[k] > b[k] ? a : b, lose = win === a ? b : a, ratio = win[k] / lose[k];
    return {
      kind: 'bigger', crit, q: CRIT[crit][lang][0], choices: [a, b].map(o => ({ id: o.i, label: nm(o, lang) })), answer: win.i,
      // tournures neutres (pas d'accord à faire entre « la Lune », « le Soleil », « Io »…)
      explain: `${nm(win, lang)}${tx(lang, ' : ', ': ')}${valText(crit, win, lang, mode)}${tx(lang, ' ; ', '; ')}${nm(lose, lang)}${tx(lang, ' : ', ': ')}${valText(crit, lose, lang, mode)}. ${crit === 'teq'
        ? tx(lang, `Il fait donc plus chaud sur ${nm(win, lang)}.`, `So it is hotter on ${nm(win, lang)}.`)
        : crit === 'radius'
          ? tx(lang, `Rapport des diamètres : environ ${approx(ratio, lang)}.`, `${nm(win, lang)} is about ${approx(ratio, lang)} times as wide as ${nm(lose, lang)}.`)
          : tx(lang, `Rapport des masses : environ ${approx(ratio, lang)}.`, `${nm(win, lang)} is about ${approx(ratio, lang)} times as massive as ${nm(lose, lang)}.`)}`,
      objects: [win, lose].map(o => ({ id: o.i, n: nm(o, lang) })), unlock: [{ id: win.i, n: nm(win, lang), k: 'body' }],
    };
  }
  return null;
}

/* ---------- lunes et missions : association (plateau) et question simple ---------- */
const sentences = s => s.match(/[^.!?]+[.!?]+(\s|$)/g)?.map(x => x.trim()) ?? [s];
// phrase de la description (celle de la fiche) qui contient le fait demandé ; même position dans la version anglaise
export function factSentence(desc, kw, lang) {
  const fr = sentences(desc.fr), k = Math.max(0, fr.findIndex(x => kw.test(x)));
  const L = sentences(desc[lang] ?? desc.fr); return (L[k] ?? L[0]).trim();
}
function matchSet(items, table, rng, n, lang, kindUnlock) {
  const usable = items.filter(o => table.some(t => t.id === o.i));
  if (usable.length < n) return null;
  const chosen = shuffle(usable, rng).slice(0, n);
  const traits = chosen.map(o => { const t = table.find(x => x.id === o.i); return { id: o.i, label: t[lang] }; });
  return { left: chosen.map(o => ({ id: o.i, label: nm(o, lang), img: o.img })), right: shuffle(traits, rng), answer: Object.fromEntries(chosen.map(o => [o.i, o.i])),
    explain: Object.fromEntries(chosen.map(o => [o.i, factSentence(o.desc, table.find(t => t.id === o.i).kw, lang)])), unlock: chosen.map(o => ({ id: o.i, n: nm(o, lang), k: kindUnlock })) };
}
export const moonsMatch = (moons, rng, lang = 'fr', n = 4) => matchSet(moons, MOON_TRAITS, rng, n, lang, 'moon');
export const missionsMatch = (missions, rng, lang = 'fr', n = 4) => matchSet(missions, MISSION_GOALS, rng, n, lang, 'mission');
function singleFromTable(items, table, rng, lang, q, kindUnlock) {
  const usable = items.filter(o => table.some(t => t.id === o.i));
  if (usable.length < 4) return null;
  const opts = shuffle(usable, rng).slice(0, 4), target = opts[0], t = table.find(x => x.id === target.i);
  return { kind: kindUnlock, q: `${q} « ${t[lang]} »`, choices: shuffle(opts, rng).map(o => ({ id: o.i, label: nm(o, lang) })), answer: target.i,
    explain: factSentence(target.desc, t.kw, lang), objects: [{ id: target.i, n: nm(target, lang) }], unlock: [{ id: target.i, n: nm(target, lang), k: kindUnlock }] };
}
export const moonQuestion = (moons, rng, lang = 'fr') => singleFromTable(moons, MOON_TRAITS, rng, lang, tx(lang, 'Quelle lune a cette particularité :', 'Which moon has this feature:'), 'moon');
export const missionQuestion = (missions, rng, lang = 'fr') => singleFromTable(missions, MISSION_GOALS, rng, lang, tx(lang, 'Quelle mission avait cet objectif :', 'Which mission had this goal:'), 'mission');

/* ---------- Trous noirs : vrai ou faux ? ---------- */
/** Affirmation générale (textes relus contre les fiches) ou affirmation chiffrée tirée des données (distance réelle ou fausse ×10). */
export function bhQuestion(blackHoles, rng, lang = 'fr') {
  const fromData = blackHoles.length && rng() < 0.35;
  if (fromData) {
    const [id, n, dist] = pick(blackHoles, rng), ok = rng() < 0.5, shown = ok ? dist : rng() < 0.5 ? dist * 10 : dist / 10;
    const d = fmt(shown, lang, 2);
    return { kind: 'bh', q: tx(lang, `Le trou noir ${n} se trouve à environ ${d} années-lumière de nous.`, `The black hole ${n} is about ${d} light-years away.`),
      choices: [{ id: 'true', label: tx(lang, 'Vrai', 'True') }, { id: 'false', label: tx(lang, 'Faux', 'False') }], answer: ok ? 'true' : 'false',
      explain: tx(lang, `Sa distance, d’après SIMBAD : environ ${fmt(dist, lang, 2)} années-lumière. Il est donc dans notre galaxie, la Voie lactée.`, `Its distance, from SIMBAD: about ${fmt(dist, lang, 2)} light-years. So it is inside our galaxy, the Milky Way.`),
      objects: [{ id, n }], unlock: ok ? [{ id, n, k: 'black-hole' }] : [] };
  }
  const s = pick(BH_STATEMENTS, rng);
  return { kind: 'bh', q: s[lang], choices: [{ id: 'true', label: tx(lang, 'Vrai', 'True') }, { id: 'false', label: tx(lang, 'Faux', 'False') }], answer: s.ok ? 'true' : 'false',
    explain: s.why[lang], objects: s.id ? [{ id: s.id, n: s.id === 'sagittarius-a' ? 'Sagittarius A*' : 'Cygnus X-1' }] : [], unlock: s.id ? [{ id: s.id, n: s.id === 'sagittarius-a' ? 'Sagittarius A*' : 'Cygnus X-1', k: 'black-hole' }] : [] };
}

/* ---------- Vie d'une étoile ---------- */
export function starLife(mass, lang = 'fr') {
  const f = fateOf(mass), life = mass >= 0.08 ? lifetimeGyr(mass) : null;
  return { fate: f.fate, title: f[lang][0], text: f[lang][1], lifeGyr: life };
}
export function starFateQuestion(rng, lang = 'fr') {
  // masses choisies loin des seuils (approximatifs) pour qu'une seule réponse soit juste
  const m = pick([0.03, 0.05, 0.3, 0.5, 1, 2, 4, 12, 15, 40, 60], rng), f = fateOf(m);
  return { kind: 'star', q: tx(lang, `Comment finira une étoile de ${fmt(m, lang, 2)} fois la masse du Soleil ?`, `How will a star of ${fmt(m, lang, 2)} solar masses end?`),
    choices: STAR_FATES.map(x => ({ id: x.fate, label: x[lang][0] })), answer: f.fate, explain: f[lang][1], objects: [], unlock: [] };
}

/* ---------- Chasseur d'exoplanètes : courbe de lumière simplifiée ---------- */
export const transitFromRow = r => ({ i: r[0], n: r[1], r: r[2], rs: r[3], per: r[4], depth: r[5] });
/** Profondeur et période réelles ; forme, durée (4 % de la période) et bruit simulés. Renvoie les points et les fenêtres de transit. */
export function transitCurve(row, rng, { points = 240, periods = 2.6, noise = 0.25 } = {}) {
  const t = transitFromRow(row), span = t.per * periods, t0 = (0.15 + rng() * 0.5) * t.per, dur = t.per * 0.04;
  const dips = []; for (let c = t0; c < span; c += t.per) dips.push([c - dur / 2, c + dur / 2]);
  const gauss = () => { let u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const pts = Array.from({ length: points }, (_, k) => { const x = (k / (points - 1)) * span; const inDip = dips.some(([a, b]) => x >= a && x <= b); return [x, 1 - (inDip ? t.depth : 0) + gauss() * t.depth * noise]; });
  return { planet: t, span, dips, pts };
}
export const transitRadius = t => Math.sqrt(t.depth) * t.rs * 695700 / 6371.0084; // R⊕, à comparer au rayon publié

/* ---------- Relie les étoiles ---------- */
/** Projection simple (plan tangent) des étoiles de la constellation dans un carré [0,1]², nord en haut, est à gauche comme sur une carte du ciel. */
export function projectStars(stars) {
  const toR = d => (d * Math.PI) / 180;
  // centre en RA par moyenne circulaire (gère les constellations à cheval sur 0 h)
  const ra0 = Math.atan2(stars.reduce((s, x) => s + Math.sin(toR(x[2])), 0), stars.reduce((s, x) => s + Math.cos(toR(x[2])), 0)), dec0 = toR(stars.reduce((s, x) => s + x[3], 0) / stars.length);
  const xy = stars.map(([, , ra, dec]) => { const a = toR(ra) - ra0, d = toR(dec), c = Math.sin(dec0) * Math.sin(d) + Math.cos(dec0) * Math.cos(d) * Math.cos(a);
    return [-(Math.cos(d) * Math.sin(a)) / c, (Math.cos(dec0) * Math.sin(d) - Math.sin(dec0) * Math.cos(d) * Math.cos(a)) / c]; });
  const xs = xy.map(p => p[0]), ys = xy.map(p => p[1]), w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys), sc = 1 / Math.max(w, h, 1e-9);
  const ox = (1 - w * sc) / 2, oy = (1 - h * sc) / 2;
  return xy.map(([x, y], k) => ({ id: stars[k][0], n: stars[k][1], mag: stars[k][4], x: ox + (x - Math.min(...xs)) * sc, y: 1 - (oy + (y - Math.min(...ys)) * sc) }));
}
export function brightestQuestion(c, lang = 'fr') {
  const best = [...c.stars].sort((a, b) => a[4] - b[4])[0];
  return { kind: 'const', q: tx(lang, `Quelle est l’étoile la plus brillante de la constellation ${nm(c, lang)} ?`, `Which is the brightest star in ${nm(c, lang)}?`),
    choices: c.stars.slice(0, 5).map(s => ({ id: s[0], label: s[1] })).sort((a, b) => a.label.localeCompare(b.label)), answer: best[0],
    explain: tx(lang, `${best[1]} : magnitude ${fmt(best[4], lang, 3)} (SIMBAD). Plus la magnitude est petite, plus l’étoile est brillante.`, `${best[1]}: magnitude ${fmt(best[4], lang, 3)} (SIMBAD). The smaller the magnitude, the brighter the star.`),
    objects: [{ id: best[0], n: best[1] }, { id: c.i, n: nm(c, lang) }], unlock: [{ id: best[0], n: best[1], k: 'star' }, { id: c.i, n: nm(c, lang), k: 'constellation' }] };
}

/* ---------- Le ciel de ce soir ---------- */
const ECL = {
  'solar-eclipse': [[/annular/i, 'annular'], [/total/i, 'total'], [/hybrid/i, 'hybrid'], [/partial/i, 'partial']],
  'lunar-eclipse': [[/penumbral/i, 'penumbral'], [/total/i, 'total'], [/partial/i, 'partial']],
};
const ECL_L = { annular: ['annulaire', 'annular'], total: ['totale', 'total'], hybrid: ['hybride', 'hybrid'], partial: ['partielle', 'partial'], penumbral: ['par la pénombre', 'penumbral'] };
export function eventKind(e) {
  if (ECL[e.s]) return ECL[e.s].find(([re]) => re.test(e.n))?.[1] ?? null;
  if (e.s === 'elongation') return /morning|western/i.test(e.n) ? 'morning' : /evening|eastern/i.test(e.n) ? 'evening' : null;
  return null;
}
/** Une question par événement, calculée depuis ses données ; null si l'événement n'a pas la donnée nécessaire. */
export function eventQuestion(e, events, rng, lang = 'fr') {
  const L = lang === 'en' ? 1 : 0, base = { kind: 'sky', objects: [{ id: e.i, n: nm(e, lang) }], unlock: [{ id: e.i, n: nm(e, lang), k: 'event' }] };
  const distinct = (vals, v) => shuffle([...new Set(vals.filter(x => x != null && x !== v))], rng).slice(0, 2);
  if (e.s === 'meteor-shower' && e.zhr > 0) {
    const others = distinct(events.filter(x => x.s === 'meteor-shower' && x.zhr > 0 && Math.abs(x.zhr - e.zhr) / e.zhr > 0.3).map(x => x.zhr), e.zhr);
    if (others.length < 2) return null;
    return { ...base, q: tx(lang, `${nm(e, lang)} : combien d’étoiles filantes par heure au maximum, dans un ciel idéal (ZHR) ?`, `${nm(e, lang)}: how many meteors per hour at most, under an ideal sky (ZHR)?`),
      choices: shuffle([e.zhr, ...others], rng).map(v => ({ id: String(v), label: String(v) })), answer: String(e.zhr),
      explain: tx(lang, `Le ZHR de cette pluie est ${e.zhr} (données IMO). En réalité on en voit moins : lune, pollution lumineuse et hauteur du radiant réduisent le nombre.`, `This shower’s ZHR is ${e.zhr} (IMO data). In practice you see fewer: moonlight, light pollution and radiant height reduce the count.`) };
  }
  if (ECL[e.s]) {
    const k = eventKind(e); if (!k) return null;
    const opts = ECL[e.s].map(x => x[1]);
    return { ...base, q: tx(lang, `L’éclipse du ${e.date} : de quel type est-elle ?`, `The eclipse on ${e.date}: what type is it?`),
      choices: opts.map(o => ({ id: o, label: ECL_L[o][L] })), answer: k,
      explain: e.s === 'solar-eclipse'
        ? tx(lang, `C’est une éclipse ${ECL_L[k][0]} (catalogue NASA). ${k === 'annular' ? 'La Lune, un peu trop loin, ne cache pas tout le Soleil : il reste un anneau lumineux.' : k === 'total' ? 'La Lune cache entièrement le Soleil, mais seulement sur une étroite bande de la Terre.' : k === 'partial' ? 'La Lune ne cache qu’une partie du Soleil.' : 'Elle est totale à certains endroits et annulaire à d’autres.'} Ne jamais regarder le Soleil sans protection adaptée !`,
          `It is a${k === 'annular' ? 'n' : ''} ${ECL_L[k][1]} eclipse (NASA catalogue). Never look at the Sun without proper protection!`)
        : tx(lang, `C’est une éclipse ${ECL_L[k][0]} (catalogue NASA). La Lune passe dans l’ombre de la Terre ; on peut l’observer sans danger, à l’œil nu.`, `It is a ${ECL_L[k][1]} eclipse (NASA catalogue). The Moon passes through Earth’s shadow; it is safe to watch with the naked eye.`) };
  }
  if (e.s === 'elongation') {
    const k = eventKind(e); if (!k) return null;
    return { ...base, q: tx(lang, `${nm(e, lang)} : quand faut-il regarder ?`, `${nm(e, lang)}: when should you look?`),
      choices: [{ id: 'morning', label: tx(lang, 'Le matin, avant le lever du Soleil', 'In the morning, before sunrise') }, { id: 'evening', label: tx(lang, 'Le soir, après le coucher du Soleil', 'In the evening, after sunset') }], answer: k,
      explain: tx(lang, `À l’élongation ${k === 'morning' ? 'ouest, la planète se lève avant le Soleil : on la voit le matin' : 'est, la planète se couche après le Soleil : on la voit le soir'}.`, `At ${k === 'morning' ? 'western elongation the planet rises before the Sun: look in the morning' : 'eastern elongation the planet sets after the Sun: look in the evening'}.`) };
  }
  if (e.s === 'opposition') {
    return { ...base, q: tx(lang, `${nm(e, lang)} : quand la planète est-elle visible ?`, `${nm(e, lang)}: when is the planet visible?`),
      choices: [{ id: 'night', label: tx(lang, 'Toute la nuit', 'All night long') }, { id: 'morning', label: tx(lang, 'Seulement le matin', 'Only in the morning') }, { id: 'noon', label: tx(lang, 'À midi', 'At noon') }], answer: 'night',
      explain: tx(lang, `À l’opposition, la planète est à l’opposé du Soleil dans le ciel : elle se lève au coucher du Soleil et reste visible toute la nuit${e.mag != null ? ` (magnitude ${fmt(e.mag, lang, 2)})` : ''}.`, `At opposition the planet is opposite the Sun in the sky: it rises at sunset and stays visible all night${e.mag != null ? ` (magnitude ${fmt(e.mag, lang, 2)})` : ''}.`) };
  }
  if (e.s === 'conjunction' && e.sep > 0) {
    const vals = [e.sep, e.sep * 5, e.sep * 20].map(v => Number(v.toPrecision(2)));
    return { ...base, q: tx(lang, `${nm(e, lang)} : quel écart apparent sépare les deux planètes dans le ciel ?`, `${nm(e, lang)}: what apparent gap separates the two planets in the sky?`),
      choices: shuffle(vals, rng).map(v => ({ id: String(v), label: `${fmt(v, lang, 2)}°` })), answer: String(vals[0]),
      explain: tx(lang, `Environ ${fmt(e.sep, lang, 2)}° (pour comparer, la pleine Lune mesure environ 0,5°). Les planètes sont en réalité très loin l’une de l’autre : elles sont seulement alignées vues de la Terre.`, `About ${fmt(e.sep, lang, 2)}° (for comparison, the full Moon is about 0.5° wide). The planets are actually very far apart: they only line up as seen from Earth.`) };
  }
  return null;
}

/* ---------- Choisis ta destination ---------- */
export const MU_SUN = 1.32712440018e20, MU_EARTH = 3.986004418e14, C_KMS = 299792.458, PROBE_KMS = 17; // m³/s², km/s
/** Transfert de Hohmann (orbites circulaires et coplanaires supposées) : demi-période de l'ellipse de transfert, en jours. */
export const hohmannDays = (r1km, r2km, mu) => (Math.PI * Math.sqrt((((r1km + r2km) / 2) * 1000) ** 3 / mu)) / 86400;
export function destination(target, earth, lang = 'fr') {
  const out = { i: target.i, name: nm(target, lang) };
  if (target.kind === 'moon') { out.days = hohmannDays(6371 + 200, target.sma, MU_EARTH); out.method = 'hohmann-earth'; out.km = target.sma; }
  else if (target.kind === 'star') { out.km = target.km; out.days = target.km / PROBE_KMS / 86400; out.method = 'constant'; }
  else { out.days = hohmannDays(earth.sma, target.sma, MU_SUN); out.method = 'hohmann-sun'; out.km = Math.abs(target.sma - earth.sma); }
  out.lightMin = out.km / C_KMS / 60; // délai d'un message radio (à la distance minimale pour une planète)
  return out;
}
