// Page réelle d'une fiche : /objet/<id>.
// On part de la page d'accueil construite (même interface), on y injecte un titre, une description, les balises de partage
// et un résumé lisible sans JavaScript (nom, description, valeurs avec leurs sources). Les moteurs de recherche indexent ce
// contenu ; dans le navigateur, le site ouvre ensuite la fiche interactive habituelle par-dessus.
// getText(path) lit un fichier du site construit (dist/) : fetch sur Vercel, lecture disque en local. Renvoie null si absent.
import { T } from '../src/scripts/i18n.js';
import { srcOf, objPath } from './sources.mjs';

const ID_RE = /^[a-z0-9][a-z0-9+._-]{0,150}$/i;
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const L = T.fr;

const isEst = p => /calculated/i.test(p?.ref?.t ?? '') || p?.calc; // valeur estimée ou calculée, pas mesurée
const ORDER = ['mass', 'radius', 'radius_eq', 'density', 'gravity', 'teq', 'period', 'sma', 'ecc', 'dist', 'vmag', 'sptype', 'teff', 'morph', 'redshift', 'diameter',
  'date', 'etype', 'zhr', 'app_mag', 'elong', 'sep_deg', 'gw_m1', 'gw_m2', 'gw_dist', 'ecl_dur', 'launch', 'mtype', 'target', 'agency', 'st_teff', 'st_mass', 'st_rad', 'hz_inner', 'hz_outer'];

function fmt(v) {
  if (v == null) return L.na;
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e6 || a < 1e-3)) { const [m, e] = v.toExponential(3).split('e'); return `${Number(m).toLocaleString('fr')}×10^${Number(e)}`; }
  return v.toLocaleString('fr', { maximumSignificantDigits: 6 });
}
function val(k, p) {
  if (k === 'in_hz') return p.v ? L.yes : L.no;
  if (p.t != null) return p.t;
  let s = (p.lim ? p.lim + ' ' : '') + fmt(p.v);
  if (p.u) s += ` ${p.u}`;
  if (k === 'dist') s += ` (${fmt(p.v * 3.26156)} ${L.ly})`;
  return s;
}

export async function renderObjectPage(rawId, getText, origin) {
  let id = rawId;
  try { id = decodeURIComponent(rawId); } catch { /* garde tel quel */ }
  const shell = await getText('/index.html');
  if (!shell) return { status: 500, html: 'Site non construit.' };
  const o = ID_RE.test(id) ? JSON.parse((await getText(`/data/o/${id}.json`)) ?? 'null') : null;
  if (!o) {
    const nf = await getText('/404.html');
    return { status: 404, html: nf ?? shell };
  }
  const name = o.nameFr ?? o.name;
  const kind = L.subOne?.[o.sub] ?? L.sub?.[o.sub] ?? L.exotype?.[o.sub] ?? '';
  const src = srcOf(o);
  const desc = o.desc?.fr ?? null;
  const rows = ORDER.filter(k => o.props?.[k]).map(k => {
    const p = o.props[k], ps = srcOf(o, p);
    return `<tr><th scope="row">${esc(L.p[k] ?? k)}</th><td>${esc(val(k, p))}${isEst(p) ? ' <em>(valeur estimée ou calculée)</em>' : ''} <small>— ${L.source} : <a href="${esc(ps.url)}">${esc(ps.name)}</a>${p.ref?.t ? ` · ${esc(p.ref.t)}` : ''}</small></td></tr>`;
  }).join('');
  const metaDesc = (desc ?? `${name}${kind ? ` (${kind.toLowerCase()})` : ''} : ${ORDER.filter(k => o.props?.[k] && !isEst(o.props[k])).slice(0, 4).map(k => `${(L.p[k] ?? k).toLowerCase()} ${val(k, o.props[k])}`).join(', ') || 'fiche'}. Source : ${src.name}.`).slice(0, 300);
  const url = `${origin}${objPath(o.id)}`;
  const img = o.image?.url ?? `${origin}/og.png`;
  const title = `${name} — Encyclopédie spatiale`;
  const ld = { '@context': 'https://schema.org', '@type': 'WebPage', name: title, url, description: metaDesc, isPartOf: { '@type': 'WebSite', name: 'Encyclopédie spatiale', url: origin + '/' },
    about: { '@type': 'Thing', name, alternateName: [o.name, o.code, ...(o.aliases ?? [])].filter((x, i, a) => x && x !== name && a.indexOf(x) === i).slice(0, 8) } };
  const head = `<title>${esc(title)}</title><meta name="description" content="${esc(metaDesc)}"><link rel="canonical" href="${esc(url)}">`
    + `<meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(metaDesc)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(img)}">`
    + `<meta name="twitter:card" content="summary_large_image"><script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
  const article = `<article id="ssr" class="ssr">`
    + `<p class="credit"><a href="/">Encyclopédie spatiale</a> › ${esc(kind || o.cat)}</p>`
    + `<h2>${esc(name)}${o.code && o.code !== name ? ` <small>${esc(o.code)}</small>` : ''}</h2>`
    + (o.image?.url ? `<img src="${esc(o.image.thumb ?? o.image.url)}" alt="${esc(o.image.alt ?? name)}" width="320" loading="lazy"><p class="credit">${L.imgCredit} : ${esc(o.image.credit)} · ${esc(o.image.license ?? '')}</p>` : '')
    + (desc ? `<p>${esc(desc)}</p>` : '')
    + (rows ? `<table class="props"><tbody>${rows}</tbody></table>` : `<p class="na">${L.na}</p>`)
    + `<p class="credit">${L.source} : <a href="${esc(src.url)}">${esc(src.name)}</a>${o.updated ? ` · ${L.updated} ${esc(o.updated)}` : ''}</p>`
    + `</article>`;
  const html = shell
    .replace(/<title>[^<]*<\/title>/, '')
    .replace(/<meta name="description"[^>]*>/, '')
    .replace(/<meta property="og:[^>]*>|<meta name="twitter:[^>]*>|<link rel="canonical"[^>]*>/g, '')
    .replace('</head>', `${head}</head>`)
    .replace('<section aria-label="Résultats">', `<section aria-label="Résultats">${article}`);
  return { status: 200, html };
}
