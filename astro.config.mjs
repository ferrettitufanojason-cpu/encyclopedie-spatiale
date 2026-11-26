import { defineConfig } from 'astro/config';
// Site 100 % statique : les données sont générées en amont (scripts/ -> data/ -> public/data/).
// Adresse publique (balises de partage, plan du site) : SITE_URL, sinon l'adresse de production fournie par Vercel.
const site = process.env.SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:4322');
export default defineConfig({ output: 'static', compressHTML: true, site });
