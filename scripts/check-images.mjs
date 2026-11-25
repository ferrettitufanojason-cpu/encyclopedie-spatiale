// Génère dist/imgcheck.html : planche-contact pour vérifier à l'œil que chaque image correspond à son objet.
// Usage : node scripts/check-images.mjs [illustration]   (filtre optionnel sur le type d'image)
import { readFileSync, writeFileSync } from 'node:fs';
const kind = process.argv[2];
const i = Object.entries(JSON.parse(readFileSync('data/images.json', 'utf8'))).filter(([, v]) => !kind || v.kind === kind);
const cell = ([k, v]) => `<div style="width:190px"><img src="${v.thumb}" style="width:190px;height:190px;object-fit:cover"><br><b>${k}</b><br>${v.title.slice(0, 45)}</div>`;
writeFileSync('dist/imgcheck.html', `<body style="background:#111;color:#fff;font:12px sans-serif;display:flex;flex-wrap:wrap;gap:8px">${i.map(cell).join('')}`);
