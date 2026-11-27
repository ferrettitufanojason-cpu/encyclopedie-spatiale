// « Chasseur d'exoplanètes » : courbe de lumière simplifiée (profondeur et période réelles ; forme, durée et bruit simulés).
// On repère les baisses en touchant la courbe ou en choisissant les tranches de temps (boutons : clavier et lecteur d'écran).
import { rngFrom, pick, fmt, byLevel, lvIdx } from '../../../lib/games.mjs';
import { transitCurve, transitRadius } from '../../../lib/games-more.mjs';
import { el, tx, lang, onLang, mode, level, onLevel, gameData, reward, verdict, mountBar } from './core.js';

const SEG = 16, W = 640, H = 220, PAD = 34;
export async function mount(root) {
  mountBar(document.getElementById('gm-bar'));
  let d; try { d = await gameData(); } catch { root.replaceChildren(el('p', { class: 'na', text: tx('Les données du jeu n’ont pas pu être chargées.', 'The game data could not be loaded.') })); return; }
  let seed, cv, found, wrong, done, badges;
  const newGame = () => {
    seed = Math.floor(Math.random() * 2 ** 31); const rng = rngFrom(seed);
    const deep = d.transits.filter(t => t[5] >= 0.008), pool = lvIdx(level()) < 2 && deep.length ? deep : d.transits; // primaire, collège : baisses d'au moins 0,8 %
    cv = transitCurve(pick(pool, rng), rng, { noise: byLevel(level(), [0.08, 0.15, 0.25, 0.4]) });
    found = new Set(); wrong = new Set(); done = false; badges = []; draw();
  };
  // tranches qui contiennent le milieu d'une baisse
  const target = () => new Set(cv.dips.map(([a, b]) => Math.min(SEG - 1, Math.floor(((a + b) / 2 / cv.span) * SEG))));
  function pickSeg(k) {
    if (done || found.has(k) || wrong.has(k)) return;
    const tg = target(); let hit = tg.has(k) ? k : null;
    if (hit == null && lvIdx(level()) < 2) hit = [k - 1, k + 1].find(x => tg.has(x) && !found.has(x)) ?? null; // une tranche d'écart est acceptée
    if (hit != null) found.add(hit); else wrong.add(k);
    if ([...target()].every(t => found.has(t))) {
      done = true;
      const pts = Math.max(5, 25 - wrong.size * 5);
      badges = reward('chasseur-d-exoplanetes', pts, [{ id: cv.planet.i, n: cv.planet.n, k: 'exoplanet' }]);
    }
    draw();
  }
  function chart() {
    const ys = cv.pts.map(p => p[1]), lo = Math.min(...ys), hi = Math.max(...ys), X = x => PAD + (x / cv.span) * (W - PAD - 8), Y = y => 10 + ((hi - y) / (hi - lo || 1)) * (H - 40);
    const segW = (W - PAD - 8) / SEG, tgt = target();
    const svgNS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'gm-curve'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', tx('Courbe de lumière de l’étoile : luminosité en fonction du temps. Utilise les boutons de tranches sous la courbe pour signaler les baisses.', 'Light curve of the star: brightness over time. Use the slice buttons below the curve to mark the dips.'));
    let html = '';
    for (let k = 0; k < SEG; k++) {
      const cls = found.has(k) ? 'hit' : wrong.has(k) ? 'miss' : done && tgt.has(k) ? 'hit' : '';
      if (cls) html += `<rect x="${PAD + k * segW}" y="4" width="${segW}" height="${H - 30}" class="seg ${cls}"/>`;
    }
    html += `<polyline fill="none" stroke="#e8eefc" stroke-width="1.4" points="${cv.pts.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}"/>`;
    html += `<text x="4" y="14" fill="#9aa8c7" font-size="11">${tx('lumière', 'light')}</text><text x="${W - 8}" y="${H - 6}" fill="#9aa8c7" font-size="11" text-anchor="end">${tx('temps (jours)', 'time (days)')} → ${fmt(cv.span, lang(), 3)}</text>`;
    svg.innerHTML = html;
    svg.addEventListener('click', e => { const r = svg.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W; if (x >= PAD) pickSeg(Math.min(SEG - 1, Math.floor((x - PAD) / segW))); });
    return svg;
  }
  function draw() {
    const L = lang(), p = cv.planet, segDays = cv.span / SEG, out = el('div', { class: 'gm-out' });
    root.replaceChildren(
      el('p', { class: 'gm-q', text: tx('Quand une planète passe devant son étoile, la lumière baisse un peu. Repère toutes les baisses : touche la courbe à leur endroit.', 'When a planet passes in front of its star, the light dips slightly. Find every dip: tap the curve where it happens.') }),
      el('div', { class: 'gm-curve-wrap' }, chart()),
      el('details', { class: 'gm-segs' }, el('summary', { text: tx('Choisir les tranches de temps au clavier', 'Choose the time slices with the keyboard') }),
        el('div', { class: 'gm-seg-btns', role: 'group', 'aria-label': tx('Tranches de temps', 'Time slices') }, Array.from({ length: SEG }, (_, k) =>
          el('button', { type: 'button', class: `btn${found.has(k) ? ' ok' : wrong.has(k) ? ' ko' : ''}`, disabled: done || found.has(k) || wrong.has(k), 'aria-pressed': String(found.has(k) || wrong.has(k)), onclick: () => pickSeg(k),
            text: tx(`jours ${fmt(k * segDays, L, 2)}–${fmt((k + 1) * segDays, L, 2)}`, `days ${fmt(k * segDays, L, 2)}–${fmt((k + 1) * segDays, L, 2)}`) })))),
      el('p', { class: 'credit', text: tx(`Baisses trouvées : ${found.size} sur ${target().size} · erreurs : ${wrong.size}`, `Dips found: ${found.size} of ${target().size} · misses: ${wrong.size}`) }),
      done ? el('div', { class: 'gm-actions' }, el('button', { type: 'button', class: 'btn primary', onclick: newGame, text: tx('Autre étoile', 'Another star') })) : '',
      el('p', { class: 'credit', text: tx('Courbe simplifiée : la profondeur de la baisse et la période sont celles de la vraie planète ; la forme, la durée du passage et le bruit sont simulés.', 'Simplified curve: the dip depth and the period are the real planet’s; the shape, transit duration and noise are simulated.') }),
      out);
    if (done) {
      const pts = Math.max(5, 25 - wrong.size * 5), rCalc = transitRadius(p);
      verdict(out, { ok: true, title: tx(`Planète trouvée : ${p.n} ! +${pts} points.`, `Planet found: ${p.n}! +${pts} points.`),
        text: mode() === 'simple'
          ? tx(`La lumière baisse de ${fmt(p.depth * 100, L, 2)} % tous les ${fmt(p.per, L, 3)} jours : c’est la durée de son année. Plus la baisse est forte, plus la planète est grande par rapport à son étoile : ici environ ${fmt(rCalc, L, 2)} fois la Terre.`,
            `The light drops by ${fmt(p.depth * 100, L, 2)}% every ${fmt(p.per, L, 3)} days: that is the length of its year. The deeper the dip, the bigger the planet compared with its star: here about ${fmt(rCalc, L, 2)} times Earth.`)
          : tx(`Profondeur δ = ${fmt(p.depth * 100, L, 3)} %, période ${fmt(p.per, L, 5)} j. Rayon = R★ × √δ = ${fmt(p.rs, L, 3)} R☉ × ${fmt(Math.sqrt(p.depth), L, 3)} = ${fmt(rCalc, L, 3)} R⊕ (rayon publié : ${fmt(p.r, L, 3)} R⊕, NASA Exoplanet Archive).`,
            `Depth δ = ${fmt(p.depth * 100, L, 3)}%, period ${fmt(p.per, L, 5)} d. Radius = R★ × √δ = ${fmt(p.rs, L, 3)} R☉ × ${fmt(Math.sqrt(p.depth), L, 3)} = ${fmt(rCalc, L, 3)} R⊕ (published radius: ${fmt(p.r, L, 3)} R⊕, NASA Exoplanet Archive).`),
        objects: [{ id: p.i, n: p.n }], badges });
    }
  }
  onLang(draw); onLevel(newGame); document.addEventListener('jeux:update', () => { if (cv) draw(); });
  newGame();
}
