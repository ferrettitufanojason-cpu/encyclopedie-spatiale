// Modération des avis (protégée par ADMIN_TOKEN) : GET = avis en attente et publiés ; POST = { id, action }.
import { handleAdmin } from '../lib/feedback.mjs';

export default async function handler(req, res) {
  try {
    const { status, json } = await handleAdmin({ method: req.method, body: req.body, auth: req.headers.authorization });
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json(json);
  } catch {
    res.status(502).json({ error: 'Service des avis momentanément indisponible.' });
  }
}
