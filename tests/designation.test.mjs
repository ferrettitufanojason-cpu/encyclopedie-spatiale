// Règle de correction des désignations provisoires (scripts/lib/designation.mjs), sur les cas réels rencontrés dans la source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileDesignation } from '../scripts/lib/designation.mjs';

test('S/2025 U 1 : le nom anglais « S/2005 U 1 » (antérieur à la découverte en 2025) est rejeté', () => {
  const r = reconcileDesignation({ id: 's2025u1', englishName: 'S/2005 U 1', name: 'S/2025 U 1', alternativeName: 'S/2005 U 1', discoveryDate: '02/02/2025' });
  assert.equal(r.designation, 'S/2025 U 1'); assert.equal(r.code, 'S2025U1');
});
test('S/2023 S 51 : le code suit la désignation, pas l’identifiant « s2020s51 »', () => {
  const r = reconcileDesignation({ id: 's2020s51', englishName: 'S/2023 S 51', name: 'S/2023 S 51', alternativeName: 'S/2023 S 51', discoveryDate: '24/06/2020' });
  assert.equal(r.designation, 'S/2023 S 51'); assert.equal(r.code, 'S2023S51');
});
test('une lune nommée n’est pas touchée ; une désignation cohérente ne produit aucune correction', () => {
  assert.equal(reconcileDesignation({ id: 'thebe', englishName: 'Thebe', name: 'Thébé', alternativeName: 'S/1979 J 2' }), null);
  assert.deepEqual(reconcileDesignation({ id: 's2023u1', englishName: 'S/2023 U 1', name: 'S/2023 U 1', discoveryDate: '04/11/2023' }).fixed, []);
});
