// Tests de la position de l'ISS (nécessite l'accès réseau à l'éphéméride NASA ; sauté hors ligne).
import test from 'node:test';
import assert from 'node:assert/strict';
import { issNow, loadStates, sunlitAt } from '../lib/iss.mjs';

let states = null;
try { states = await loadStates(true); } catch { /* hors ligne */ }
const opt = { skip: states ? false : 'éphéméride NASA injoignable' };

test('position de l’ISS plausible (inclinaison 51,6°, altitude ~ 350-450 km, vitesse ~ 7,6 km/s)', opt, async () => {
  const d = await issNow();
  assert.ok(Math.abs(d.lat) <= 52, `latitude ${d.lat}`);
  assert.ok(d.lon >= -180 && d.lon <= 180);
  assert.ok(d.alt_km > 350 && d.alt_km < 460, `altitude ${d.alt_km}`);
  assert.ok(d.speed_kms > 7.4 && d.speed_kms < 7.9, `vitesse ${d.speed_kms}`);
  assert.ok(d.track.length > 90);
});

test('jour/nuit : ~ 1/3 de chaque orbite dans l’ombre', opt, async () => {
  const t0 = states[0].t + 3600e3; let day = 0, n = 0;
  for (let m = 0; m < 540; m += 1) { if (sunlitAt(states, t0 + m * 60000)) day++; n++; } // 6 orbites
  const f = day / n;
  assert.ok(f > 0.55 && f < 0.75, `fraction éclairée ${f.toFixed(2)}`);
});

test('continuité : deux minutes plus tard, l’ISS a parcouru ~ 900 km', opt, async () => {
  const a = await issNow(states[0].t + 7200e3), b = await issNow(states[0].t + 7200e3 + 120e3);
  const R = 6371, rad = Math.PI / 180;
  const d = Math.acos(Math.sin(a.lat * rad) * Math.sin(b.lat * rad) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lon - a.lon) * rad)) * R;
  assert.ok(d > 800 && d < 1000, `distance ${d.toFixed(0)} km`);
});
