// Enveloppe commune des fonctions serverless : cache court, CORS, erreurs propres (jamais de clé dans la réponse).
export const wrap = (fn, { sMaxAge = 60 } = {}) => async (req, res) => {
  try {
    const data = await fn(req);
    res.setHeader('Cache-Control', `s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 5}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: 'Service indisponible', detail: String(e.message ?? e).replace(/api_key=[^&\s]+/g, 'api_key=***') });
  }
};
