// Import des missions et sondes depuis le NSSDCA de la NASA (NASA Space Science Data Coordinated Archive).
// La liste d'identifiants COSPAR est curée ; TOUTES les données (nom, dates, masse, fusée, site, agence, description) sont lues
// sur la page officielle ; une mission dont le nom ne correspond pas à celui attendu est écartée (pas de devinette).
import { getText, writeJson, slug } from './lib/common.mjs';

const MISSIONS = [
  ['1957-001B', /sputnik 1/i], ['1961-012A', /vostok 1/i], ['1969-059A', /apollo 11/i], ['1972-012A', /pioneer 10/i], ['1973-019A', /pioneer 11/i], ['1973-085A', /mariner 10/i],
  ['1975-075A', /viking 1/i], ['1977-076A', /voyager 2/i], ['1977-084A', /voyager 1/i], ['1989-033B', /magellan/i], ['1989-084B', /galileo/i], ['1990-037B', /hubble/i],
  ['1990-090B', /ulysses/i], ['1995-065A', /soho/i], ['1997-061A', /cassini/i], ['1998-067A', /zarya|iss|international space station/i], ['1999-040B', /chandra/i],
  ['2003-022A', /mars express/i], ['2003-038A', /spitzer|sirtf/i], ['2004-006A', /rosetta/i], ['2004-030A', /messenger/i], ['2004-047A', /swift/i], ['2005-029A', /mars reconnaissance/i],
  ['2006-001A', /new horizons/i], ['2007-043A', /dawn/i], ['2008-029A', /fermi|glast/i], ['2009-011A', /kepler/i], ['2009-026A', /herschel/i], ['2009-026B', /planck/i],
  ['2009-031A', /lunar reconnaissance/i], ['2009-071A', /wise/i], ['2010-005A', /solar dynamics|sdo/i], ['2011-040A', /juno/i], ['2011-070A', /mars science|curiosity/i],
  ['2013-074A', /gaia/i], ['2014-076A', /hayabusa ?2/i], ['2016-055A', /osiris/i], ['2018-038A', /tess|transiting exoplanet/i], ['2018-065A', /parker/i],
  ['2020-052A', /mars 2020|perseverance/i], ['2021-093A', /lucy/i], ['2021-121A', /dart|double asteroid/i], ['2021-130A', /webb|jwst/i], ['2022-156A', /orion|artemis/i],
  ['2023-053A', /juice|jupiter icy/i], ['2023-157A', /psyche/i], ['2024-182A', /europa clipper/i],
];
const today = new Date().toISOString().slice(0, 10);
const txt = h => h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<br\s*\/?>/g, '\n').replace(/<\/(div|p|tr|li|h\d)>/g, '\n')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/[ \t]+/g, ' ').replace(/(\s*\n\s*)+/g, '\n').trim();
const field = (t, k) => t.match(new RegExp(`${k}:\\s*([^\\n]+)`))?.[1]?.trim() ?? null;

const objects = []; const dropped = [];
for (const [cospar, expect] of MISSIONS) {
  await new Promise(r => setTimeout(r, 2500)); // courtoisie envers le serveur NSSDCA
  let page;
  try { page = txt(await getText(`https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=${cospar}`, { cacheKey: `nssdca-${cospar}.html`, ttlHours: 168 })); }
  catch (e) { dropped.push(`${cospar}: ${e.message}`); continue; }
  const idLine = page.indexOf('NSSDCA/COSPAR ID');
  const name = idLine > 0 ? page.slice(0, idLine).trimEnd().split('\n').pop().trim() : null;
  if (!name || !expect.test(name)) { dropped.push(`${cospar}: nom lu « ${name} » ≠ attendu ${expect}`); continue; }
  const desc = page.match(/Description\s*\n([^\n]{60,})/)?.[1]?.trim() ?? null;
  const launch = field(page, 'Launch Date'), mass = field(page, 'Mass');
  const massKg = mass?.match(/([\d.,]+)\s*kg/i)?.[1]?.replace(/,/g, '');
  const props = {};
  const T = (k, t, g = 'mission') => { if (t) props[k] = { t, g, s: 'nssdca' }; };
  T('launch', launch); T('vehicle', field(page, 'Launch Vehicle')); T('site', field(page, 'Launch Site'));
  if (massKg) props.mass_kg = { v: Number(massKg), u: 'kg', g: 'mission', s: 'nssdca' };
  const funding = page.match(/Funding Agency\s*\n([^\n]+)/)?.[1]?.trim(); T('agency', funding);
  const disc = page.match(/Disciplines\s*\n([\s\S]*?)\nAdditional Information/)?.[1]?.trim().split('\n').join(', '); T('disciplines', disc);
  const alt = page.match(/Alternate Names\s*\n([\s\S]*?)\nFacts in Brief/)?.[1]?.trim().split('\n').filter(x => x && !/^urn:/.test(x) && x.length < 40) ?? [];
  objects.push({
    id: `mission-${slug(name)}`, cat: 'other', sub: 'mission', name, code: cospar, aliases: alt.slice(0, 6), tags: ['mission', ...(disc ? disc.split(', ').map(slug) : [])],
    props, nssdcaDesc: desc, launchDate: launch, src: 'nssdca', updated: today,
  });
}
await writeJson('missions.json', { source: { id: 'nssdca', name: 'NASA NSSDCA (Space Science Data Coordinated Archive)', url: 'https://nssdc.gsfc.nasa.gov/nmc/', license: 'Données publiques NASA', fetched: today }, objects });
console.log(objects.map(o => `${o.code} ${o.name}`).join('\n'));
if (dropped.length) console.log('⚠ écartées :\n  ' + dropped.join('\n  '));
