// Positions des planètes (lib/planets.mjs, éléments approchés du JPL) comparées à des positions de référence JPL Horizons.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { helio, PLANET_IDS } from '../lib/planets.mjs';

const { positions } = JSON.parse(readFileSync(new URL('./fixtures-horizons.json', import.meta.url), 'utf8'));
const lon = p => Math.atan2(p.y, p.x) * 180 / Math.PI;
const lat = p => Math.asin(p.z / Math.hypot(p.x, p.y, p.z)) * 180 / Math.PI;

test('planètes : écart à JPL Horizons < 0,25° en direction et < 1 % en distance (1800-2050)', () => {
  for (const [d, refs] of Object.entries(positions)) for (const id of PLANET_IDS) {
    const [x, y, z] = refs[id], ref = { x, y, z }, me = helio(id, new Date(`${d}T00:00:00Z`));
    let dl = lon(me) - lon(ref); dl = ((dl + 540) % 360) - 180;
    const err = Math.hypot(dl * Math.cos(lat(ref) * Math.PI / 180), lat(me) - lat(ref));
    assert.ok(err < 0.25, `${id} ${d} : ${err.toFixed(3)}°`);
    const r0 = Math.hypot(x, y, z);
    assert.ok(Math.abs(Math.hypot(me.x, me.y, me.z) - r0) / r0 < 0.01, `${id} ${d} : distance`);
  }
});
