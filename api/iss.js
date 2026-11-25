// Fonction serverless Vercel : position actuelle de l'ISS (calculée depuis l'éphéméride officielle de la NASA).
import { issNow } from '../lib/iss.mjs';

export default async function handler(req, res) {
  try {
    const data = await issNow();
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=30');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: 'ISS indisponible', detail: String(e.message ?? e) });
  }
}
