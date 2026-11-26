// /objet/<id> (réécrit vers /api/objet?id=<id> par vercel.json) : page indexable d'une fiche, mise en cache par le CDN.
import { renderObjectPage } from '../lib/objet-page.mjs';

export default async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  const origin = process.env.SITE_URL ?? `https://${host}`;
  const self = `https://${host}`; // lecture des fichiers statiques déployés avec le site
  const getText = async p => { const r = await fetch(self + p); return r.ok ? r.text() : null; };
  try {
    const { status, html } = await renderObjectPage(String(req.query.id ?? ''), getText, origin);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', status === 200 ? 'public, s-maxage=86400, stale-while-revalidate=604800' : 'public, s-maxage=300');
    res.status(status).send(html);
  } catch {
    res.status(502).send('Service momentanément indisponible.');
  }
}
