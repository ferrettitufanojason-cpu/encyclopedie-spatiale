// Avis publics : GET = avis validés + moyenne ; POST = nouvel avis (en attente de modération).
import { handlePublic } from '../lib/feedback.mjs';

export default async function handler(req, res) {
  const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket?.remoteAddress;
  try {
    const { status, json, cache } = await handlePublic({ method: req.method, body: req.body, ip });
    res.setHeader('Cache-Control', cache ? `public, s-maxage=${cache}, stale-while-revalidate=300` : 'no-store');
    res.status(status).json(json);
  } catch {
    res.status(502).json({ error: 'Service des avis momentanément indisponible.' });
  }
}
