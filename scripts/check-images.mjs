// Génère public/_check.html : planche-contact pour vérifier à l'œil que chaque image correspond à son objet.
import { readFileSync, writeFileSync } from 'node:fs';
const i = JSON.parse(readFileSync('data/images.json', 'utf8'));
const cell = ([k, v]) => `<div style="width:170px"><img src="${v.thumb}" style="width:170px;height:170px;object-fit:cover"><br><b>${k}</b> — ${v.title.slice(0, 45)}</div>`;
writeFileSync('public/_check.html', `<body style="background:#111;color:#fff;font:12px sans-serif;display:flex;flex-wrap:wrap;gap:8px">${Object.entries(i).map(cell).join('')}`);
