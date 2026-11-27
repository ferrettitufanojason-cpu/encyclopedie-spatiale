// « Le ciel de ce soir » : calendrier des prochains événements du site (pluies d'étoiles filantes, éclipses, oppositions…),
// avec une question par événement, calculée à partir de ses données.
import { rngFrom, shuffle } from '../../../lib/games.mjs';
import { eventQuestion, maskedName } from '../../../lib/games-more.mjs';
import { el, tx, lang, onLang, level, onLevel, gameData, reward, verdict, mountBar } from './core.js';

const ICON = { 'meteor-shower': '☄️', 'solar-eclipse': '🌑', 'lunar-eclipse': '🌕', opposition: '🪐', elongation: '🌅', conjunction: '✨' };
const TYPE = { 'meteor-shower': ['Étoiles filantes', 'Meteor shower'], 'solar-eclipse': ['Éclipse de Soleil', 'Solar eclipse'], 'lunar-eclipse': ['Éclipse de Lune', 'Lunar eclipse'],
  opposition: ['Opposition', 'Opposition'], elongation: ['Élongation', 'Elongation'], conjunction: ['Rapprochement', 'Conjunction'] };
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export async function mount(root) {
  mountBar(document.getElementById('gm-bar'));
  let d; try { d = await gameData(); } catch { root.replaceChildren(el('p', { class: 'na', text: tx('Les données du jeu n’ont pas pu être chargées.', 'The game data could not be loaded.') })); return; }
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = d.events.filter(e => e.date >= today);
  // au plus 3 événements par type, pour varier, puis tri par date (12 au total)
  // seulement les événements qui ont une question au niveau choisi
  const build = () => { const per = {}; return upcoming.filter(e => eventQuestion(e, d.events, rngFrom(hash(e.i)), 'fr', level())).filter(e => (per[e.s] = (per[e.s] ?? 0) + 1) <= 3).slice(0, 12); };
  let list = build();
  let answers = {}; // id → réponse choisie (pour cette visite)
  function draw() {
    const L = lang();
    if (!list.length) { root.replaceChildren(el('p', { class: 'na', text: tx('Aucun événement à venir dans les données pour le moment.', 'No upcoming event in the data for now.') })); return; }
    root.replaceChildren(
      el('p', { class: 'gm-q', text: tx('Les prochains rendez-vous du ciel. Ouvre un événement pour répondre à sa question.', 'Upcoming sky events. Open one to answer its question.') }),
      el('ol', { class: 'gm-cal' }, list.map(e => {
        const Q = eventQuestion(e, d.events, rngFrom(hash(e.i)), L, level()), a = answers[e.i], out = el('div', { class: 'gm-out' });
        const date = new Date(`${e.date}T12:00:00Z`).toLocaleDateString(L === 'en' ? 'en-GB' : 'fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
        const item = el('li', {}, el('details', { open: a != null },
          el('summary', {}, el('span', { class: 'gm-cal-date', text: date }), el('span', { 'aria-hidden': 'true', text: ` ${ICON[e.s]} ` }), el('b', { text: a != null ? (L === 'fr' ? e.nf : e.n) : maskedName(e, L) }), el('small', { class: 'tag', text: TYPE[e.s][L === 'en' ? 1 : 0] }), a != null ? el('span', { text: a === Q.answer ? ' ✔' : ' ✖' }) : ''),
          el('p', { class: 'gm-q', text: Q.q }),
          el('div', { class: 'gm-choices' }, Q.choices.map(c => el('button', { type: 'button', class: `btn gm-choice${a != null && c.id === Q.answer ? ' ok' : ''}${a === c.id && c.id !== Q.answer ? ' ko' : ''}`, disabled: a != null,
            onclick: () => { answers[e.i] = c.id; const b = reward('ciel-de-ce-soir', c.id === Q.answer ? 10 : 0, c.id === Q.answer ? Q.unlock : []); lastBadges[e.i] = b; draw(); } , text: c.label }))),
          out));
        if (a != null) verdict(out, { ok: a === Q.answer, title: a === Q.answer ? tx('Bonne réponse ! +10 points.', 'Right! +10 points.') : tx('Raté !', 'Missed!'), text: Q.explain, objects: Q.objects, badges: lastBadges[e.i] ?? [] });
        return item;
      })),
      el('p', { class: 'credit', text: tx('Dates et données : IMO (étoiles filantes), catalogue des éclipses de la NASA, éphémérides JPL Horizons (planètes ; date à ±1 jour, voir la méthodologie). Les heures et la visibilité dépendent du lieu d’observation.', 'Dates and data: IMO (meteor showers), NASA eclipse catalogue, JPL Horizons ephemerides (planets; date ±1 day, see the methodology). Times and visibility depend on where you observe from.') }));
  }
  const lastBadges = {};
  draw(); onLang(draw); onLevel(() => { list = build(); answers = {}; draw(); });
}
