// Catalogue des jeux (/jeux/). « ready: true » = jeu disponible ; les autres apparaissent comme « bientôt ».
// Tous les jeux sont libres d'accès : ni âge, ni niveau à débloquer, ni compte.
export const GAME_SECTIONS = [
  { id: 'systeme-solaire', icon: '🪐', fr: 'Système solaire', en: 'Solar System', games: [
    { slug: 'ordre-des-planetes', ready: true, fr: ['L’ordre des planètes', 'Range les huit planètes depuis le Soleil.'], en: ['Order of the planets', 'Put the eight planets in order from the Sun.'] },
    { slug: 'devine-la-planete', ready: true, fr: ['Devine la planète', 'Trois indices tirés des vraies données : moins tu en utilises, plus tu gagnes.'], en: ['Guess the planet', 'Three clues from real data: the fewer you use, the more you score.'] },
    { slug: 'le-plus-grand', ready: true, fr: ['Qui est le plus grand ?', 'Deux astres : le plus grand, le plus chaud ou le plus lourd ?'], en: ['Which is bigger?', 'Two bodies: which is bigger, hotter or heavier?'] },
    { slug: 'lunes-mysterieuses', ready: true, fr: ['Les lunes mystérieuses', 'Associe chaque lune à sa particularité.'], en: ['Mysterious moons', 'Match each moon with what makes it special.'] },
  ] },
  { id: 'etoiles-univers', icon: '✨', fr: 'Étoiles et univers', en: 'Stars and universe', games: [
    { slug: 'vie-d-une-etoile', ready: true, fr: ['Vie d’une étoile', 'Choisis une masse et découvre la naissance et la fin de l’étoile.'], en: ['Life of a star', 'Pick a mass and discover how the star is born and ends.'] },
    { slug: 'zoom-univers', ready: true, fr: ['Zoom sur l’univers', 'De la Terre à l’univers, avec les ordres de grandeur.'], en: ['Zoom through the universe', 'From Earth to the universe, with orders of magnitude.'] },
    { slug: 'trous-noirs-vrai-faux', ready: true, fr: ['Trous noirs : vrai ou faux ?', 'Trie les affirmations, avec explication.'], en: ['Black holes: true or false?', 'Sort the statements, with explanations.'] },
  ] },
  { id: 'exoplanetes', icon: '🌍', fr: 'Exoplanètes', en: 'Exoplanets', games: [
    { slug: 'habitable-ou-pas', ready: true, fr: ['Habitable ou pas ?', 'Une vraie exoplanète : est-elle dans la zone habitable de son étoile ?'], en: ['Habitable or not?', 'A real exoplanet: is it in its star’s habitable zone?'] },
    { slug: 'chasseur-d-exoplanetes', fr: ['Chasseur d’exoplanètes', 'Repère la baisse de lumière quand une planète passe devant son étoile.'], en: ['Exoplanet hunter', 'Spot the dip in light when a planet passes in front of its star.'] },
  ] },
  { id: 'ciel', icon: '🌌', fr: 'Ciel et observation', en: 'Sky and observing', games: [
    { slug: 'relie-les-etoiles', fr: ['Relie les étoiles', 'Trace les constellations en reliant les points.'], en: ['Join the stars', 'Draw the constellations by joining the dots.'] },
    { slug: 'ciel-de-ce-soir', fr: ['Le ciel de ce soir', 'Les prochains événements du ciel, avec une question pour chacun.'], en: ['Tonight’s sky', 'Upcoming sky events, with a question for each.'] },
  ] },
  { id: 'missions', icon: '🛰️', fr: 'Missions et exploration', en: 'Missions and exploration', games: [
    { slug: 'choisis-ta-destination', fr: ['Choisis ta destination', 'Temps de trajet, dangers et bagages pour aller vers un astre.'], en: ['Choose your destination', 'Travel time, hazards and luggage to reach a world.'] },
    { slug: 'mission-objectif', fr: ['Quelle mission pour quel objectif ?', 'Associe une sonde ou un télescope à ses découvertes.'], en: ['Which mission for which goal?', 'Match a probe or telescope with its discoveries.'] },
  ] },
  { id: 'defis', icon: '🏆', fr: 'Défis et collection', en: 'Challenges and collection', games: [
    { slug: 'defi-du-jour', fr: ['Défi du jour', 'Une question par jour et ta série de jours.'], en: ['Daily challenge', 'One question a day and your streak.'] },
    { slug: 'collection', ready: true, fr: ['Ma collection', 'Les objets débloqués par tes bonnes réponses, et tes badges.'], en: ['My collection', 'Objects unlocked by your right answers, and your badges.'] },
    { slug: 'duel', fr: ['Duel', 'Deux joueurs sur le même écran, mêmes questions.'], en: ['Duel', 'Two players on the same screen, same questions.'] },
  ] },
];
