// Les 88 constellations officielles de l'Union astronomique internationale (UAI).
// Source : https://www.iau.org/public/themes/constellations/  (liste figée depuis 1922/1930).
// Colonnes : nom latin, abréviation UAI, génitif, nom français, signification (EN).
import { writeJson, slug } from './lib/common.mjs';

const L = `Andromeda|And|Andromedae|Andromède|Andromeda (the chained princess)
Antlia|Ant|Antliae|Machine pneumatique|Air pump
Apus|Aps|Apodis|Oiseau de paradis|Bird of paradise
Aquarius|Aqr|Aquarii|Verseau|Water bearer
Aquila|Aql|Aquilae|Aigle|Eagle
Ara|Ara|Arae|Autel|Altar
Aries|Ari|Arietis|Bélier|Ram
Auriga|Aur|Aurigae|Cocher|Charioteer
Boötes|Boo|Boötis|Bouvier|Herdsman
Caelum|Cae|Caeli|Burin|Chisel
Camelopardalis|Cam|Camelopardalis|Girafe|Giraffe
Cancer|Cnc|Cancri|Cancer|Crab
Canes Venatici|CVn|Canum Venaticorum|Chiens de chasse|Hunting dogs
Canis Major|CMa|Canis Majoris|Grand Chien|Greater dog
Canis Minor|CMi|Canis Minoris|Petit Chien|Lesser dog
Capricornus|Cap|Capricorni|Capricorne|Sea goat
Carina|Car|Carinae|Carène|Keel
Cassiopeia|Cas|Cassiopeiae|Cassiopée|Cassiopeia (the queen)
Centaurus|Cen|Centauri|Centaure|Centaur
Cepheus|Cep|Cephei|Céphée|Cepheus (the king)
Cetus|Cet|Ceti|Baleine|Sea monster (whale)
Chamaeleon|Cha|Chamaeleontis|Caméléon|Chameleon
Circinus|Cir|Circini|Compas|Compasses
Columba|Col|Columbae|Colombe|Dove
Coma Berenices|Com|Comae Berenices|Chevelure de Bérénice|Berenice's hair
Corona Australis|CrA|Coronae Australis|Couronne australe|Southern crown
Corona Borealis|CrB|Coronae Borealis|Couronne boréale|Northern crown
Corvus|Crv|Corvi|Corbeau|Crow
Crater|Crt|Crateris|Coupe|Cup
Crux|Cru|Crucis|Croix du Sud|Cross
Cygnus|Cyg|Cygni|Cygne|Swan
Delphinus|Del|Delphini|Dauphin|Dolphin
Dorado|Dor|Doradus|Dorade|Dolphinfish
Draco|Dra|Draconis|Dragon|Dragon
Equuleus|Equ|Equulei|Petit Cheval|Little horse
Eridanus|Eri|Eridani|Éridan|River Eridanus
Fornax|For|Fornacis|Fourneau|Furnace
Gemini|Gem|Geminorum|Gémeaux|Twins
Grus|Gru|Gruis|Grue|Crane
Hercules|Her|Herculis|Hercule|Hercules
Horologium|Hor|Horologii|Horloge|Pendulum clock
Hydra|Hya|Hydrae|Hydre femelle|Water snake
Hydrus|Hyi|Hydri|Hydre mâle|Lesser water snake
Indus|Ind|Indi|Indien|Indian
Lacerta|Lac|Lacertae|Lézard|Lizard
Leo|Leo|Leonis|Lion|Lion
Leo Minor|LMi|Leonis Minoris|Petit Lion|Lesser lion
Lepus|Lep|Leporis|Lièvre|Hare
Libra|Lib|Librae|Balance|Scales
Lupus|Lup|Lupi|Loup|Wolf
Lynx|Lyn|Lyncis|Lynx|Lynx
Lyra|Lyr|Lyrae|Lyre|Lyre
Mensa|Men|Mensae|Table|Table mountain
Microscopium|Mic|Microscopii|Microscope|Microscope
Monoceros|Mon|Monocerotis|Licorne|Unicorn
Musca|Mus|Muscae|Mouche|Fly
Norma|Nor|Normae|Règle|Carpenter's square
Octans|Oct|Octantis|Octant|Octant
Ophiuchus|Oph|Ophiuchi|Ophiuchus|Serpent bearer
Orion|Ori|Orionis|Orion|Orion (the hunter)
Pavo|Pav|Pavonis|Paon|Peacock
Pegasus|Peg|Pegasi|Pégase|Pegasus (winged horse)
Perseus|Per|Persei|Persée|Perseus (the hero)
Phoenix|Phe|Phoenicis|Phénix|Phoenix
Pictor|Pic|Pictoris|Peintre|Painter's easel
Pisces|Psc|Piscium|Poissons|Fishes
Piscis Austrinus|PsA|Piscis Austrini|Poisson austral|Southern fish
Puppis|Pup|Puppis|Poupe|Stern
Pyxis|Pyx|Pyxidis|Boussole|Compass
Reticulum|Ret|Reticuli|Réticule|Reticle
Sagitta|Sge|Sagittae|Flèche|Arrow
Sagittarius|Sgr|Sagittarii|Sagittaire|Archer
Scorpius|Sco|Scorpii|Scorpion|Scorpion
Sculptor|Scl|Sculptoris|Sculpteur|Sculptor
Scutum|Sct|Scuti|Écu de Sobieski|Shield
Serpens|Ser|Serpentis|Serpent|Serpent
Sextans|Sex|Sextantis|Sextant|Sextant
Taurus|Tau|Tauri|Taureau|Bull
Telescopium|Tel|Telescopii|Télescope|Telescope
Triangulum|Tri|Trianguli|Triangle|Triangle
Triangulum Australe|TrA|Trianguli Australis|Triangle austral|Southern triangle
Tucana|Tuc|Tucanae|Toucan|Toucan
Ursa Major|UMa|Ursae Majoris|Grande Ourse|Great bear
Ursa Minor|UMi|Ursae Minoris|Petite Ourse|Little bear
Vela|Vel|Velorum|Voiles|Sails
Virgo|Vir|Virginis|Vierge|Maiden
Volans|Vol|Volantis|Poisson volant|Flying fish
Vulpecula|Vul|Vulpeculae|Petit Renard|Little fox`;

const today = new Date().toISOString().slice(0, 10);
const objects = L.split('\n').map(l => {
  const [name, abbr, gen, fr, en] = l.split('|');
  return { id: `constellation-${slug(name)}`, cat: 'other', sub: 'constellation', name, nameFr: fr, code: abbr,
    aliases: [gen], tags: ['constellation'], meaning: en, genitive: gen, props: {}, src: 'iau', updated: today };
});
if (objects.length !== 88) throw new Error(`${objects.length} constellations au lieu de 88`);
await writeJson('constellations.json', { source: { id: 'iau', name: 'Union astronomique internationale (UAI)', url: 'https://www.iau.org/public/themes/constellations/', license: 'Liste officielle, usage libre avec citation', fetched: today }, objects });
