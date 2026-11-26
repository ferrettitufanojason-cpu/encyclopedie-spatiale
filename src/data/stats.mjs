// Bandeau de la page d'accueil : nombre d'objets par onglet et date du dernier import des données (public/data/meta.json).
// Utilisé à la construction (HTML lisible sans JavaScript) et dans le navigateur (changement de langue).
const ORDER = ['planet', 'star', 'region', 'smallbody', 'mission', 'event'];
const LABEL = {
  fr: { planet: 'Planètes', star: 'Étoiles', region: 'Régions du ciel', smallbody: 'Petits corps', mission: 'Missions', event: 'Événements', total: 'objets', upd: 'données mises à jour le', na: 'non disponible' },
  en: { planet: 'Planets', star: 'Stars', region: 'Sky regions', smallbody: 'Small bodies', mission: 'Missions', event: 'Events', total: 'objects', upd: 'data updated on', na: 'not available' },
};

/** @returns {{ total: string, items: {key: string, label: string, n: string}[], date: string, dateIso: string|null }} */
export function homeStats(meta, lang = 'fr') {
  const L = LABEL[lang] ?? LABEL.fr, fmt = n => Number(n).toLocaleString(lang === 'en' ? 'en' : 'fr');
  const iso = meta?.dataDate ?? meta?.built ?? null;
  const date = iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : L.na;
  return {
    total: meta?.total != null ? `${fmt(meta.total)} ${L.total}` : `${L.total} : ${L.na}`,
    items: ORDER.filter(k => meta?.groups?.[k]).map(k => ({ key: k, label: L[k], n: fmt(meta.groups[k]) })),
    date: `${L.upd} ${date}`, dateIso: iso,
  };
}
