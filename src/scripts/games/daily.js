// « Défi du jour » : une question par jour (la même pour tout le monde ce jour-là), tirée de tous les jeux ; série de jours consécutifs.
import { rngFrom } from '../../../lib/games.mjs';
import { mixedQuestion, nextStreak } from '../../../lib/games-more.mjs';
import { el, tx, lang, onLang, mode, gameData, reward, verdict, mountBar, daily, setDaily } from './core.js';

const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export async function mount(root) {
  mountBar(document.getElementById('gm-bar'));
  let d; try { d = await gameData(); } catch { root.replaceChildren(el('p', { class: 'na', text: tx('Les données du jeu n’ont pas pu être chargées.', 'The game data could not be loaded.') })); return; }
  const today = localDay();
  let badges = [];
  function draw() {
    const L = lang(), st = daily(), done = st?.last === today, Q = mixedQuestion(d, rngFrom(`defi-${today}`), L, mode(), today), out = el('div', { class: 'gm-out' });
    // avant de répondre : la série continue seulement si le dernier défi date d’hier
    const streak = done ? st.streak : st?.last && nextStreak(st, today) > 1 ? st.streak : 0;
    if (!Q) { root.replaceChildren(el('p', { class: 'na', text: tx('Pas de question disponible aujourd’hui.', 'No question available today.') })); return; }
    const dateTxt = new Date().toLocaleDateString(L === 'en' ? 'en-GB' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    root.replaceChildren(
      el('p', { class: 'gm-daily' }, el('b', { text: dateTxt }), ' · ', el('span', { text: tx(`🔥 Série : ${streak} jour${streak > 1 ? 's' : ''}`, `🔥 Streak: ${streak} day${streak > 1 ? 's' : ''}`) }), st?.best ? el('small', { class: 'credit', text: tx(` · record : ${st.best}`, ` · best: ${st.best}`) }) : ''),
      el('p', { class: 'gm-q', text: Q.q }),
      el('div', { class: `gm-choices${Q.choices.length === 2 ? ' two' : ''}` }, Q.choices.map(c => el('button', { type: 'button', class: `btn gm-choice${done && c.id === Q.answer ? ' ok' : ''}${done && st.pick === c.id && c.id !== Q.answer ? ' ko' : ''}`, disabled: done, onclick: () => answer(c.id, Q), text: c.label }))),
      out,
      done ? el('p', { class: 'credit', text: tx('Reviens demain pour une nouvelle question et prolonger ta série !', 'Come back tomorrow for a new question and keep your streak going!') }) : '');
    if (done) verdict(out, { ok: st.ok, title: st.ok ? tx('Défi réussi !', 'Challenge won!') : tx(`Raté : la bonne réponse était « ${Q.choices.find(c => c.id === Q.answer).label} ».`, `Missed: the right answer was “${Q.choices.find(c => c.id === Q.answer).label}”.`), text: Q.explain, objects: Q.objects, badges });
  }
  function answer(id, Q) {
    const st = daily(), ok = id === Q.answer, streak = nextStreak(st, today);
    badges = reward('defi-du-jour', ok ? 15 + Math.min(streak - 1, 10) : 0, ok ? Q.unlock : []);
    setDaily({ last: today, streak, best: Math.max(streak, st?.best ?? 0), ok, pick: id });
  }
  draw(); onLang(draw); document.addEventListener('jeux:update', draw);
}
