// Nom et lien de la source officielle d'une valeur (ou de la fiche entière) : partagé entre le site et les pages /objet/<id>.
export const srcOf = (o, p) => {
  const s = p?.s ?? o.src;
  if (s === 'nea') return { name: 'NASA Exoplanet Archive', url: `https://exoplanetarchive.ipac.caltech.edu/overview/${encodeURIComponent(o.hostNames?.[0] ?? o.name)}` };
  if (s === 'simbad') return { name: 'SIMBAD (CDS)', url: `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(o.simbadId ?? o.name)}` };
  if (s === 'sbdb') return { name: 'JPL Small-Body Database', url: `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(o.sbdbId ?? o.name)}` };
  if (s === 'nasaiss') return { name: 'NASA — ISS Facts and Figures', url: 'https://www.nasa.gov/international-space-station/space-station-facts-and-figures/' };
  if (s === 'imo') return { name: 'International Meteor Organization (calendrier officiel)', url: `https://www.imo.net/files/meteor-shower/cal${o.imoYear ?? ''}.pdf` };
  if (s === 'horizons') return { name: 'JPL Horizons (NASA/JPL)', url: 'https://ssd.jpl.nasa.gov/horizons/' };
  if (s === 'gwosc') return { name: 'GWOSC (LIGO/Virgo/KAGRA)', url: o.gwUrl ?? 'https://gwosc.org/eventapi/' };
  if (s === 'nasaecl') return { name: 'NASA GSFC Eclipse Web Site (F. Espenak)', url: o.lunar ? 'https://eclipse.gsfc.nasa.gov/lunar.html' : 'https://eclipse.gsfc.nasa.gov/solar.html' };
  if (s === 'nasasci') return { name: 'NASA Science', url: `https://science.nasa.gov/mission/${o.mslug}/` };
  if (s === 'nssdca') return { name: 'NASA NSSDCA', url: `https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=${encodeURIComponent(o.code)}` };
  if (s === 'iau') return { name: 'Union astronomique internationale', url: 'https://www.iau.org/public/themes/constellations/' };
  return { name: 'Système solaire OpenData', url: `https://api.le-systeme-solaire.net/rest/bodies/${o.ssodId}` };
};

// Adresse permanente d'une fiche (page indexable, citable).
export const objPath = id => `/objet/${encodeURIComponent(id)}`;
