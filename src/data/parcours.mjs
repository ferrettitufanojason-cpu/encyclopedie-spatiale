// Parcours pédagogiques : une suite de fiches à consulter dans l'ordre, puis quelques questions.
// Les réponses chiffrées sont CALCULÉES au moment de la construction à partir des fiches (aucun chiffre écrit à la main),
// avec la source indiquée. get(id) renvoie la fiche (public/data/o/<id>.json) ; index = liste des cartes.
// Textes de vulgarisation rédigés pour ce site (non relus par un spécialiste).
const PC_LY = 3.26156;
const n = (v, l, d = 3) => Number(v).toLocaleString(l, { maximumSignificantDigits: d });
const big = (v, l) => (v >= 1e6 ? `${n(v / 1e6, l)} ${l === 'fr' ? 'millions' : 'million'}` : n(v, l));
const nm = (o, l) => (l === 'fr' ? o.nameFr ?? o.name : o.name);
const ly = o => (o.props.dist?.u === 'pc' ? o.props.dist.v * PC_LY : o.props.dist?.v);
const METHOD_FR = { Transit: 'les transits', 'Radial Velocity': 'les vitesses radiales', Microlensing: 'la microlentille gravitationnelle', Imaging: 'l’imagerie directe' };

export const PARCOURS = [
  {
    id: 'systeme-solaire', level: { fr: 'Collège – lycée', en: 'Middle – high school' },
    fr: { title: 'Le Système solaire, du Soleil à Pluton', intro: 'Faites le tour de notre système planétaire dans l’ordre des distances au Soleil. Dans chaque fiche, comparez la masse, la masse volumique, la durée de l’année (période orbitale) et la température.' },
    en: { title: 'The Solar System, from the Sun to Pluto', intro: 'Tour our planetary system in order of distance from the Sun. On each page, compare the mass, density, length of the year (orbital period) and temperature.' },
    steps: ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'],
    quiz: [
      { fr: 'Quelle planète a la plus grande masse volumique ?', en: 'Which planet has the highest density?', answer: (get, l) => {
        const ps = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'].map(get).filter(o => o.props.density);
        const [a, b] = ps.sort((x, y) => y.props.density.v - x.props.density.v);
        return l === 'fr' ? `${nm(a, l)} (${n(a.props.density.v, l)} g/cm³), juste devant ${nm(b, l)} (${n(b.props.density.v, l)} g/cm³) : ce sont des planètes rocheuses avec un noyau métallique. Saturne, au contraire, est moins dense que l’eau (${n(get('saturn').props.density.v, l)} g/cm³).`
          : `${nm(a, l)} (${n(a.props.density.v, l)} g/cm³), just ahead of ${nm(b, l)} (${n(b.props.density.v, l)} g/cm³): rocky planets with a metal core. Saturn, by contrast, is less dense than water (${n(get('saturn').props.density.v, l)} g/cm³).`;
      } },
      { fr: 'Combien de fois Jupiter est-elle plus massive que la Terre ?', en: 'How many times more massive than the Earth is Jupiter?', answer: (get, l) => {
        const r = get('jupiter').props.mass.v / get('earth').props.mass.v;
        return l === 'fr' ? `Environ ${n(r, l)} fois (masses des deux fiches). Jupiter est à elle seule plus de deux fois plus massive que toutes les autres planètes réunies.` : `About ${n(r, l)} times (masses from both pages). Jupiter alone is more than twice as massive as all the other planets combined.`;
      } },
      { fr: 'Combien d’années terrestres dure une année sur Neptune ?', en: 'How many Earth years does a year on Neptune last?', answer: (get, l) => {
        const y = get('neptune').props.period.v / get('earth').props.period.v;
        return l === 'fr' ? `Environ ${n(y, l)} ans : depuis sa découverte en 1846, Neptune n’a fait qu’à peine plus d’un tour du Soleil.` : `About ${n(y, l)} years: since its discovery in 1846, Neptune has completed barely more than one orbit of the Sun.`;
      } },
      { fr: 'Pourquoi Pluton n’est-elle plus classée parmi les planètes ?', en: 'Why is Pluto no longer classed as a planet?', answer: (get, l) => (l === 'fr'
        ? 'En 2006, l’Union astronomique internationale a défini une planète comme un corps qui tourne autour du Soleil, est presque sphérique et a « fait le ménage » sur son orbite. Pluton partage la sienne avec de nombreux objets de la ceinture de Kuiper : c’est une planète naine (voir le glossaire).'
        : 'In 2006 the International Astronomical Union defined a planet as a body that orbits the Sun, is nearly round and has “cleared” its orbit. Pluto shares its orbit with many Kuiper belt objects: it is a dwarf planet (see the glossary).') },
    ],
  },
  {
    id: 'exoplanetes', level: { fr: 'Lycée – licence', en: 'High school – undergraduate' },
    fr: { title: 'Comment détecte-t-on une exoplanète ?', intro: 'Ces planètes sont trop lointaines et trop faibles pour être photographiées, sauf exception. Chaque fiche correspond à une méthode de détection : regardez la ligne « Méthode de découverte », l’année, et ce que la méthode permet de mesurer (masse, rayon, ou les deux).' },
    en: { title: 'How do we detect an exoplanet?', intro: 'These planets are too distant and faint to be photographed, with few exceptions. Each page illustrates a detection method: look at the discovery method, the year, and what the method can measure (mass, radius, or both).' },
    steps: ['51-peg-b', 'hd-209458-b', 'kepler-452-b', 'trappist-1-e', 'proxima-cen-b', 'hr-8799-b', 'ogle-2005-blg-390l-b'],
    extra: { href: '/?cat=charts', fr: 'Ensuite, ouvrez les graphiques « masse–rayon » et « découvertes par année ».', en: 'Then open the “mass–radius” and “discoveries per year” charts.' },
    quiz: [
      { fr: 'Quelle méthode a permis de découvrir le plus d’exoplanètes ?', en: 'Which method has found the most exoplanets?', answer: (get, l, index) => {
        const ex = index.filter(c => c.k === 'exoplanet'), cnt = {}; ex.forEach(c => { if (c.md) cnt[c.md] = (cnt[c.md] ?? 0) + 1; });
        const [m, k] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
        return l === 'fr' ? `${m === 'Transit' ? 'La méthode des transits' : m} : ${n(k, l, 6)} planètes sur ${n(ex.length, l, 6)} dans ce catalogue (NASA Exoplanet Archive), grâce surtout aux télescopes spatiaux Kepler et TESS.`
          : `${m === 'Transit' ? 'The transit method' : m}: ${n(k, l, 6)} planets out of ${n(ex.length, l, 6)} in this catalogue (NASA Exoplanet Archive), mostly thanks to the Kepler and TESS space telescopes.`;
      } },
      { fr: 'Par quelle méthode et en quelle année 51 Pegasi b a-t-elle été découverte ?', en: 'By which method and in which year was 51 Pegasi b discovered?', answer: (get, l) => {
        const o = get('51-peg-b');
        return l === 'fr' ? `Par ${METHOD_FR[o.disc.method] ?? o.disc.method}, en ${o.disc.year}. C’est la première exoplanète trouvée autour d’une étoile semblable au Soleil (prix Nobel de physique 2019 pour Michel Mayor et Didier Queloz).`
          : `By ${o.disc.method.toLowerCase()}, in ${o.disc.year}. It was the first exoplanet found around a Sun-like star (2019 Nobel Prize in Physics for Michel Mayor and Didier Queloz).`;
      } },
      { fr: 'Pourquoi la méthode des vitesses radiales ne donne-t-elle souvent qu’une masse minimale ?', en: 'Why does the radial velocity method often give only a minimum mass?', answer: (get, l) => (l === 'fr'
        ? 'Elle mesure seulement le mouvement de l’étoile dans notre direction. Si l’orbite est inclinée, une partie du mouvement nous échappe : on obtient M × sin i, où i est l’inclinaison, en général inconnue. Quand la planète transite aussi devant son étoile (i proche de 90°), on connaît sa vraie masse et son rayon, donc sa masse volumique.'
        : 'It only measures the star’s motion along our line of sight. If the orbit is tilted, part of the motion is hidden: we get M × sin i, where the inclination i is usually unknown. When the planet also transits its star (i close to 90°), we know its true mass and radius, hence its density.') },
      { fr: 'À quelle distance se trouve Proxima b, l’exoplanète la plus proche du Système solaire ?', en: 'How far away is Proxima b, the exoplanet closest to the Solar System?', answer: (get, l) => {
        const o = get('proxima-cen-b');
        return l === 'fr' ? `Environ ${n(ly(o), l)} années-lumière : sa lumière met plus de quatre ans à nous parvenir. Avec nos sondes actuelles, le voyage prendrait des dizaines de milliers d’années.`
          : `About ${n(ly(o), l)} light-years: its light takes more than four years to reach us. With current probes the trip would take tens of thousands of years.`;
      } },
    ],
  },
  {
    id: 'vie-des-etoiles', level: { fr: 'Lycée – licence', en: 'High school – undergraduate' },
    fr: { title: 'La vie des étoiles', intro: 'Des naines rouges aux trous noirs : ce parcours suit les étapes de la vie des étoiles. Dans chaque fiche, repérez le type spectral, la température et la catégorie (séquence principale, géante, naine blanche…), puis retrouvez-les dans le diagramme de Hertzsprung-Russell.' },
    en: { title: 'The life of stars', intro: 'From red dwarfs to black holes: this path follows the stages of stellar life. On each page, note the spectral type, temperature and category (main sequence, giant, white dwarf…), then find them in the Hertzsprung–Russell diagram.' },
    steps: ['proxima-cen', 'sun', 'sirius-a', 'rigel', 'betelgeuse', 'orion-nebula', 'sirius-b', 'crab-pulsar', 'sagittarius-a'],
    extra: { href: '/?cat=charts', fr: 'Ouvrez ensuite le diagramme de Hertzsprung-Russell dans l’onglet Graphiques.', en: 'Then open the Hertzsprung–Russell diagram in the Charts tab.' },
    quiz: [
      { fr: 'Bételgeuse est rouge et Rigel est bleue. Laquelle est la plus chaude, et de combien ?', en: 'Betelgeuse is red and Rigel is blue. Which is hotter, and by how much?', answer: (get, l) => {
        const b = get('betelgeuse').props.teff.v, r = get('rigel').props.teff.v;
        return l === 'fr' ? `Rigel : environ ${n(r, l)} K contre ${n(b, l)} K pour Bételgeuse, soit ${n(r / b, l, 2)} fois plus. La couleur d’une étoile indique sa température : les étoiles bleues sont les plus chaudes, les rouges les plus froides.`
          : `Rigel: about ${n(r, l)} K versus ${n(b, l)} K for Betelgeuse, i.e. ${n(r / b, l, 2)} times hotter. A star’s colour reveals its temperature: blue stars are the hottest, red ones the coolest.`;
      } },
      { fr: 'Sirius B est plus chaude que Sirius A, mais beaucoup moins lumineuse. Pourquoi ?', en: 'Sirius B is hotter than Sirius A yet far less luminous. Why?', answer: (get, l) => {
        const a = get('sirius-a').props.teff.v, b = get('sirius-b').props.teff.v;
        return l === 'fr' ? `Sirius B (${n(b, l)} K) est une naine blanche : une étoile morte de la taille de la Terre. Elle est plus chaude que Sirius A (${n(a, l)} K), mais sa surface est minuscule, donc elle émet bien moins de lumière au total.`
          : `Sirius B (${n(b, l)} K) is a white dwarf: a dead star the size of the Earth. It is hotter than Sirius A (${n(a, l)} K) but its surface is tiny, so it emits far less light overall.`;
      } },
      { fr: 'Le pulsar du Crabe est né d’une supernova observée sur Terre en 1054. À quelle distance est-il ?', en: 'The Crab pulsar was born in a supernova seen from Earth in 1054. How far away is it?', answer: (get, l) => {
        const d = ly(get('crab-pulsar'));
        return l === 'fr' ? `Environ ${n(d, l)} années-lumière : l’explosion vue en 1054 avait donc eu lieu des milliers d’années plus tôt. Il reste une étoile à neutrons qui tourne sur elle-même environ 30 fois par seconde.`
          : `About ${n(d, l)} light-years: the explosion seen in 1054 had therefore happened thousands of years earlier. What remains is a neutron star spinning about 30 times per second.`;
      } },
    ],
  },
  {
    id: 'ciel-a-l-oeil-nu', level: { fr: 'Tout public', en: 'General public' },
    fr: { title: 'Observer le ciel à l’œil nu', intro: 'Un parcours à faire un soir d’hiver, loin des lumières : la constellation d’Orion et ses voisines. Ensuite, consultez l’onglet Événements pour connaître les prochaines pluies de météores, éclipses et planètes bien placées.' },
    en: { title: 'Naked-eye sky watching', intro: 'A path for a winter evening, away from city lights: the constellation of Orion and its neighbours. Then check the Events tab for upcoming meteor showers, eclipses and well-placed planets.' },
    steps: ['constellation-orion', 'betelgeuse', 'rigel', 'orion-nebula', 'sirius-a', 'pleiades', 'andromeda-galaxy'],
    extra: { href: '/?cat=event', fr: 'Voir les prochains événements du ciel.', en: 'See upcoming sky events.' },
    quiz: [
      { fr: 'Bételgeuse et Rigel sont dans la même constellation. Sont-elles à la même distance ?', en: 'Betelgeuse and Rigel are in the same constellation. Are they at the same distance?', answer: (get, l) => {
        const b = ly(get('betelgeuse')), r = ly(get('rigel'));
        return l === 'fr' ? `Non : environ ${n(b, l)} années-lumière pour Bételgeuse et ${n(r, l)} pour Rigel. Une constellation est un dessin vu depuis la Terre, pas un groupe d’étoiles réellement voisines.`
          : `No: about ${n(b, l)} light-years for Betelgeuse and ${n(r, l)} for Rigel. A constellation is a pattern seen from Earth, not a group of truly neighbouring stars.`;
      } },
      { fr: 'Quand vous regardez la galaxie d’Andromède, quand est partie la lumière que vous voyez ?', en: 'When you look at the Andromeda Galaxy, when did the light you see set off?', answer: (get, l) => {
        const d = ly(get('andromeda-galaxy'));
        return l === 'fr' ? `Il y a environ ${big(d, l)} d’années (sa distance est d’environ ${big(d, l)} d’années-lumière). C’est l’un des objets les plus lointains visibles à l’œil nu, sous un ciel bien noir.`
          : `About ${big(d, l)} years ago (it lies about ${big(d, l)} light-years away). It is one of the most distant objects visible to the naked eye, under a dark sky.`;
      } },
      { fr: 'Les Pléiades sont un amas ouvert. Qu’est-ce que cela signifie ?', en: 'The Pleiades are an open cluster. What does that mean?', answer: (get, l) => {
        const d = ly(get('pleiades'));
        return l === 'fr' ? `Ce sont des étoiles jeunes, nées ensemble du même nuage de gaz, encore proches les unes des autres, à environ ${n(d, l)} années-lumière de nous. À l’œil nu on en distingue six ou sept ; il y en a en réalité des centaines.`
          : `They are young stars born together from the same gas cloud, still close to each other, about ${n(d, l)} light-years from us. The naked eye shows six or seven; there are actually hundreds.`;
      } },
    ],
  },
];
