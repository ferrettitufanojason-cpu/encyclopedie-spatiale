// Désignations provisoires des satellites (« S/2023 S 51 » = découverte annoncée en 2023, Saturne, n° 51).
// La source Système solaire OpenData contient parfois des fautes de frappe entre ses champs (nom anglais, nom français,
// identifiant) : on retient la désignation la plus cohérente, et le code catalogue est TOUJOURS dérivé de cette désignation.
export const PROV = /^S\/(\d{4}) ([A-Z]) (\d+)$/;
export const codeOf = d => d.toUpperCase().replace(/[^A-Z0-9]/g, '');
// identifiant de l'API (« s2020s51 ») remis sous forme de désignation (« S/2020 S 51 »)
const fromId = id => { const m = /^s(\d{4})([a-z])(\d+)$/i.exec(id ?? ''); return m ? `S/${m[1]} ${m[2].toUpperCase()} ${m[3]}` : null; };

/**
 * @param b corps brut de l'API ({ id, name, englishName, alternativeName, discoveryDate "jj/mm/aaaa" })
 * @returns null si ce n'est pas une désignation provisoire, sinon { designation, code, fixed: [motifs] }
 */
export function reconcileDesignation(b) {
  // seulement les satellites encore désignés provisoirement (une lune nommée garde son nom ; son ancienne désignation
  // n'est qu'un nom alternatif)
  if (!PROV.test(b.englishName ?? '') && !PROV.test(b.name ?? '')) return null;
  const cand = [b.englishName, b.name, b.alternativeName, fromId(b.id)].filter(s => PROV.test(s ?? ''));
  const discYear = Number(/(\d{4})\s*$/.exec(b.discoveryDate ?? '')?.[1]) || null;
  // une désignation ne peut pas être antérieure à la découverte (ex. « S/2005 » pour une lune découverte en 2025)
  const plausible = cand.filter(s => !discYear || Number(PROV.exec(s)[1]) >= discYear);
  const pool = plausible.length ? plausible : cand;
  // priorité : accord des deux noms, puis valeur la plus fréquente, puis nom français (champ principal de la source)
  const both = PROV.test(b.englishName ?? '') && b.englishName === b.name && pool.includes(b.name) ? b.name : null;
  const freq = {}; for (const s of pool) freq[s] = (freq[s] ?? 0) + 1;
  const best = both ?? Object.entries(freq).sort((x, y) => y[1] - x[1] || (y[0] === b.name) - (x[0] === b.name))[0][0];
  const fixed = [];
  if (b.englishName && b.englishName !== best) fixed.push(`nom anglais « ${b.englishName} » → « ${best} »`);
  if (b.name && b.name !== best) fixed.push(`nom français « ${b.name} » → « ${best} »`);
  if (codeOf(b.id) !== codeOf(best)) fixed.push(`code « ${codeOf(b.id)} » → « ${codeOf(best)} »`);
  return { designation: best, code: codeOf(best), fixed };
}
