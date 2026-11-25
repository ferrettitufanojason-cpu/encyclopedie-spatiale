// Orchestrateur : relance TOUS les imports dans l'ordre (utilisé par le build Vercel et par l'action GitHub hebdomadaire).
//   node scripts/import-all.mjs            -> imports, puis écrit data/import-report.json
// Étapes « requises » : si elles échouent, le build s'arrête (on garde l'ancien déploiement plutôt que de publier un site vide).
// Étapes « optionnelles » : un échec est signalé dans le rapport mais n'empêche pas le build.
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, DATA_DIR } from './lib/common.mjs';

const STEPS = [
  ['import-solar-system.mjs', 'Système solaire OpenData', true],
  ['import-exoplanets.mjs', 'NASA Exoplanet Archive', true],
  ['import-constellations.mjs', 'Constellations UAI', true],
  ['import-simbad.mjs', 'SIMBAD (étoiles, galaxies, nébuleuses…)', false],
  ['import-sbdb.mjs', 'JPL Small-Body Database', false],
  ['import-missions.mjs', 'NASA NSSDCA (missions)', false],
  ['import-missions-nasa-science.mjs', 'NASA Science (missions, repli)', false],
  ['import-iss.mjs', 'NASA — ISS (faits)', false],
  ['import-images.mjs', 'NASA Image Library', false],
  ['import-commons-images.mjs', 'Wikimedia Commons (images libres)', false],
];
const report = [];
let fatal = false;
for (const [file, label, required] of STEPS) {
  const t0 = Date.now();
  console.log(`\n▶ ${label}  (${file})`);
  const r = spawnSync(process.execPath, [join('scripts', file)], { cwd: ROOT, stdio: 'inherit', env: process.env });
  const ok = r.status === 0;
  report.push({ step: label, file, required, ok, seconds: Math.round((Date.now() - t0) / 1000) });
  if (!ok) { console.error(`✖ ${label} a échoué (code ${r.status})${required ? ' — étape requise' : ' — optionnelle, on continue'}`); if (required) { fatal = true; break; } }
}
await mkdir(DATA_DIR, { recursive: true });
await writeFile(join(DATA_DIR, 'import-report.json'), JSON.stringify({ date: new Date().toISOString(), steps: report }, null, 1));
console.log('\nRésumé :'); for (const s of report) console.log(`  ${s.ok ? '✔' : '✖'} ${s.step} (${s.seconds}s)`);
process.exit(fatal ? 1 : 0);
