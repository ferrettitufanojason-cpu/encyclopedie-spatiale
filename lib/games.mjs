// Moteur des jeux (/jeux/) : génère questions, indices et corrections UNIQUEMENT à partir des données du site
// (public/data/jeux.json). Une valeur manquante (null) n'est jamais utilisée : l'indice ou l'objet est simplement écarté.
// Module pur (aucun accès au DOM ni au réseau) : utilisé par le navigateur et par les tests (tests/games.test.mjs).

export const EARTH_G = 9.80665, EARTH_R_KM = 6371.0084, AU_KM = 149597870.7;

/* ---------- hasard reproductible ---------- */
export function rngFrom(seed = Date.now()) {
  let a = typeof seed === 'string' ? [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, 1779033703) : seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
export function shuffle(arr, rng) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ---------- mise en forme ---------- */
export const nameOf = (o, lang) => (lang === 'fr' ? o.nf ?? o.n : o.n);
export function fmt(x, lang, digits = 3) {
  const loc = lang === 'en' ? 'en' : 'fr';
  if (Math.abs(x) >= 1000) return Math.round(x).toLocaleString(loc);
  return Number(x.toPrecision(digits)).toLocaleString(loc, { maximumFractionDigits: 6 });
}
const C = k => k - 273.15;
const tx = (lang, fr, en) => (lang === 'en' ? en : fr);

/* ---------- 1. L'ordre des planètes ---------- */
// Toutes les planètes doivent avoir un demi-grand axe connu, sinon le jeu n'est pas proposé.
export function orderPuzzle(planets, rng) {
  if (planets.length < 2 || planets.some(p => !(p.sma > 0))) return null;
  const answer = [...planets].sort((a, b) => a.sma - b.sma).map(p => p.i);
  let start; do { start = shuffle(answer, rng); } while (start.every((id, k) => id === answer[k]));
  return { answer, start };
}
/** Compare une proposition à la bonne réponse ; renvoie le nombre de positions justes et un indice sur la première erreur. */
export function checkOrder(planets, answer, attempt, lang = 'fr', mode = 'simple') {
  const by = Object.fromEntries(planets.map(p => [p.i, p]));
  const good = attempt.filter((id, k) => id === answer[k]).length;
  const k = attempt.findIndex((id, j) => id !== answer[j]);
  if (k < 0) return { ok: true, good };
  const closer = by[answer[k]], placed = by[attempt[k]]; // « closer » doit venir avant « placed »
  const au = p => fmt(p.sma / AU_KM, lang, 3), mkm = p => fmt(p.sma / 1e6, lang, 3);
  const hint = mode === 'simple'
    ? tx(lang, `Indice : ${nameOf(closer, lang)} est plus proche du Soleil que ${nameOf(placed, lang)}.`, `Hint: ${nameOf(closer, lang)} is closer to the Sun than ${nameOf(placed, lang)}.`)
    : tx(lang, `Indice : demi-grand axe de ${nameOf(closer, lang)} = ${au(closer)} UA (${mkm(closer)} millions de km), celui de ${nameOf(placed, lang)} = ${au(placed)} UA.`,
      `Hint: semi-major axis of ${nameOf(closer, lang)} = ${au(closer)} AU (${mkm(closer)} million km); ${nameOf(placed, lang)}: ${au(placed)} AU.`);
  return { ok: false, good, hint, pair: [closer.i, placed.i] };
}

/* ---------- 2. Devine la planète ---------- */
// Indices tirés des propriétés de la fiche ; chacun n'existe que si la valeur est connue.
// Palier 1 = vague, palier 3 = presque la réponse : moins on en utilise, plus on gagne de points.
export function planetHints(p, lang = 'fr', mode = 'simple') {
  const H = [], isEarth = p.i === 'earth', s = mode === 'simple';
  if (p.tilt != null) H.push({ key: 'tilt', tier: 1, text: s
    ? tx(lang, `Son axe de rotation est penché d'environ ${Math.round(p.tilt)}°${isEarth ? '' : ' (celui de la Terre : 23°)'}.`, `Its spin axis is tilted by about ${Math.round(p.tilt)}°${isEarth ? '' : ' (Earth’s: 23°)'}.`)
    : tx(lang, `Inclinaison de l'axe : ${fmt(p.tilt, lang, 4)}°.`, `Axial tilt: ${fmt(p.tilt, lang, 4)}°.`) });
  if (p.rot != null) {
    const h = Math.abs(p.rot), retro = p.rot < 0;
    const dur = h >= 48 ? tx(lang, `environ ${fmt(h / 24, lang, 2)} jours terrestres`, `about ${fmt(h / 24, lang, 2)} Earth days`) : tx(lang, `environ ${fmt(h, lang, 2)} heures`, `about ${fmt(h, lang, 2)} hours`);
    H.push({ key: 'day', tier: 1, text: s
      ? tx(lang, `Elle fait un tour sur elle-même en ${dur}${retro ? ', et elle tourne dans le sens inverse de la Terre' : ''}.`, `It spins once in ${dur}${retro ? ', and it spins the opposite way to Earth' : ''}.`)
      : tx(lang, `Période de rotation sidérale : ${fmt(p.rot, lang, 5)} h${retro ? ' (rotation rétrograde)' : ''}.`, `Sidereal rotation period: ${fmt(p.rot, lang, 5)} h${retro ? ' (retrograde rotation)' : ''}.`) });
  }
  if (p.g != null) {
    const f = p.g / EARTH_G;
    H.push({ key: 'gravity', tier: 1, text: s
      ? (isEarth ? tx(lang, `Sa gravité est celle que tu ressens tous les jours.`, `Its gravity is the one you feel every day.`)
        : tx(lang, `Un objet y pèse environ ${fmt(f, lang, 2)} fois son poids sur Terre.`, `An object there weighs about ${fmt(f, lang, 2)} times its weight on Earth.`))
      : tx(lang, `Gravité : ${fmt(p.g, lang, 4)} m/s² (Terre : 9,81 m/s²).`, `Gravity: ${fmt(p.g, lang, 4)} m/s² (Earth: 9.81 m/s²).`) });
  }
  if (p.teq != null) H.push({ key: 'temp', tier: 2, text: s
    ? tx(lang, `Il y fait en moyenne environ ${Math.round(C(p.teq))} °C.`, `Its average temperature is about ${Math.round(C(p.teq))} °C.`)
    : tx(lang, `Température moyenne : ${fmt(p.teq, lang, 4)} K (${fmt(C(p.teq), lang, 4)} °C).`, `Average temperature: ${fmt(p.teq, lang, 4)} K (${fmt(C(p.teq), lang, 4)} °C).`) });
  if (p.per != null) H.push({ key: 'year', tier: 2, text: s
    ? (p.per >= 730 ? tx(lang, `Elle met environ ${fmt(p.per / 365.25, lang, 2)} ans à faire le tour du Soleil.`, `It takes about ${fmt(p.per / 365.25, lang, 2)} years to go around the Sun.`)
      : tx(lang, `Elle fait le tour du Soleil en environ ${Math.round(p.per)} jours.`, `It goes around the Sun in about ${Math.round(p.per)} days.`))
    : tx(lang, `Période orbitale : ${fmt(p.per, lang, 6)} jours (${fmt(p.per / 365.25, lang, 4)} ans).`, `Orbital period: ${fmt(p.per, lang, 6)} days (${fmt(p.per / 365.25, lang, 4)} years).`) });
  if (p.r != null) {
    const f = p.r / EARTH_R_KM;
    H.push({ key: 'size', tier: 2, text: s
      ? (isEarth ? tx(lang, `Son rayon mesure environ ${fmt(p.r, lang, 2)} km.`, `Its radius is about ${fmt(p.r, lang, 2)} km.`)
        : f >= 1 ? tx(lang, `Elle est environ ${fmt(f, lang, 2)} fois plus large que la Terre.`, `It is about ${fmt(f, lang, 2)} times as wide as Earth.`)
          : tx(lang, `Sa largeur vaut environ ${Math.round(f * 100)} % de celle de la Terre.`, `Its width is about ${Math.round(f * 100)}% of Earth’s.`))
      : tx(lang, `Rayon moyen : ${fmt(p.r, lang, 5)} km (${fmt(f, lang, 3)} R⊕).`, `Mean radius: ${fmt(p.r, lang, 5)} km (${fmt(f, lang, 3)} R⊕).`) });
  }
  if (Number.isInteger(p.moons)) H.push({ key: 'moons', tier: 3, text: p.moons === 0
    ? tx(lang, `Aucune lune ne lui est connue.`, `It has no known moon.`)
    : s ? tx(lang, `On lui connaît ${p.moons} lune${p.moons > 1 ? 's' : ''}.`, `It has ${p.moons} known moon${p.moons > 1 ? 's' : ''}.`)
      : tx(lang, `Lunes répertoriées dans l'encyclopédie (Système solaire OpenData) : ${p.moons}.`, `Moons listed in the encyclopedia (Système solaire OpenData): ${p.moons}.`) });
  if (Number.isInteger(p.rank)) H.push({ key: 'rank', tier: 3, text: tx(lang, `C'est la ${p.rank === 1 ? '1re' : `${p.rank}e`} planète en partant du Soleil.`, `It is planet number ${p.rank} counting from the Sun.`) });
  return H;
}
/** Choisit une planète et 3 indices (un par palier quand c'est possible). */
export function guessPuzzle(planets, rng, lang = 'fr', mode = 'simple') {
  const usable = planets.filter(p => planetHints(p, lang, mode).length >= 3);
  if (!usable.length) return null;
  const target = pick(usable, rng);
  const all = planetHints(target, lang, mode), hints = [];
  for (const tier of [1, 2, 3]) { const c = all.filter(h => h.tier === tier); if (c.length) hints.push(pick(c, rng)); }
  for (const h of shuffle(all, rng)) if (hints.length < 3 && !hints.includes(h)) hints.push(h);
  hints.sort((a, b) => a.tier - b.tier);
  return { target: target.i, hints: hints.map(h => h.key) };
}
export const GUESS_POINTS = [30, 20, 10]; // trouvée après 1, 2 ou 3 indices

/* ---------- 3. Habitable ou pas ? ---------- */
const EXO = ['i', 'n', 'sma', 'hi', 'ho', 'inHz', 'teq', 'r', 'st', 'host', 'dist'];
export const exoFromRow = row => Object.fromEntries(EXO.map((k, j) => [k, row[j]]));
/** Une planète réelle, une fois sur deux dans la zone habitable (sinon le jeu serait trop facile : 97 % sont hors zone). */
export function habitablePuzzle(rows, rng) {
  const ok = rows.map(exoFromRow).filter(e => e.sma > 0 && e.hi > 0 && e.ho > e.hi && (e.inHz === 0 || e.inHz === 1) && e.teq > 0 && e.r > 0 && e.st > 0);
  const inside = ok.filter(e => e.inHz === 1), outside = ok.filter(e => e.inHz === 0);
  const pool = rng() < 0.5 && inside.length ? inside : outside.length ? outside : inside;
  if (!pool.length) return null;
  const e = pick(pool, rng);
  const where = e.sma < e.hi ? 'tooClose' : e.sma > e.ho ? 'tooFar' : 'inside';
  return { exo: e, answer: e.inHz === 1, where };
}
export function habitableFacts(e, lang = 'fr', mode = 'simple') {
  const s = mode === 'simple';
  return [
    s ? tx(lang, `Distance à son étoile : ${fmt(e.sma, lang, 2)} fois la distance Terre–Soleil.`, `Distance to its star: ${fmt(e.sma, lang, 2)} times the Earth–Sun distance.`)
      : tx(lang, `Demi-grand axe : ${fmt(e.sma, lang, 4)} UA.`, `Semi-major axis: ${fmt(e.sma, lang, 4)} AU.`),
    s ? tx(lang, `Température estimée : environ ${Math.round(C(e.teq))} °C.`, `Estimated temperature: about ${Math.round(C(e.teq))} °C.`)
      : tx(lang, `Température d'équilibre : ${fmt(e.teq, lang, 4)} K (${fmt(C(e.teq), lang, 3)} °C).`, `Equilibrium temperature: ${fmt(e.teq, lang, 4)} K (${fmt(C(e.teq), lang, 3)} °C).`),
    s ? tx(lang, `Taille : ${fmt(e.r, lang, 2)} fois la largeur de la Terre.`, `Size: ${fmt(e.r, lang, 2)} times Earth’s width.`)
      : tx(lang, `Rayon : ${fmt(e.r, lang, 3)} R⊕.`, `Radius: ${fmt(e.r, lang, 3)} R⊕.`),
    s ? tx(lang, `Son étoile : ${e.st >= 6000 ? 'plus chaude' : e.st >= 5300 ? 'à peu près aussi chaude' : 'moins chaude'} que le Soleil (${fmt(e.st, lang, 2)} K).`, `Its star: ${e.st >= 6000 ? 'hotter than' : e.st >= 5300 ? 'about as hot as' : 'cooler than'} the Sun (${fmt(e.st, lang, 2)} K).`)
      : tx(lang, `Température effective de l'étoile : ${fmt(e.st, lang, 4)} K (Soleil : 5 772 K).`, `Star effective temperature: ${fmt(e.st, lang, 4)} K (Sun: 5,772 K).`),
  ];
}
export function habitableExplain(e, where, lang = 'fr', mode = 'simple') {
  const s = mode === 'simple', lo = fmt(e.hi, lang, s ? 2 : 4), hi = fmt(e.ho, lang, s ? 2 : 4), d = fmt(e.sma, lang, s ? 2 : 4);
  const why = {
    tooClose: tx(lang, 'trop près de son étoile : l’eau s’y évaporerait', 'too close to its star: water would boil away'),
    tooFar: tx(lang, 'trop loin de son étoile : l’eau y gèlerait', 'too far from its star: water would freeze'),
    inside: tx(lang, 'dans la zone où de l’eau liquide pourrait exister à la surface, avec une atmosphère adaptée', 'in the zone where liquid water could exist on the surface, given a suitable atmosphere'),
  }[where];
  const zone = s
    ? tx(lang, `Sa zone habitable va de ${lo} à ${hi} fois la distance Terre–Soleil ; la planète est à ${d} : ${why}.`, `Its habitable zone runs from ${lo} to ${hi} times the Earth–Sun distance; the planet is at ${d}: ${why}.`)
    : tx(lang, `Zone habitable conservatrice (Kopparapu et al. 2013) : ${lo} – ${hi} UA ; demi-grand axe : ${d} UA, donc ${why}.`, `Conservative habitable zone (Kopparapu et al. 2013): ${lo} – ${hi} AU; semi-major axis: ${d} AU, so ${why}.`);
  return `${zone} ${tx(lang, '« Zone habitable » ne veut pas dire « habitée » : aucune vie n’a été détectée ailleurs que sur Terre.', '“Habitable zone” does not mean “inhabited”: no life has been detected anywhere but Earth.')}`;
}

/* ---------- points, badges, collection ---------- */
export const BADGES = [
  { id: 'explorer', pts: 50, fr: 'Petit explorateur', en: 'Young explorer', icon: '🔭' },
  { id: 'astronomer', pts: 250, fr: 'Astronome', en: 'Astronomer', icon: '🪐' },
  { id: 'cosmonaut', pts: 600, fr: 'Cosmonaute', en: 'Cosmonaut', icon: '🚀' },
];
export const badgesFor = points => BADGES.filter(b => points >= b.pts);
export const nextBadge = points => BADGES.find(b => points < b.pts) ?? null;
