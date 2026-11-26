// Jeu « L'ordre des planètes » : glisser-déposer (souris ou doigt) ou boutons ▲ ▼ (clavier), indice après une erreur.
import { orderPuzzle, checkOrder, nameOf, rngFrom } from '../../../lib/games.mjs';
import { el, tx, lang, onLang, mode, gameData, reward, verdict, mountBar } from './core.js';

const POINTS = [40, 30, 20, 10]; // 1er, 2e, 3e, 4e essai ou plus

export async function mount(root) {
  mountBar(document.getElementById('gm-bar'));
  let data;
  try { data = await gameData(); } catch { root.replaceChildren(el('p', { class: 'na', text: tx('Les données du jeu n’ont pas pu être chargées.', 'The game data could not be loaded.') })); return; }
  const planets = data.planets, by = Object.fromEntries(planets.map(p => [p.i, p]));
  let puzzle, order, tries, done, hintPair;

  const newGame = () => {
    puzzle = orderPuzzle(planets, rngFrom());
    if (!puzzle) { root.replaceChildren(el('p', { class: 'na', text: tx('Jeu indisponible : une distance au Soleil manque dans les données.', 'Game unavailable: a distance to the Sun is missing from the data.') })); return; }
    order = [...puzzle.start]; tries = 0; done = false; hintPair = null; draw();
  };
  const move = (from, to) => { if (done || to < 0 || to >= order.length || from === to) return; const [x] = order.splice(from, 1); order.splice(to, 0, x); hintPair = null; draw(to); };

  function draw(focusIdx) {
    const L = lang();
    const live = el('p', { class: 'sr', 'aria-live': 'polite', id: 'gm-live' });
    const list = el('ol', { class: 'gm-order', 'aria-label': tx('Planètes, de la plus proche à la plus lointaine du Soleil', 'Planets, from closest to farthest from the Sun') },
      order.map((id, k) => {
        const p = by[id];
        const li = el('li', { class: `gm-item${hintPair?.includes(id) ? ' hint' : ''}${done ? ' ok' : ''}`, 'data-id': id },
          el('span', { class: 'gm-grip', 'aria-hidden': 'true', title: tx('Glisser pour déplacer', 'Drag to move'), text: '⠿' }),
          p.img ? el('img', { src: p.img.src, alt: '', loading: 'lazy', width: 40, height: 40 }) : el('span', { class: 'gm-noimg', 'aria-hidden': 'true' }),
          el('span', { class: 'gm-name', text: nameOf(p, L) }),
          el('span', { class: 'gm-arrows' },
            el('button', { type: 'button', class: 'btn', disabled: done || k === 0, 'aria-label': tx(`Monter ${nameOf(p, L)}`, `Move ${nameOf(p, L)} up`), onclick: () => { move(k, k - 1); announce(id); }, text: '▲' }),
            el('button', { type: 'button', class: 'btn', disabled: done || k === order.length - 1, 'aria-label': tx(`Descendre ${nameOf(p, L)}`, `Move ${nameOf(p, L)} down`), onclick: () => { move(k, k + 1); announce(id); }, text: '▼' })));
        if (!done) dragify(li, k);
        return li;
      }));
    const out = el('div', { class: 'gm-out' });
    root.replaceChildren(
      el('p', { class: 'gm-q' }, el('span', { 'aria-hidden': 'true', text: '☀️ ' }), tx('Le Soleil est ici. Range les planètes de la plus proche à la plus lointaine.', 'The Sun is here. Order the planets from closest to farthest.')),
      list, live,
      el('div', { class: 'gm-actions' },
        done ? el('button', { type: 'button', class: 'btn primary', onclick: newGame, text: tx('Rejouer', 'Play again') })
          : el('button', { type: 'button', class: 'btn primary', onclick: check, text: tx('Vérifier', 'Check') })),
      out);
    if (focusIdx != null) list.children[focusIdx]?.querySelector(`button:not([disabled])`)?.focus();
    return out;
  }
  const announce = id => { const k = order.indexOf(id), n = document.getElementById('gm-live'); if (n) n.textContent = tx(`${nameOf(by[id], 'fr')} : position ${k + 1} sur ${order.length}`, `${nameOf(by[id], 'en')}: position ${k + 1} of ${order.length}`); };

  function check() {
    tries++;
    const r = checkOrder(planets, puzzle.answer, order, lang(), mode());
    if (r.ok) {
      done = true;
      const pts = POINTS[Math.min(tries, POINTS.length) - 1];
      const badges = reward('ordre-des-planetes', pts, planets.map(p => ({ id: p.i, n: nameOf(p, lang()), k: 'planet' })));
      const out = draw();
      verdict(out, { ok: true, title: tx(`Bravo ! Trouvé en ${tries} essai${tries > 1 ? 's' : ''} : +${pts} points.`, `Well done! Solved in ${tries} ${tries > 1 ? 'tries' : 'try'}: +${pts} points.`),
        text: mode() === 'simple'
          ? tx('Les quatre premières sont des planètes rocheuses, proches du Soleil ; les quatre suivantes sont des géantes de gaz et de glace, bien plus loin.', 'The first four are rocky planets close to the Sun; the next four are giants made of gas and ice, much farther away.')
          : tx(`Ordre des demi-grands axes : de ${(by[puzzle.answer[0]].sma / 149597870.7).toFixed(2).replace('.', ',')} UA (${nameOf(by[puzzle.answer[0]], 'fr')}) à ${(by[puzzle.answer.at(-1)].sma / 149597870.7).toFixed(1).replace('.', ',')} UA (${nameOf(by[puzzle.answer.at(-1)], 'fr')}). Les huit planètes sont débloquées dans ta collection.`,
            `Order of semi-major axes: from ${(by[puzzle.answer[0]].sma / 149597870.7).toFixed(2)} AU (${by[puzzle.answer[0]].n}) to ${(by[puzzle.answer.at(-1)].sma / 149597870.7).toFixed(1)} AU (${by[puzzle.answer.at(-1)].n}). All eight planets are unlocked in your collection.`),
        objects: puzzle.answer.map(id => ({ id, n: nameOf(by[id], lang()) })), badges });
    } else {
      hintPair = r.pair;
      const out = draw();
      verdict(out, { ok: false, title: tx(`Pas encore : ${r.good} planète${r.good > 1 ? 's' : ''} sur 8 bien placée${r.good > 1 ? 's' : ''}.`, `Not yet: ${r.good} of 8 planets in the right place.`), text: r.hint,
        objects: r.pair.map(id => ({ id, n: nameOf(by[id], lang()) })) });
    }
  }

  // glisser-déposer au pointeur (souris, doigt, stylet) : la poignée suit le pointeur, l'élément se range à la position survolée
  function dragify(li, from) {
    li.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || e.button > 0) return;
      if (e.pointerType !== 'mouse' && !e.target.closest('.gm-grip')) return; // au doigt : seule la poignée déplace, le reste laisse défiler la page
      e.preventDefault(); li.setPointerCapture(e.pointerId); li.classList.add('drag');
      const items = [...li.parentElement.children], startY = e.clientY;
      const rects = items.map(n => n.getBoundingClientRect());
      let to = from;
      // position d'arrivée = nombre d'AUTRES planètes dont le milieu est au-dessus du pointeur
      const slot = y => rects.filter((r, k) => k !== from && y > r.top + r.height / 2).length;
      const mv = ev => {
        li.style.transform = `translateY(${ev.clientY - startY}px)`;
        to = slot(ev.clientY);
        items.forEach((n, k) => n.classList.toggle('drop-here', to !== from && k === to));
      };
      const up = ev => { li.removeEventListener('pointermove', mv); li.classList.remove('drag'); li.style.transform = ''; to = slot(ev.clientY); move(from, to); if (to !== from) announce(order[to]); };
      li.addEventListener('pointermove', mv); li.addEventListener('pointerup', up, { once: true }); li.addEventListener('pointercancel', () => { li.removeEventListener('pointermove', mv); draw(); }, { once: true });
    });
  }
  onLang(() => draw()); document.addEventListener('jeux:update', () => {});
  newGame();
}
