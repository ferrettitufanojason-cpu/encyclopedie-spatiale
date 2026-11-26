// « ISS TV » : retrouve les flux YouTube en direct OFFICIELS de l'ISS et vérifie à chaque appel qu'ils sont bien en direct,
// intégrables et du bon propriétaire (chaîne NASA ou Sen, partenaire de la NASA pour les caméras 4K de l'ISS).
// Les identifiants de vidéo peuvent changer : on tente d'abord la page /live de la chaîne, puis l'identifiant connu en repli.
const H = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9' };
const NASA = 'UCLA_DiR1FfKNvjuUpBHmylQ', SEN = 'UCkvW_7kp9LJrztmgA4q4bJQ';

export const SOURCES = [
  { id: 'sen-4k', owner: 'Sen', channel: SEN, fallback: 'fO9e9jnhYK8', match: /4K video of Earth and space/i,
    label: { fr: 'Sen — caméras 4K Terre et espace', en: 'Sen — 4K cameras, Earth and space' },
    desc: { fr: 'Caméras 4K de la société Sen installées sur la station : vues de la Terre et, la nuit, du ciel étoilé et des aurores.', en: 'Sen’s 4K cameras installed on the station: views of Earth and, at night, of the starry sky and auroras.' } },
  { id: 'nasa-hd', owner: 'NASA', channel: NASA, fallback: 'ROboUHfPUrU', match: /High-Definition Views from the International Space Station/i,
    label: { fr: 'NASA — vues HD de la Terre', en: 'NASA — HD views of Earth' },
    desc: { fr: 'Le flux officiel de la NASA : caméras HD fixées à l’extérieur de la station, qui alternent les points de vue sur la Terre.', en: 'NASA’s official stream: HD cameras mounted outside the station, cycling between views of Earth.' } },
  { id: 'nasa-video', owner: 'NASA', channel: NASA, fallback: 'M3HKLzjvKPc', match: /Live Video from the International Space Station/i,
    label: { fr: 'NASA — vidéo en direct de l’ISS', en: 'NASA — live video from the ISS' },
    desc: { fr: 'L’autre flux officiel de la NASA : images de la station et de son équipage, avec la liaison audio quand elle est disponible.', en: 'NASA’s other official stream: views from the station and its crew, with the audio link when available.' } },
];

async function inspect(id) {
  const r = await fetch(`https://www.youtube.com/watch?v=${id}`, { headers: H, signal: AbortSignal.timeout(15000) });
  if (!r.ok) return null;
  const h = await r.text();
  return { id, live: /"isLiveNow":true/.test(h), notLive: /"isLiveNow":false/.test(h), dvr: /"isLiveDvrEnabled":true/.test(h), embed: /"playableInEmbed":true/.test(h), channelId: h.match(/"channelId":"(UC[\w-]{22})"/)?.[1],
    title: (h.match(/<title>([^<]*)/)?.[1] ?? '').replace(/ - YouTube$/, '').replace(/&#39;/g, "'").replace(/&amp;/g, '&'), views: Number(h.match(/"viewCount":"(\d+)"/)?.[1] ?? 0) };
}
async function currentLiveId(channel) {
  try {
    const r = await fetch(`https://www.youtube.com/channel/${channel}/live`, { headers: H, signal: AbortSignal.timeout(15000) });
    return (await r.text()).match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/)?.[1] ?? null;
  } catch { return null; }
}

// Repli quand YouTube bloque la page vidéo (fréquent depuis les serveurs d'hébergement : page « confirmez que vous n'êtes
// pas un robot ») : le service oEmbed officiel confirme le titre, la chaîne propriétaire et que la vidéo est intégrable
// (il répond 401 sinon). Il ne dit pas si le direct est en cours : le lecteur l'affiche lui-même.
const HANDLE = { [NASA]: 'https://www.youtube.com/@NASA', [SEN]: 'https://www.youtube.com/@Sen' };
async function oembed(id) {
  const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`, { headers: H, signal: AbortSignal.timeout(10000) });
  return r.ok ? r.json() : null;
}

let cache = { at: 0, data: null };
export async function issStreams() {
  if (cache.data && Date.now() - cache.at < 5 * 60000) return cache.data;
  const out = [], diag = []; // diag : ce qui a été vérifié pour chaque flux (aucune donnée sensible), utile si un flux manque
  for (const s of SOURCES) {
    const candidates = [...new Set([await currentLiveId(s.channel), s.fallback].filter(Boolean))];
    for (const id of candidates) {
      const i = await inspect(id).catch(e => ({ err: String(e.message ?? e).slice(0, 60) }));
      const d = { flux: s.id, video: id, page: i?.err ? `erreur ${i.err}` : !i ? 'refusée' : i.channelId ? (i.live ? 'en direct' : i.notLive ? 'pas en direct' : 'lue, statut inconnu') : 'bloquée' };
      diag.push(d);
      if (i?.live && i.embed && i.channelId === s.channel && s.match.test(i.title)) { out.push({ id: s.id, video: id, owner: s.owner, label: s.label, desc: s.desc, title: i.title, dvr: i.dvr, watch: `https://www.youtube.com/watch?v=${id}` }); break; }
      if (i?.notLive && i.channelId === s.channel) continue; // page lue et YouTube dit clairement « pas en direct »
      // page bloquée ou incomplète : vérification par oEmbed (titre + chaîne officielle + vidéo intégrable)
      const o = await oembed(id).catch(() => null);
      d.oembed = o ? (o.author_url === HANDLE[s.channel] && s.match.test(o.title ?? '') ? 'ok' : `ne correspond pas (${o.author_url})`) : 'refusé';
      if (d.oembed === 'ok') { out.push({ id: s.id, video: id, owner: s.owner, label: s.label, desc: s.desc, title: o.title, dvr: s.id === 'sen-4k', watch: `https://www.youtube.com/watch?v=${id}`, checkedBy: 'oembed' }); break; }
    }
  }
  cache = { at: Date.now(), data: { streams: out, checked: new Date().toISOString(), diag, note: 'Flux YouTube officiels ; la liaison avec la station est parfois interrompue (écran bleu ou noir).' } };
  return cache.data;
}
