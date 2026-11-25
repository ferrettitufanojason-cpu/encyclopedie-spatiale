// Accès serveur aux flux NASA de la section « En direct ». La clé NASA_API_KEY n'est lue QUE côté serveur (variable d'environnement) :
// elle n'est jamais envoyée au navigateur ni écrite dans le code.
const UA = { 'User-Agent': 'encyclopedie-spatiale/0.1' };
const j = async (url, tries = 3) => {
  let err;
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json(); }
    catch (e) { err = e; await new Promise(r => setTimeout(r, 700 * (i + 1))); }
  }
  throw err;
};
const key = () => { const k = process.env.NASA_API_KEY; if (!k) throw new Error('NASA_API_KEY manquante (variable d’environnement)'); return k; };

const strip = h => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&#8217;/g, '’').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
/** Repli officiel : la page du jour apod.nasa.gov/apod/astropix.html (l'API api.nasa.gov renvoie parfois des entrées vides). */
export async function apodPage() {
  const r = await fetch('https://apod.nasa.gov/apod/astropix.html', { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`APOD page HTTP ${r.status}`);
  const h = (await r.text()).replace(/<script[\s\S]*?<\/script>/g, '');
  const i = h.indexOf('class="media-detail-hero__media'); if (i < 0) throw new Error('page APOD illisible');
  const hero = h.slice(i, i + 20000), title = hero.match(/<h2 class="display-48[^>]*>([^<]+)</)?.[1]?.trim();
  const mediaBlock = hero.slice(0, hero.indexOf('<h2') > 0 ? hero.indexOf('<h2') : 6000);
  const video = mediaBlock.match(/<source src="([^"]+\.mp4)"/)?.[1], yt = mediaBlock.match(/<iframe[^>]+src="([^"]+)"/)?.[1];
  const img = mediaBlock.match(/<img[^>]+src="([^"]+)"/)?.[1];
  const credit = strip(mediaBlock.match(/hds-credits">([\s\S]*?)<\/div>\s*<\/div>/)?.[1] ?? '');
  const expl = strip(hero.match(/media-detail-hero__description">\s*<strong>Explanation:<\/strong>([\s\S]*?)<\/p>/)?.[1] ?? '');
  if (!title || !(video || img || yt)) throw new Error('entrée APOD incomplète');
  const date = h.match(/og:updated_time" content="(\d{4}-\d{2}-\d{2})/)?.[1] ?? new Date().toISOString().slice(0, 10);
  return { date, title, explanation: expl, media_type: video ? 'video_file' : img ? 'image' : 'video', url: video ?? img ?? yt, hdurl: null, copyright: null, credit: credit || null,
    page: 'https://apod.nasa.gov/apod/astropix.html', source: 'NASA APOD (apod.nasa.gov)', fallback_days: 0 };
}

/** Image (ou vidéo) astronomique du jour. API api.nasa.gov d'abord ; si elle renvoie une entrée vide, page officielle apod.nasa.gov ; sinon jours précédents. */
export async function apod() {
  const k = key(); let err;
  try { return await apodPage(); } catch (e) { err = e; }
  for (let back = 0; back < 4; back++) {
    const d = new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
    try {
      const a = await j(`https://api.nasa.gov/planetary/apod?api_key=${k}&date=${d}`, 2);
      // le service renvoie parfois une entrée vide (logo NASA, texte « enable JavaScript ») : on la rejette
      if (!a.title || !a.url || /nasa-logo|enable JavaScript/i.test(a.url + a.explanation) || a.title === 'NASA Science') throw new Error('entrée APOD invalide');
      return { date: a.date, title: a.title, explanation: a.explanation, media_type: a.media_type, url: a.url, hdurl: a.hdurl ?? null, copyright: a.copyright?.replace(/\s+/g, ' ').trim() ?? null,
        page: `https://apod.nasa.gov/apod/ap${a.date.slice(2).replace(/-/g, '')}.html`, source: 'NASA APOD (api.nasa.gov)', fallback_days: back };
    } catch (e) { err = e; }
  }
  throw err;
}

/** Dernières images de la Terre entière prises par la caméra EPIC du satellite DSCOVR (images publiques, sans clé dans l'URL). */
export async function epic() {
  const list = await j(`https://api.nasa.gov/EPIC/api/natural?api_key=${key()}`);
  return {
    source: 'NASA EPIC / DSCOVR', page: 'https://epic.gsfc.nasa.gov/',
    images: list.slice(-12).reverse().map(e => {
      const [y, m, d] = e.date.slice(0, 10).split('-');
      return { id: e.identifier, date: e.date, caption: e.caption, lat: e.centroid_coordinates?.lat, lon: e.centroid_coordinates?.lon,
        url: `https://epic.gsfc.nasa.gov/archive/natural/${y}/${m}/${d}/jpg/${e.image}.jpg`, thumb: `https://epic.gsfc.nasa.gov/archive/natural/${y}/${m}/${d}/thumbs/${e.image}.jpg` };
    }),
  };
}

const ROVERS = {
  curiosity: { name: 'Curiosity', category: 'msl', cams: ['MAST_LEFT', 'MAST_RIGHT', 'NAV_LEFT_B', 'NAV_RIGHT_B', 'MAHLI', 'FHAZ_LEFT_B', 'RHAZ_LEFT_B', 'CHEMCAM_RMI'], page: 'https://science.nasa.gov/mission/msl-curiosity/raw-images/' },
  perseverance: { name: 'Perseverance', category: 'mars2020', cams: ['MCZ_LEFT', 'MCZ_RIGHT', 'NAVCAM_LEFT', 'NAVCAM_RIGHT', 'FRONT_HAZCAM_LEFT_A', 'FRONT_HAZCAM_RIGHT_A', 'SUPERCAM_RMI', 'SHERLOC_WATSON', 'SKYCAM'], page: 'https://science.nasa.gov/mission/mars-2020-perseverance/raw-images/' },
};
/** Dernières images brutes (« raw images ») des rovers martiens, flux officiel NASA/JPL. */
export async function rovers() {
  const out = {};
  for (const [id, r] of Object.entries(ROVERS)) {
    const f = await j(`https://mars.nasa.gov/rss/api/?feed=raw_images&category=${r.category}&feedtype=json&num=60&page=0&order=sol+desc`);
    const perCam = {};
    const imgs = f.images.filter(i => r.cams.includes(i.camera?.instrument) && i.image_files?.medium && /^(full|subframe)$/i.test(i.sample_type) && !i.is_thumbnail)
      .filter(i => (perCam[i.camera.instrument] = (perCam[i.camera.instrument] ?? 0) + 1) <= 3).slice(0, 8); // au plus 3 vues par caméra : plus de variété
    out[id] = { name: r.name, page: r.page, sol: imgs[0]?.sol ?? f.images[0]?.sol, images: imgs.map(i => ({ sol: i.sol, camera: i.camera.instrument, taken: i.date_taken_utc, small: i.image_files.small, medium: i.image_files.medium, full: i.image_files.full_res ?? i.image_files.large })) };
  }
  return { source: 'NASA/JPL — Mars raw images', rovers: out };
}

/* ---------- Recherche SIMBAD en direct (service de résolution de noms du CDS, miroir de secours Harvard) ---------- */
const OTYPES = { '*': 'étoile', '**': 'étoile double', 'V*': 'étoile variable', 'BY*': 'variable de type BY Dra', 'SB*': 'binaire spectroscopique', 'EB*': 'binaire à éclipses', 'WD*': 'naine blanche', 'Psr': 'pulsar', 'N*': 'étoile à neutrons',
  'BD*': 'naine brune', 'Pl': 'exoplanète', 'G': 'galaxie', 'GiG': 'galaxie dans un groupe', 'GiC': 'galaxie dans un amas', 'AGN': 'noyau actif de galaxie', 'QSO': 'quasar', 'Sy1': 'galaxie de Seyfert 1', 'Sy2': 'galaxie de Seyfert 2', 'ClG': 'amas de galaxies',
  'OpC': 'amas ouvert', 'GlC': 'amas globulaire', 'PN': 'nébuleuse planétaire', 'HII': 'région HII', 'SNR': 'rémanent de supernova', 'Neb': 'nébuleuse', 'RNe': 'nébuleuse par réflexion', 'MoC': 'nuage moléculaire', 'BH': 'trou noir',
  'LXB': 'binaire X de faible masse', 'HXB': 'binaire X de grande masse', 'Mi*': 'variable de type Mira', 'Ce*': 'céphéide', 'RR*': 'variable RR Lyrae', 'SN*': 'supernova', 'Ra': 'source radio', 'X': 'source X' };
const sex = (h, m, s, sign = 1) => sign * (Math.abs(+h) + +m / 60 + +s / 3600);
export async function simbadLookup(q) {
  q = String(q ?? '').trim().slice(0, 80);
  if (q.length < 2) throw new Error('requête trop courte');
  let text, err;
  const NOT = /not found in the database|No known catalog could be found/i;
  for (const variant of [...new Set([q, q.replace(/\s+/g, '-')])]) { // « trappist 1 » -> « trappist-1 »
    text = null;
    for (const base of ['https://simbad.cds.unistra.fr', 'https://simbad.harvard.edu']) {
      try {
        const r = await fetch(`${base}/simbad/sim-id?output.format=ASCII&Ident=${encodeURIComponent(variant)}`, { headers: UA, signal: AbortSignal.timeout(15000) });
        if (r.ok) { text = await r.text(); break; }
      } catch (e) { err = e; }
    }
    if (text != null && !NOT.test(text)) break;
  }
  if (text == null) throw err ?? new Error('SIMBAD injoignable');
  if (NOT.test(text)) return { found: false, query: q };
  const head = text.match(/Object\s+(.+?)\s+---\s+(\S+)/);
  const co = text.match(/Coordinates\(ICRS[^)]*\):\s+(\d+) (\d+) ([\d.]+)\s+([+-])(\d+) (\d+) ([\d.]+)/);
  const plx = text.match(/Parallax:\s+(-?[\d.]+)/)?.[1];
  const ids = [...(text.split('Identifiers')[1] ?? '').matchAll(/\S.{0,35}?(?=\s{2,}|\n|$)/g)].map(m => m[0].trim()).filter(x => x && !/^\(\d+\):?$/.test(x)).slice(0, 14);
  const main = head?.[1]?.trim();
  return {
    found: !!main, query: q, main_id: main, otype: head?.[2], otype_label: OTYPES[head?.[2]] ?? null,
    ra: co ? +(sex(co[1], co[2], co[3]) * 15).toFixed(5) : null, dec: co ? +sex(co[5], co[6], co[7], co[4] === '-' ? -1 : 1).toFixed(5) : null,
    sp_type: text.match(/Spectral type:\s+(\S+)/)?.[1]?.replace(/^~$/, '') || null, morph: text.match(/Morphological type:\s+(\S+)/)?.[1]?.replace(/^~$/, '') || null,
    vmag: text.match(/Flux V\s*:\s*(-?[\d.]+)/)?.[1] ?? null, parallax_mas: plx ? +plx : null, distance_pc: plx && +plx > 0 ? +(1000 / +plx).toPrecision(4) : null,
    ids, url: `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(main ?? q)}`, source: 'SIMBAD (CDS)',
  };
}
