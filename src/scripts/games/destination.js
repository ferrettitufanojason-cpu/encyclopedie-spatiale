// « Choisis ta destination » : on choisit un astre, on estime la durée du voyage, puis on découvre le calcul, les dangers et les bagages.
import { rngFrom } from '../../../lib/games.mjs';
import { trip, tripQuestion } from '../../../lib/games-more.mjs';
import { el, tx, lang, onLang, level, onLevel, gameData, reward, verdict, mountBar } from './core.js';

export async function mount(root) {
  mountBar(document.getElementById('gm-bar'));
  let d; try { d = await gameData(); } catch { root.replaceChildren(el('p', { class: 'na', text: tx('Les données du jeu n’ont pas pu être chargées.', 'The game data could not be loaded.') })); return; }
  const earth = d.planets.find(p => p.i === 'earth')?.sma;
  if (!earth) { root.replaceChildren(el('p', { class: 'na', text: tx('Jeu indisponible : la distance Terre–Soleil manque.', 'Game unavailable: the Earth–Sun distance is missing.') })); return; }
  let target = null, seed = 0, picked = null, badges = [];
  const nm = o => (lang() === 'fr' ? o.nf ?? o.n : o.n);
  function draw() {
    const L = lang(), out = el('div', { class: 'gm-out' });
    const grid = el('div', { class: 'gm-dest', role: 'group', 'aria-label': tx('Destinations', 'Destinations') }, d.destinations.map(t =>
      el('button', { type: 'button', class: `btn gm-choice${target?.i === t.i ? ' sel' : ''}`, 'aria-pressed': String(target?.i === t.i), onclick: () => { target = t; seed = Math.floor(Math.random() * 2 ** 31); picked = null; badges = []; draw(); document.querySelector('.gm-trip')?.scrollIntoView({ block: 'nearest' }); } },
        t.img ? el('img', { src: t.img.src, alt: '', loading: 'lazy', width: 36, height: 36 }) : '', el('span', { text: nm(t) }))));
    const parts = [el('p', { class: 'gm-q', text: tx('Où veux-tu aller ? Choisis ta destination.', 'Where do you want to go? Choose your destination.') }), grid];
    if (target) {
      const Q = tripQuestion(target, earth, rngFrom(seed), L, level()), T = trip(target, earth, L);
      parts.push(el('section', { class: 'gm-trip' },
        el('p', { class: 'gm-q', text: Q.q }),
        el('div', { class: 'gm-choices' }, Q.choices.map(c => el('button', { type: 'button', class: `btn gm-choice${picked != null && c.id === Q.answer ? ' ok' : ''}${picked === c.id && c.id !== Q.answer ? ' ko' : ''}`, disabled: picked != null,
          onclick: () => { picked = c.id; badges = reward('choisis-ta-destination', c.id === Q.answer ? 10 : 0, Q.unlock); draw(); }, text: c.label }))),
        out,
        picked != null ? el('div', { class: 'gm-tripcard' },
          el('h3', { text: tx(`Voyage vers ${nm(target)}`, `Journey to ${nm(target)}`) }),
          el('p', {}, el('b', { text: tx('Durée estimée : ', 'Estimated time: ') }), T.dur),
          el('p', { class: 'credit', text: T.hyp }),
          el('h4', { text: tx('Dangers', 'Hazards') }), el('ul', {}, T.dangers.map(x => el('li', { text: x }))),
          el('h4', { text: tx('Dans tes bagages', 'In your luggage') }), el('ul', {}, T.bag.map(x => el('li', { text: x }))),
          el('p', { class: 'credit' }, tx('Distances, gravité et température : ', 'Distances, gravity and temperature: '), el('a', { href: `/objet/${encodeURIComponent(target.i)}`, text: tx(`fiche de ${nm(target)}`, `${nm(target)} page`) }), '.',
            target.img ? ` ${tx('Image', 'Image')} : ${target.img.credit} · ${target.img.license}` : '')) : ''));
      if (picked != null) verdict(out, { ok: picked === Q.answer, title: picked === Q.answer ? tx('Bonne estimation ! +10 points.', 'Good estimate! +10 points.') : tx(`Pas tout à fait : il faut environ ${T.dur}.`, `Not quite: it takes about ${T.dur}.`), objects: [], badges });
    }
    root.replaceChildren(...parts);
  }
  draw(); onLang(draw); onLevel(() => { picked = null; badges = []; draw(); });
}
