// « Ma collection » : objets débloqués par les bonnes réponses, objets à découvrir, badges. Tout vient du stockage local.
import { BADGES, nameOf } from '../../../lib/games.mjs';
import { el, tx, lang, onLang, gameData, progress, resetAll, mountBar } from './core.js';

export async function mount(root) {
  mountBar(document.getElementById('gm-bar'));
  let data = null;
  try { data = await gameData(); } catch { /* la collection s'affiche quand même, sans les objets à découvrir */ }
  const draw = () => {
    const P = progress(), L = lang(), un = P.unlocked;
    const planets = data?.planets ?? [];
    const exoUnlocked = Object.entries(un).filter(([, v]) => v.k === 'exoplanet');
    // tous les objets qu'un jeu peut débloquer (identifiants uniques)
    const pool = new Set(data ? [...planets.map(p => p.i), ...data.exoplanets.map(r => r[0]), ...data.bodies.map(r => r[0]), ...data.moons.map(m => m.i), ...data.missions.map(m => m.i),
      ...data.blackHoles.map(r => r[0]), ...data.transits.map(r => r[0]), ...data.constellations.flatMap(c => [c.i, ...c.stars.map(x => x[0])]), ...data.events.map(e => e.i), ...data.zoom.map(z => z.i), ...data.destinations.map(x => x.i), 'sagittarius-a', 'cygnus-x-1'] : []);
    const total = pool.size, got = Object.keys(un).length;
    const planetIds = new Set(planets.map(p => p.i));
    const KIND = { body: ['Astres du Système solaire', 'Solar System bodies'], moon: ['Lunes', 'Moons'], mission: ['Missions', 'Missions'], 'black-hole': ['Trous noirs', 'Black holes'], star: ['Étoiles', 'Stars'],
      constellation: ['Constellations', 'Constellations'], event: ['Événements du ciel', 'Sky events'], zoom: ['Étapes du zoom sur l’univers', 'Universe zoom steps'], destination: ['Destinations', 'Destinations'] };
    const others = {}; for (const [id, v] of Object.entries(un)) if (!planetIds.has(id) && v.k !== 'exoplanet') (others[KIND[v.k] ? v.k : 'body'] ??= []).push([id, v]);
    const card = (id, name, img, ok) => el('li', { class: `gm-col${ok ? '' : ' locked'}` }, ok
      ? el('a', { href: `/objet/${encodeURIComponent(id)}` }, img ? el('img', { src: img.src, alt: img.alt ?? name, loading: 'lazy' }) : el('span', { class: 'gm-noimg big', 'aria-hidden': 'true', text: '★' }), el('b', { text: name }),
        img ? el('small', { class: 'credit', text: `© ${img.credit} · ${img.license}` }) : '')
      : el('div', {}, el('span', { class: 'gm-noimg big', 'aria-hidden': 'true', text: '?' }), el('b', { text: tx('À découvrir', 'To discover') }), el('span', { class: 'sr', text: name })));
    root.replaceChildren(
      el('section', { 'aria-labelledby': 'gm-badges-h' }, el('h2', { id: 'gm-badges-h', text: tx('Badges', 'Badges') }),
        el('ul', { class: 'gm-badges' }, BADGES.map(b => el('li', { class: P.points >= b.pts ? 'got' : '' }, el('span', { class: 'gm-bicon', 'aria-hidden': 'true', text: b.icon }), el('b', { text: b[L] }),
          el('small', { text: P.points >= b.pts ? tx('obtenu', 'earned') : tx(`à ${b.pts} points (encore ${b.pts - P.points})`, `at ${b.pts} points (${b.pts - P.points} to go)`) }))))),
      el('p', { class: 'gm-q' }, el('b', { text: tx(`${got} objet${got > 1 ? 's' : ''} débloqué${got > 1 ? 's' : ''}`, `${got} object${got > 1 ? 's' : ''} unlocked`) }), data ? tx(` sur ${total.toLocaleString('fr')} à découvrir dans les jeux.`, ` out of ${total.toLocaleString('en')} to discover in the games.`) : ''),
      el('section', { 'aria-labelledby': 'gm-pl-h' }, el('h2', { id: 'gm-pl-h', text: tx('Planètes du Système solaire', 'Solar System planets') }),
        el('ul', { class: 'gm-colgrid' }, planets.map(p => card(p.i, nameOf(p, L), p.img, !!un[p.i]))),
        el('p', { class: 'credit', text: tx('Débloquées en jouant à « L’ordre des planètes » ou « Devine la planète ». Images : crédit et licence indiqués, comme sur les fiches.', 'Unlocked by playing “Order of the planets” or “Guess the planet”. Images: credit and licence shown, as on the object pages.') })),
      el('section', { 'aria-labelledby': 'gm-ex-h' }, el('h2', { id: 'gm-ex-h', text: tx(`Exoplanètes (${exoUnlocked.length.toLocaleString(L)} sur ${(data?.exoplanets.length ?? 0).toLocaleString(L)})`, `Exoplanets (${exoUnlocked.length.toLocaleString(L)} of ${(data?.exoplanets.length ?? 0).toLocaleString(L)})`) }),
        exoUnlocked.length ? el('ul', { class: 'gm-taglist' }, exoUnlocked.sort((a, b) => a[1].n.localeCompare(b[1].n)).map(([id, v]) => el('li', {}, el('a', { class: 'tag', href: `/objet/${encodeURIComponent(id)}`, text: v.n }))))
          : el('p', { class: 'na' }, tx('Aucune pour l’instant : joue à ', 'None yet: play '), el('a', { href: '/jeux/habitable-ou-pas/', text: tx('Habitable ou pas ?', 'Habitable or not?') }), '.')),
      el('section', { 'aria-labelledby': 'gm-ot-h' }, el('h2', { id: 'gm-ot-h', text: tx('Autres découvertes', 'Other discoveries') }),
        Object.keys(others).length ? Object.entries(others).map(([k, list]) => el('div', {}, el('h3', { class: 'gm-colh', text: `${KIND[k][L === 'en' ? 1 : 0]} (${list.length})` }),
          el('ul', { class: 'gm-taglist' }, list.sort((a, b) => a[1].n.localeCompare(b[1].n)).map(([id, v]) => el('li', {}, el('a', { class: 'tag', href: `/objet/${encodeURIComponent(id)}`, text: v.n }))))))
          : el('p', { class: 'na', text: tx('Lunes, missions, étoiles, événements… apparaîtront ici au fil des jeux.', 'Moons, missions, stars, events… will appear here as you play.') })),
      el('section', { 'aria-labelledby': 'gm-priv-h' }, el('h2', { id: 'gm-priv-h', text: tx('Tes données', 'Your data') }),
        el('p', { text: tx('Ta progression est enregistrée uniquement dans ce navigateur (stockage local). Elle n’est jamais envoyée à un serveur et disparaît si tu effaces les données du site.', 'Your progress is stored only in this browser (local storage). It is never sent to a server and disappears if you clear the site’s data.') }),
        el('button', { type: 'button', class: 'btn', onclick: () => { if (confirm(tx('Effacer tous tes points, badges et objets débloqués ?', 'Erase all your points, badges and unlocked objects?'))) resetAll(); }, text: tx('Tout effacer', 'Erase everything') })));
  };
  draw(); onLang(draw); document.addEventListener('jeux:update', draw);
}
