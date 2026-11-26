// Audit d'accessibilité automatique (axe-core, règles WCAG 2.0/2.1 A et AA) sur le HTML généré.
// Limites : jsdom ne calcule pas les couleurs ni la mise en page → la règle « contraste » est exclue ; les vues construites
// dynamiquement (fiches, comparateur, direct) ne sont pas couvertes par ce test statique (voir README).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import axe from 'axe-core';

const pages = [['dist/index.html', 'accueil'], ['dist/methodologie/index.html', 'méthodologie'], ['dist/glossaire/index.html', 'glossaire'], ['dist/parcours/index.html', 'parcours'], ['dist/mentions-legales/index.html', 'mentions légales'], ['dist/404.html', 'page 404']];
for (const [file, label] of pages) {
  const path = new URL(`../${file}`, import.meta.url);
  test(`axe-core : ${label}`, { skip: existsSync(path) ? false : `${file} absent (npm run build)` }, async () => {
    const dom = new JSDOM(readFileSync(path, 'utf8'), { runScripts: 'outside-only', pretendToBeVisual: true });
    dom.window.eval(axe.source);
    const r = await dom.window.axe.run(dom.window.document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, rules: { 'color-contrast': { enabled: false } } });
    const v = Array.from(r.violations, x => `${x.id} [${x.impact}] ×${x.nodes.length} : ${x.help} → ${Array.from(x.nodes[0].target).join(' ').slice(0, 80)}`);
    assert.equal(v.length, 0, `${v.length} violation(s) d'accessibilité :\n${v.join('\n')}`);
  });
}
