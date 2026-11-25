// Objets emblématiques à interroger dans SIMBAD par identifiant. Les valeurs physiques viennent TOUJOURS de SIMBAD ;
// ce fichier ne contient que des identifiants, un nom d'usage et la sous-catégorie voulue (information de classement).
// Les identifiants introuvables sont simplement signalés à l'import.
const ngc = n => [`NGC ${n}`, `NGC${String(n).padStart(6)}`];
const ic = n => [`IC ${n}`, `IC${String(n).padStart(5)}`];

export const CURATED = [
  // --- trous noirs ---
  { q: ['NAME Sgr A*'], name: 'Sagittarius A*', fr: 'Sagittarius A*', cat: 'star', sub: 'black-hole', tags: ['supermassive'] },
  { q: ['X Cyg X-1'], name: 'Cygnus X-1', fr: 'Cygnus X-1', cat: 'star', sub: 'black-hole', tags: ['stellar-mass'] },
  { q: ['V* V404 Cyg'], name: 'V404 Cygni', cat: 'star', sub: 'black-hole', tags: ['stellar-mass'] },
  { q: ['GRS 1915+105', 'V* V1487 Aql'], name: 'GRS 1915+105', cat: 'star', sub: 'black-hole', tags: ['microquasar'] },
  { q: ['V* V616 Mon'], name: 'A0620-00 (V616 Monocerotis)', cat: 'star', sub: 'black-hole', tags: ['stellar-mass'] },
  { q: ['V* V1033 Sco', 'GRO J1655-40'], name: 'GRO J1655-40', cat: 'star', sub: 'black-hole', tags: ['microquasar'] },
  { q: ['X LMC X-3'], name: 'LMC X-3', cat: 'star', sub: 'black-hole' },
  { q: ['X LMC X-1'], name: 'LMC X-1', cat: 'star', sub: 'black-hole' },
  { q: ['GX 339-4', 'V* V821 Ara'], name: 'GX 339-4', cat: 'star', sub: 'black-hole' },
  { q: ['TON 618'], name: 'TON 618', cat: 'star', sub: 'black-hole', tags: ['supermassive', 'quasar'] },
  { q: ['3C 273', 'QSO B1226+023'], name: '3C 273', cat: 'region', sub: 'galaxy', tags: ['quasar'] },
  // --- pulsars ---
  { q: ['PSR B0531+21', 'PSR J0534+2200'], name: 'Crab Pulsar', fr: 'Pulsar du Crabe', cat: 'star', sub: 'pulsar' },
  { q: ['PSR B0833-45', 'PSR J0835-4510'], name: 'Vela Pulsar', fr: 'Pulsar de la Voile', cat: 'star', sub: 'pulsar' },
  { q: ['PSR B1919+21', 'PSR J1921+2153'], name: 'PSR B1919+21', cat: 'star', sub: 'pulsar' },
  { q: ['PSR J0437-4715'], name: 'PSR J0437-4715', cat: 'star', sub: 'pulsar', tags: ['millisecond'] },
  { q: ['PSR B1937+21', 'PSR J1939+2134'], name: 'PSR B1937+21', cat: 'star', sub: 'pulsar', tags: ['millisecond'] },
  { q: ['PSR B1913+16', 'PSR J1915+1606'], name: 'Hulse-Taylor pulsar (PSR B1913+16)', cat: 'star', sub: 'pulsar', tags: ['binary'] },
  { q: ['PSR J0348+0432'], name: 'PSR J0348+0432', cat: 'star', sub: 'pulsar', tags: ['binary'] },
  { q: ['PSR J0737-3039A'], name: 'Double Pulsar (PSR J0737-3039A)', cat: 'star', sub: 'pulsar', tags: ['binary'] },
  { q: ['PSR B1257+12', 'PSR J1300+1240'], name: 'PSR B1257+12', cat: 'star', sub: 'pulsar', tags: ['millisecond'] },
  { q: ['PSR J0740+6620'], name: 'PSR J0740+6620', cat: 'star', sub: 'pulsar', tags: ['millisecond'] },
  { q: ['PSR J1748-2446ad'], name: 'PSR J1748-2446ad', cat: 'star', sub: 'pulsar', tags: ['millisecond'] },
  // --- magnétars ---
  { q: ['SGR 1806-20'], name: 'SGR 1806-20', cat: 'star', sub: 'magnetar' },
  { q: ['SGR 1900+14'], name: 'SGR 1900+14', cat: 'star', sub: 'magnetar' },
  { q: ['SGR 1935+2154'], name: 'SGR 1935+2154', cat: 'star', sub: 'magnetar' },
  { q: ['1E 1048.1-5937'], name: '1E 1048.1-5937', cat: 'star', sub: 'magnetar' },
  { q: ['4U 0142+61', '1E 0142.9+6150'], name: '4U 0142+61', cat: 'star', sub: 'magnetar' },
  { q: ['1E 2259.0+5837'], name: '1E 2259+586', cat: 'star', sub: 'magnetar' },
  { q: ['XTE J1810-197'], name: 'XTE J1810-197', cat: 'star', sub: 'magnetar' },
  { q: ['SGR 0526-66'], name: 'SGR 0526-66', cat: 'star', sub: 'magnetar' },
  // --- étoiles à neutrons ---
  { q: ['Her X-1', 'V* HZ Her'], name: 'Hercules X-1', cat: 'star', sub: 'neutron-star', tags: ['x-ray-binary'] },
  { q: ['Cen X-3', 'V* V779 Cen'], name: 'Centaurus X-3', cat: 'star', sub: 'neutron-star', tags: ['x-ray-binary'] },
  { q: ['Sco X-1', 'V* V818 Sco'], name: 'Scorpius X-1', cat: 'star', sub: 'neutron-star', tags: ['x-ray-binary'] },
  { q: ['RX J1856.5-3754'], name: 'RX J1856.5-3754', cat: 'star', sub: 'neutron-star' },
  { q: ['SAX J1808.4-3658'], name: 'SAX J1808.4-3658', cat: 'star', sub: 'neutron-star' },
  // --- naines blanches ---
  { q: ['* alf CMa B'], name: 'Sirius B', fr: 'Sirius B', cat: 'star', sub: 'white-dwarf' },
  { q: ['* alf CMi B'], name: 'Procyon B', fr: 'Procyon B', cat: 'star', sub: 'white-dwarf' },
  { q: ['* omi02 Eri B'], name: '40 Eridani B', cat: 'star', sub: 'white-dwarf' },
  { q: ['V* V777 Her', 'GD 358'], name: 'GD 358', cat: 'star', sub: 'white-dwarf' },
  { q: ['EGGR 103', 'G 29-38', 'V* ZZ Psc'], name: 'G 29-38', cat: 'star', sub: 'white-dwarf' },
  { q: ['WD 1145+017'], name: 'WD 1145+017', cat: 'star', sub: 'white-dwarf' },
];

// Noms d'usage des objets Messier les plus connus : [anglais, français]. Seul le nom est ici ; toutes les données viennent de SIMBAD.
export const MESSIER_NAMES = {
  1: ['Crab Nebula', 'Nébuleuse du Crabe'], 8: ['Lagoon Nebula', 'Nébuleuse de la Lagune'], 11: ['Wild Duck Cluster', 'Amas du Canard sauvage'],
  13: ['Hercules Globular Cluster', "Amas globulaire d'Hercule"], 16: ['Eagle Nebula', "Nébuleuse de l'Aigle"], 17: ['Omega Nebula', 'Nébuleuse Oméga'],
  20: ['Trifid Nebula', 'Nébuleuse Trifide'], 27: ['Dumbbell Nebula', 'Nébuleuse de l’Haltère'], 31: ['Andromeda Galaxy', "Galaxie d'Andromède"],
  33: ['Triangulum Galaxy', 'Galaxie du Triangle'], 42: ['Orion Nebula', "Nébuleuse d'Orion"], 44: ['Beehive Cluster', 'Amas de la Crèche'],
  45: ['Pleiades', 'Pléiades'], 51: ['Whirlpool Galaxy', 'Galaxie du Tourbillon'], 57: ['Ring Nebula', "Nébuleuse de l'Anneau"],
  63: ['Sunflower Galaxy', 'Galaxie du Tournesol'], 64: ['Black Eye Galaxy', "Galaxie de l'Œil noir"], 81: ["Bode's Galaxy", 'Galaxie de Bode'],
  82: ['Cigar Galaxy', 'Galaxie du Cigare'], 83: ['Southern Pinwheel Galaxy', 'Galaxie du Moulinet austral'], 87: ['Virgo A (M87)', 'Virgo A (M87)'],
  97: ['Owl Nebula', 'Nébuleuse du Hibou'], 101: ['Pinwheel Galaxy', 'Galaxie du Moulinet'], 104: ['Sombrero Galaxy', 'Galaxie du Sombrero'],
};

// Noms français d'usage (affichage en mode FR). Les noms propres identiques en français ne sont pas listés.
export const FR_NAMES = {
  'Sculptor Galaxy': 'Galaxie du Sculpteur', 'Tarantula Nebula': 'Nébuleuse de la Tarentule', 'Rosette Nebula': 'Nébuleuse de la Rosette',
  'Carina Nebula': 'Nébuleuse de la Carène', 'Antennae Galaxies (NGC 4038)': 'Galaxies des Antennes (NGC 4038)', 'Omega Centauri': 'Oméga du Centaure',
  '47 Tucanae': '47 du Toucan', "Cat's Eye Nebula": "Nébuleuse de l'Œil de chat", 'Helix Nebula': "Nébuleuse de l'Hélice",
  'North America Nebula': "Nébuleuse de l'Amérique du Nord", 'Eskimo Nebula': "Nébuleuse de l'Esquimau", 'Butterfly Nebula': 'Nébuleuse du Papillon',
  'Crescent Nebula': 'Nébuleuse du Croissant', 'Cone Nebula region (NGC 2264)': 'Région de la nébuleuse du Cône (NGC 2264)', 'Flame Nebula': 'Nébuleuse de la Flamme',
  'Southern Ring Nebula': "Nébuleuse de l'Anneau austral", 'Needle Galaxy': "Galaxie de l'Aiguille", 'Perseus A (NGC 1275)': 'Persée A (NGC 1275)',
  'Double Cluster (h Persei)': 'Double Amas (h Persée)', 'Double Cluster (chi Persei)': 'Double Amas (χ Persée)', 'Western Veil Nebula': 'Nébuleuse du Voile (partie ouest)',
  'Mice Galaxies (NGC 4676)': 'Galaxies des Souris (NGC 4676)', 'Running Chicken Nebula (IC 2944)': 'Nébuleuse du Poulet courant (IC 2944)',
  'Bullet Cluster': 'Amas du Boulet', "Pandora's Cluster (Abell 2744)": 'Amas de Pandore (Abell 2744)', 'Fornax Cluster': 'Amas du Fourneau',
  "Stephan's Quintet": 'Quintette de Stephan', 'Coma Star Cluster': 'Amas de la Chevelure de Bérénice', 'Alpha Persei Cluster': "Amas de l'Alpha de Persée",
  'Tadpole Galaxy': 'Galaxie du Têtard', 'Butterfly Cluster': 'Amas du Papillon', "Ptolemy's Cluster": 'Amas de Ptolémée', 'Barbell Nebula': "Petite nébuleuse de l'Haltère",
  "Mairan's Nebula": 'Nébuleuse de De Mairan', 'Praesepe': 'Praesepe (la Crèche)', 'Large Magellanic Cloud': 'Grand Nuage de Magellan', 'Small Magellanic Cloud': 'Petit Nuage de Magellan',
  'Hercules X-1': 'Hercule X-1', 'Centaurus X-3': 'Centaure X-3', 'Scorpius X-1': 'Scorpion X-1', 'Cygnus X-1': 'Cygne X-1', 'V404 Cygni': 'V404 du Cygne',
  'Double Pulsar (PSR J0737-3039A)': 'Double pulsar (PSR J0737-3039A)', 'Hulse-Taylor pulsar (PSR B1913+16)': 'Pulsar de Hulse-Taylor (PSR B1913+16)',
};

export const NGC_FAMOUS = [
  { q: [...ngc(253)], name: 'Sculptor Galaxy' }, { q: [...ngc(1300)], name: 'NGC 1300' }, { q: [...ngc(1365)], name: 'NGC 1365' },
  { q: [...ngc(2070)], name: 'Tarantula Nebula' }, { q: [...ngc(2237)], name: 'Rosette Nebula' }, { q: [...ngc(3372)], name: 'Carina Nebula' },
  { q: [...ngc(4038)], name: 'Antennae Galaxies (NGC 4038)' }, { q: [...ngc(5128)], name: 'Centaurus A' }, { q: [...ngc(5139)], name: 'Omega Centauri' },
  { q: [...ngc(104)], name: '47 Tucanae' }, { q: [...ngc(6543)], name: "Cat's Eye Nebula" }, { q: [...ngc(7293)], name: 'Helix Nebula' },
  { q: [...ngc(7000)], name: 'North America Nebula' }, { q: [...ngc(2392)], name: 'Eskimo Nebula' }, { q: [...ngc(6302)], name: 'Butterfly Nebula' },
  { q: [...ngc(6888)], name: 'Crescent Nebula' }, { q: [...ngc(2264)], name: 'Cone Nebula region (NGC 2264)' }, { q: [...ngc(2024)], name: 'Flame Nebula' },
  { q: [...ngc(3132)], name: 'Southern Ring Nebula' }, { q: [...ngc(6397)], name: 'NGC 6397' }, { q: [...ngc(7331)], name: 'NGC 7331' },
  { q: [...ngc(891)], name: 'NGC 891' }, { q: [...ngc(4565)], name: 'Needle Galaxy' }, { q: [...ngc(1275)], name: 'Perseus A (NGC 1275)' },
  { q: [...ngc(3603)], name: 'NGC 3603' }, { q: [...ngc(869)], name: 'Double Cluster (h Persei)' }, { q: [...ngc(884)], name: 'Double Cluster (chi Persei)' },
  { q: [...ngc(6960)], name: 'Western Veil Nebula' }, { q: [...ngc(1232)], name: 'NGC 1232' }, { q: [...ngc(4676)], name: 'Mice Galaxies (NGC 4676)' },
  { q: [...ic(1396)], name: 'IC 1396' }, { q: [...ic(2944)], name: 'Running Chicken Nebula (IC 2944)' }, { q: [...ic(434)], name: 'IC 434' },
  { q: ['NAME Horsehead Nebula'], name: 'Horsehead Nebula', fr: 'Nébuleuse de la Tête de Cheval' },
  { q: ['NAME LMC'], name: 'Large Magellanic Cloud', fr: 'Grand Nuage de Magellan' }, { q: ['NAME SMC'], name: 'Small Magellanic Cloud', fr: 'Petit Nuage de Magellan' },
  { q: ['ACO  1656'], name: 'Coma Cluster', fr: 'Amas de la Chevelure de Bérénice' }, { q: ['NAME Perseus Cluster'], name: 'Perseus Cluster', fr: 'Amas de Persée' },
  { q: ['NAME 1E 0657-56'], name: 'Bullet Cluster' }, { q: ['ACO 2744', 'Abell 2744'], name: "Pandora's Cluster (Abell 2744)" },
  { q: ['NAME Fornax Cluster'], name: 'Fornax Cluster' }, { q: ["NAME Stephan's Quintet"], name: "Stephan's Quintet" }, { q: ['NAME Hyades Cluster'], name: 'Hyades', fr: 'Hyades' },
  { q: ['NAME Coma Star Cluster'], name: 'Coma Star Cluster' }, { q: ['NAME Alpha Persei Cluster'], name: 'Alpha Persei Cluster' }, { q: ['ESO 350-40'], name: 'Cartwheel Galaxy', fr: 'Galaxie de la Roue de chariot' },
  { q: ['UGC 10214'], name: 'Tadpole Galaxy' }, { q: ['Virgo A'], name: 'Virgo A (M87)', skip: true },
].filter(c => !c.skip);
