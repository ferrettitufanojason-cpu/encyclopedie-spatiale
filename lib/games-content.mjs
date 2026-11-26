// Textes pédagogiques écrits POUR LES JEUX (non relus par un expert, comme les descriptions du site).
// Règle : chaque affirmation sur un objet précis reprend un fait déjà présent dans sa description sur le site
// (scripts/descriptions.json) ; « kw » est l'expression qui doit figurer dans cette description (vérifié par tests/games.test.mjs).

// « Les lunes mystérieuses » : une particularité par lune
export const MOON_TRAITS = [
  { id: 'io', kw: /volcans actifs/, fr: 'Des centaines de volcans actifs', en: 'Hundreds of active volcanoes' },
  { id: 'europa', kw: /océan d'eau liquide salée/, fr: 'Un océan d’eau salée sous une croûte de glace fracturée', en: 'A salty ocean under a cracked ice crust' },
  { id: 'titan', kw: /atmosphère épaisse/, fr: 'Une atmosphère épaisse et des lacs de méthane', en: 'A thick atmosphere and methane lakes' },
  { id: 'enceladus', kw: /geysers de vapeur d'eau/, fr: 'Des geysers de vapeur d’eau au pôle sud', en: 'Water-vapour geysers at its south pole' },
  { id: 'triton', kw: /sens inverse/, fr: 'Elle tourne dans le sens inverse de la rotation de sa planète', en: 'It orbits the opposite way to its planet’s spin' },
  { id: 'ganymede', kw: /champ magnétique/, fr: 'La plus grande lune, avec son propre champ magnétique', en: 'The largest moon, with its own magnetic field' },
  { id: 'iapetus', kw: /bicolore/, fr: 'Un hémisphère très sombre et l’autre très clair', en: 'One very dark hemisphere and one very bright' },
  { id: 'hyperion', kw: /rotation est chaotique/, fr: 'Une forme d’éponge et une rotation chaotique', en: 'A sponge-like shape and a chaotic spin' },
  { id: 'mimas', kw: /cratère Herschel/, fr: 'Un cratère géant, Herschel, qui occupe une grande partie de sa face', en: 'A giant crater, Herschel, covering much of one side' },
  { id: 'callisto', kw: /plus densément cratérisée/, fr: 'La surface la plus couverte de cratères du Système solaire', en: 'The most heavily cratered surface in the Solar System' },
  { id: 'charon', kw: /moitié de celui de Pluton/, fr: 'Si grande par rapport à sa planète que les deux tournent autour d’un point entre elles', en: 'So big compared with its planet that both circle a point between them' },
  { id: 'moon', kw: /même face/, fr: 'Elle montre toujours la même face à sa planète', en: 'It always shows the same face to its planet' },
];

// « Quelle mission pour quel objectif ? »
export const MISSION_GOALS = [
  { id: 'mission-hubble-space-telescope', kw: /expansion de l'Univers/, fr: 'Observer l’Univers en lumière visible depuis l’orbite terrestre et mesurer son expansion', en: 'Observe the Universe in visible light from Earth orbit and measure its expansion' },
  { id: 'mission-james-webb-space-telescope', kw: /premières galaxies/, fr: 'Observer en infrarouge les premières galaxies et l’atmosphère des exoplanètes', en: 'Observe the first galaxies and exoplanet atmospheres in infrared' },
  { id: 'mission-kepler', kw: /détecter des exoplanètes par transit/, fr: 'Fixer le même champ d’étoiles pour y détecter des exoplanètes par transit', en: 'Stare at one field of stars to detect exoplanets by transit' },
  { id: 'mission-voyager-1', kw: /le plus lointain/, fr: 'Devenir l’objet humain le plus lointain, entré dans l’espace interstellaire', en: 'Become the most distant human-made object, now in interstellar space' },
  { id: 'mission-voyager-2', kw: /seule sonde à avoir survolé Uranus/, fr: 'Seule sonde à avoir survolé Uranus et Neptune', en: 'The only probe to have flown past Uranus and Neptune' },
  { id: 'mission-new-horizons-pluto-kuiper-belt-flyby', kw: /survolé Pluton/, fr: 'Survoler Pluton puis Arrokoth dans la ceinture de Kuiper', en: 'Fly past Pluto, then Arrokoth in the Kuiper belt' },
  { id: 'mission-parker-solar-probe', kw: /couronne solaire/, fr: 'Plonger dans la couronne du Soleil pour étudier le vent solaire', en: 'Dive into the Sun’s corona to study the solar wind' },
  { id: 'mission-juno', kw: /champ magnétique et ses aurores/, fr: 'Étudier l’intérieur, le champ magnétique et les aurores de Jupiter', en: 'Study Jupiter’s interior, magnetic field and auroras' },
  { id: 'mission-apollo-11-command-and-service-module-csm', kw: /premiers humains sur la Lune/, fr: 'Conduire les premiers humains sur la Lune', en: 'Take the first humans to the Moon' },
  { id: 'mission-mars-2020', kw: /Perseverance/, fr: 'Poser le rover Perseverance et collecter des roches martiennes', en: 'Land the Perseverance rover and collect Martian rocks' },
  { id: 'mission-osiris-rex', kw: /prélevé un échantillon/, fr: 'Rapporter sur Terre un échantillon de l’astéroïde Bennu', en: 'Bring a sample of asteroid Bennu back to Earth' },
  { id: 'mission-double-asteroid-redirection-test-dart', kw: /défense planétaire/, fr: 'Percuter une petite lune d’astéroïde pour tester la défense planétaire', en: 'Hit a small asteroid moon to test planetary defence' },
  { id: 'mission-cassini-huygens', kw: /Saturne, ses anneaux/, fr: 'Explorer Saturne, ses anneaux et ses lunes, et poser Huygens sur Titan', en: 'Explore Saturn, its rings and moons, and land Huygens on Titan' },
  { id: 'mission-chandra-x-ray-observatory', kw: /rayons X/, fr: 'Observer l’Univers en rayons X : trous noirs, supernovae', en: 'Observe the Universe in X-rays: black holes, supernovae' },
  { id: 'mission-transiting-exoplanet-survey-satellite', kw: /presque tout le ciel/, fr: 'Balayer presque tout le ciel à la recherche d’exoplanètes autour d’étoiles proches', en: 'Scan almost the whole sky for exoplanets around nearby stars' },
  { id: 'mission-dawn', kw: /Vesta/, fr: 'Se mettre en orbite autour de Vesta puis de Cérès', en: 'Orbit Vesta, then Ceres' },
  { id: 'mission-messenger', kw: /première sonde à avoir orbité Mercure/, fr: 'Première sonde en orbite autour de Mercure', en: 'First probe to orbit Mercury' },
  { id: 'mission-magellan', kw: /par radar/, fr: 'Cartographier Vénus au radar à travers ses nuages', en: 'Map Venus by radar through its clouds' },
];

// « Trous noirs : vrai ou faux ? » — affirmations générales bien établies (les affirmations chiffrées sont générées depuis les données)
export const BH_STATEMENTS = [
  { ok: true, fr: 'Au-delà de l’horizon d’un trou noir, même la lumière ne peut pas s’échapper.', en: 'Beyond a black hole’s event horizon, not even light can escape.',
    why: { fr: 'C’est la définition de l’horizon des événements : la vitesse nécessaire pour s’échapper y dépasse celle de la lumière.', en: 'That is what the event horizon is: the speed needed to escape exceeds the speed of light.' } },
  { ok: false, fr: 'Un trou noir aspire tout ce qui se trouve dans l’Univers, comme un aspirateur.', en: 'A black hole sucks in everything in the Universe, like a vacuum cleaner.',
    why: { fr: 'Loin de lui, un trou noir attire comme n’importe quel astre de même masse : il faut s’en approcher beaucoup pour être capturé.', en: 'Far away, a black hole pulls like any other body of the same mass: you must get very close to be captured.' } },
  { ok: false, fr: 'Le Soleil deviendra un jour un trou noir.', en: 'The Sun will one day become a black hole.',
    why: { fr: 'Le Soleil n’est pas assez massif : il finira en naine blanche. Seules les étoiles bien plus massives finissent en trou noir (voir le jeu « Vie d’une étoile »).', en: 'The Sun is not massive enough: it will end as a white dwarf. Only much more massive stars end as black holes (see “Life of a star”).' } },
  { ok: true, fr: 'Si le Soleil était remplacé par un trou noir de même masse, la Terre continuerait de tourner sur la même orbite.', en: 'If the Sun were replaced by a black hole of the same mass, Earth would keep the same orbit.',
    why: { fr: 'L’attraction dépend de la masse et de la distance, pas de la taille de l’astre. Il ferait en revanche noir et froid !', en: 'Gravity depends on mass and distance, not on the body’s size. It would, however, become dark and cold!' } },
  { ok: true, fr: 'Il existe un trou noir géant au centre de notre galaxie.', en: 'There is a giant black hole at the centre of our galaxy.',
    why: { fr: 'Il s’appelle Sagittarius A*. Des étoiles tournent autour de lui à grande vitesse, ce qui a permis de mesurer sa masse.', en: 'It is called Sagittarius A*. Stars orbit it at high speed, which made it possible to measure its mass.' }, id: 'sagittarius-a', kw: /étoiles qui l'orbitent à grande vitesse/ },
  { ok: true, fr: 'On a déjà obtenu une image de l’ombre d’un trou noir.', en: 'An image of a black hole’s shadow has already been obtained.',
    why: { fr: 'En 2022, l’Event Horizon Telescope a publié la première image de l’ombre de Sagittarius A*, le trou noir du centre de notre galaxie.', en: 'In 2022 the Event Horizon Telescope released the first image of the shadow of Sagittarius A*, the black hole at our galaxy’s centre.' }, id: 'sagittarius-a', kw: /première image de son ombre/ },
  { ok: false, fr: 'Les trous noirs sont des trous dans l’espace, vides de matière.', en: 'Black holes are holes in space, empty of matter.',
    why: { fr: 'Au contraire : un trou noir concentre une masse énorme dans un tout petit volume.', en: 'Quite the opposite: a black hole packs a huge mass into a tiny volume.' } },
  { ok: true, fr: 'On peut repérer un trou noir grâce à la matière très chaude qui tourne autour de lui.', en: 'A black hole can be spotted through the very hot matter swirling around it.',
    why: { fr: 'Le trou noir Cygnus X-1 arrache de la matière à son étoile compagnon ; ce disque très chaud en fait l’une des sources de rayons X les plus brillantes du ciel.', en: 'The black hole Cygnus X-1 pulls matter off its companion star; this very hot disc makes it one of the brightest X-ray sources in the sky.' }, id: 'cygnus-x-1', kw: /disque d'accrétion très chaud/ },
];

// « Vie d'une étoile » : seuils de masse APPROXIMATIFS (en masses solaires), ordres de grandeur des manuels d'astrophysique
export const STAR_FATES = [
  { max: 0.08, fate: 'brown-dwarf', fr: ['Naine brune', 'Pas assez massive pour allumer durablement la fusion de l’hydrogène : ce n’est pas vraiment une étoile. Elle se refroidit lentement.'], en: ['Brown dwarf', 'Not massive enough to keep hydrogen fusion going: not quite a star. It slowly cools down.'] },
  { max: 8, fate: 'white-dwarf', fr: ['Naine blanche', 'L’étoile gonfle en géante rouge, rejette ses couches extérieures (nébuleuse planétaire) et laisse un cœur chaud de la taille de la Terre : une naine blanche. C’est le destin du Soleil.'], en: ['White dwarf', 'The star swells into a red giant, sheds its outer layers (planetary nebula) and leaves a hot, Earth-sized core: a white dwarf. This is the Sun’s fate.'] },
  { max: 20, fate: 'neutron-star', fr: ['Supernova puis étoile à neutrons', 'Son cœur s’effondre d’un coup : l’étoile explose en supernova et laisse une étoile à neutrons, une boule de 20 km plus lourde que le Soleil. Certaines sont des pulsars.'], en: ['Supernova, then neutron star', 'Its core suddenly collapses: the star explodes as a supernova and leaves a neutron star, a 20 km ball heavier than the Sun. Some are pulsars.'] },
  { max: Infinity, fate: 'black-hole', fr: ['Supernova puis trou noir', 'Le cœur est si massif que rien n’arrête son effondrement : il devient un trou noir, souvent après une supernova.'], en: ['Supernova, then black hole', 'The core is so massive that nothing stops its collapse: it becomes a black hole, often after a supernova.'] },
];
export const fateOf = m => STAR_FATES.find(f => m < f.max);
// durée de vie sur la séquence principale ≈ 10 milliards d'années × M^-2,5 (approximation classique, M en masses solaires)
export const lifetimeGyr = m => 10 * m ** -2.5;
