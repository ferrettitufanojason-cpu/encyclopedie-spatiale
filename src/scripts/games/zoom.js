// « Zoom sur l'univers » : de la Terre à l'objet le plus lointain de l'encyclopédie. Chaque étape est une distance tirée d'une fiche.
import { fmt } from '../../../lib/games.mjs';
import { approx } from '../../../lib/games-more.mjs';
import { el, tx, lang, onLang, mode, gameData, reward, mountBar, verdict } from './core.js';

const KM_AU = 149597870.7, KM_LY = 9.4607e12, C_KMS = 299792.458;
const LABEL = {
  earth: ['Le rayon de la Terre', 'Earth’s radius'],
  moon: ['De la Terre à la Lune', 'From Earth to the Moon'],
  sun: ['De la Terre au Soleil', 'From Earth to the Sun'],
  neptune: ['Du Soleil à Neptune, la planète la plus lointaine', 'From the Sun to Neptune, the farthest planet'],
  proxima: ['Jusqu’à Proxima du Centaure, l’étoile la plus proche du Soleil', 'To Proxima Centauri, the star closest to the Sun'],
  galaxy: ['Jusqu’à Cygnus X-1, un trou noir de notre galaxie', 'To Cygnus X-1, a black hole in our galaxy'],
  lmc: ['Jusqu’au Grand Nuage de Magellan, une galaxie voisine', 'To the Large Magellanic Cloud, a neighbouring galaxy'],
  andromeda: ['Jusqu’à la galaxie d’Andromède', 'To the Andromeda galaxy'],
  farthest: ['Jusqu’à l’objet le plus lointain de l’encyclopédie', 'To the farthest object in the encyclopedia'],
};
// « 150 millions de km », « 2,5 millions d'années-lumière » : préposition après millions / milliards en français
const qty = (x, L, fr, en) => { const a = approx(x, L); return L === 'fr' && /(millions|milliards)$/.test(a) ? `${a} ${/^[aeiouyé]/i.test(fr) ? "d'" : 'de '}${fr}`.replace("d' ", "d'") : `${a} ${L === 'fr' ? fr : en}`; };
const sup = n => String(n).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c] ?? '⁻').join('');
const sci = (x, L) => { const p = Math.floor(Math.log10(x)), m = x / 10 ** p; return `${fmt(m, L, 2)} × 10${sup(p)}`; };
const dist = (km, L) => km < 1e7 ? tx(`${fmt(km, L, 3)} km`, `${fmt(km, L, 3)} km`)
  : km < 0.05 * KM_LY ? `${qty(km, L, 'km', 'km')} (${fmt(km / KM_AU, L, 3)} ${tx('UA', 'AU')})`
    : qty(km / KM_LY, L, 'années-lumière', 'light-years');
const light = (km, L) => { const s = km / C_KMS;
  return s < 120 ? tx(`${fmt(s, L, 2)} secondes`, `${fmt(s, L, 2)} seconds`) : s < 7200 ? tx(`${fmt(s / 60, L, 2)} minutes`, `${fmt(s / 60, L, 2)} minutes`)
    : s < 3.156e7 * 2 ? tx(`${fmt(s / 3600, L, 2)} heures`, `${fmt(s / 3600, L, 2)} hours`) : qty(s / 3.156e7, L, 'années', 'years').replace(/^(d+(,d+)?) années$/, '$1 ans'); };

export async function mount(root) {
  mountBar(document.getElementById('gm-bar'));
  let d; try { d = await gameData(); } catch { root.replaceChildren(el('p', { class: 'na', text: tx('Les données du jeu n’ont pas pu être chargées.', 'The game data could not be loaded.') })); return; }
  const steps = d.zoom; let k = 0, rewarded = false;
  const stage = el('div', { class: 'gm-zoom', 'aria-hidden': 'true' }), info = el('div', { class: 'gm-zinfo', role: 'status', 'aria-live': 'polite' });
  const prev = el('button', { type: 'button', class: 'btn', onclick: () => go(-1) }), next = el('button', { type: 'button', class: 'btn primary', onclick: () => go(1) });
  const dots = el('ol', { class: 'gm-dots' }), out = el('div', { class: 'gm-out' });
  root.replaceChildren(stage, el('div', { class: 'gm-actions' }, prev, next), dots, info, out);
  root.addEventListener('keydown', e => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); });
  function go(dir) {
    const n = Math.min(steps.length - 1, Math.max(0, k + dir)); if (n === k) return; k = n; draw(true);
    if (k === steps.length - 1 && !rewarded) {
      rewarded = true;
      const badges = reward('zoom-univers', 15, steps.filter(s => s.i !== 'earth').map(s => ({ id: s.i, n: L_(s), k: 'zoom' })));
      verdict(out, { ok: true, title: tx('Voyage terminé ! +15 points.', 'Journey complete! +15 points.'), text: tx(`De ${dist(steps[0].km, lang())} à ${dist(steps.at(-1).km, lang())} : un facteur d’environ ${sci(steps.at(-1).km / steps[0].km, lang())}.`, `From ${dist(steps[0].km, lang())} to ${dist(steps.at(-1).km, lang())}: a factor of about ${sci(steps.at(-1).km / steps[0].km, lang())}.`),
        objects: steps.filter(s => s.i !== 'earth').map(s => ({ id: s.i, n: L_(s) })), badges });
    }
  }
  const L_ = s => (lang() === 'fr' ? s.nf ?? s.n : s.n);
  function draw(animate) {
    const L = lang(), s = steps[k], p = steps[k - 1], ratio = p ? s.km / p.km : null, pow = Math.round(Math.log10(s.km * 1000));
    prev.textContent = tx('◀ Plus près', '◀ Closer'); prev.disabled = k === 0;
    next.textContent = tx('Plus loin ▶', 'Farther ▶'); next.disabled = k === steps.length - 1;
    // le cercle de l'étape précédente rétrécit dans le nouveau cadre (taille minimale pour rester visible)
    const inner = p ? Math.max(0.6, 100 / ratio) : 0;
    stage.replaceChildren(el('div', { class: 'gm-ring outer' }), p ? el('div', { class: `gm-ring inner${animate ? ' anim' : ''}`, style: `--s:${inner}%` }) : '',
      s.img ? el('img', { src: s.img.src, alt: '', class: 'gm-zimg' }) : '');
    dots.replaceChildren(...steps.map((x, j) => el('li', { class: j === k ? 'on' : j < k ? 'seen' : '' }, el('span', { class: 'sr', text: `${j + 1}/${steps.length}` }))));
    info.replaceChildren(
      el('p', { class: 'gm-v-title', text: `${k + 1}/${steps.length} · ${LABEL[s.key][L === 'en' ? 1 : 0]}` }),
      el('p', {}, el('b', { text: dist(s.km, L) }), mode() === 'detail' ? ` ≈ 10${sup(pow)} m` : ''),
      ratio ? el('p', { text: tx(`Soit environ ${approx(ratio, L)} fois l’étape précédente.`, `About ${approx(ratio, L)} times the previous step.`) }) : '',
      s.key !== 'earth' ? el('p', { text: tx(`La lumière met ${light(s.km, L)} pour parcourir cette distance.`, `Light takes ${light(s.km, L)} to cover this distance.`) }) : '',
      el('p', {}, tx('Donnée de la fiche : ', 'From the page: '), el('a', { href: `/objet/${encodeURIComponent(s.i)}`, text: L_(s) }),
        s.img ? el('small', { class: 'credit', text: ` · ${tx('Image', 'Image')} : ${s.img.credit} · ${s.img.license}` }) : ''));
  }
  draw(false); onLang(() => draw(false)); document.addEventListener('jeux:update', () => draw(false));
}
