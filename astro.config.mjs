import { defineConfig } from 'astro/config';
// Site 100 % statique : les données sont générées en amont (scripts/ -> data/ -> public/data/).
export default defineConfig({ output: 'static', compressHTML: true });
