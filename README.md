# Encyclopédie spatiale

Encyclopédie spatiale interactive façon « fiche + collection », pour la vulgarisation et les universités d'astrophysique.
Une grille de cartes (image, nom, code de catalogue, tags), une fiche détaillée par objet (URL partageable `?o=<id>`),
recherche, filtres, comparateur de 2 à 3 objets à l'échelle, interface français / anglais, et une section « En direct » (ISS, image du jour NASA, Terre vue de DSCOVR, rovers martiens, recherche SIMBAD).

Le site compte **17 608 objets** (données du 25 novembre 2026), mis à jour automatiquement chaque semaine (voir « Mises à jour automatiques »). Chaque valeur affichée porte sa **source, son lien et sa date de mise à jour** ; une donnée absente de la source est affichée « non disponible » (rien n'est deviné).

## Pourquoi Astro

Le contenu est quasi entièrement statique (des milliers de fiches générées à partir de JSON), avec un peu d'interactivité côté client. Astro produit du HTML + JavaScript minimal sans framework lourd, se déploie tel quel sur Vercel, et accepte des fonctions serverless (`api/`) pour les parties « en direct » qui exigent une clé secrète. Next.js aurait ajouté un runtime React complet dont le site n'a pas besoin.

## Architecture

```
scripts/        imports (API officielles) -> normalisation -> data/*.json
  import-all.mjs        orchestrateur (utilisé par Vercel et par l'action GitHub)
  build-site-data.mjs   data/*.json -> public/data/index.json (cartes, léger) + public/data/o/<id>.json (fiches)
data/           JSON normalisés (généré, non versionné)
public/sky/     vues du ciel (DSS2) des étoiles et régions : versionnées (66 Mo), car coûteuses à regénérer
src/            site Astro (une page, scripts client sans framework)
api/ + lib/     fonctions serverless Vercel : ISS, APOD, EPIC, rovers, SIMBAD, flux vidéo
```

Le site lit uniquement `/data` (jamais les API directement), sauf pour la section « En direct » et la recherche SIMBAD, qui passent par nos fonctions serveur.
L'index des cartes est chargé une fois (≈ 3 Mo), les fiches à la demande, la grille affiche 48 cartes à la fois (chargement progressif), les images sont chargées paresseusement.

## Démarrage

```powershell
npm install
copy .env.example .env      # puis renseigner NASA_API_KEY et SSOD_TOKEN (jamais commités)
npm run import              # télécharge toutes les données (10 à 15 min la première fois)
npm run build               # génère le site dans dist/
npm run preview             # sert dist/ + les fonctions /api sur http://localhost:4322
```

Variables d'environnement :

| Variable | Rôle | Où l'obtenir |
|---|---|---|
| `SSOD_TOKEN` | jeton de l'API Système solaire OpenData (imports) | gratuit : <https://api.le-systeme-solaire.net/generatekey.html> |
| `NASA_API_KEY` | APOD et EPIC (fonctions serveur uniquement) | <https://api.nasa.gov> |

`.env` est dans `.gitignore` ; seul `.env.example` (vide) est versionné. La clé NASA n'est lue que par les fonctions serveur et n'apparaît ni dans le code, ni dans le build, ni dans les réponses.

## Déploiement (Vercel, gratuit)

1. Pousser le dépôt sur GitHub, puis « Add New Project » sur Vercel et choisir ce dépôt. `vercel.json` règle tout (framework Astro, `npm run build:all`, fonctions `api/`).
2. Dans *Settings → Environment Variables* du projet Vercel : ajouter `SSOD_TOKEN` et `NASA_API_KEY`.
3. *Settings → Git → Deploy Hooks* : créer un hook (ex. « weekly »), copier son URL.
4. Dans GitHub *Settings → Secrets and variables → Actions* : ajouter `SSOD_TOKEN`, `NASA_API_KEY` et `VERCEL_DEPLOY_HOOK` (l'URL du hook).

L'action `.github/workflows/weekly-update.yml` s'exécute chaque lundi (et à la demande) : elle relance tous les imports, construit le site pour vérifier la cohérence (une source requise indisponible = échec = on garde l'ancien déploiement), puis appelle le hook pour redéployer.

> Le build Vercel refait l'import complet (≈ 10 à 15 min, bien en deçà de la limite de 45 min).

## Sources officielles (liste exacte)

| Source | Ce qui est utilisé | Licence / conditions |
|---|---|---|
| **NASA Exoplanet Archive** (TAP, table `pscomppars`) — <https://exoplanetarchive.ipac.caltech.edu> | les 6 473 exoplanètes confirmées : paramètres planétaires (masse, rayon, période, température d'équilibre…), paramètres stellaires de leurs étoiles hôtes, références bibliographiques par valeur | données publiques NASA/IPAC |
| **Système solaire OpenData** — <https://api.le-systeme-solaire.net> | Soleil, 8 planètes, 4 planètes naines (Pluton, Éris, Hauméa, Makémaké), 479 lunes | jeton gratuit, citation de la source |
| **JPL Small-Body Database** (`sbdb_query`) — <https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html> | 4 995 petits corps : astéroïdes ≥ 50 km, tous les « potentiellement dangereux », astéroïdes visités par sonde, comètes périodiques numérotées + comètes célèbres, objets de Kuiper numérotés, ʻOumuamua, 2I/Borisov, 3I/ATLAS, Cérès | données publiques NASA/JPL |
| **SIMBAD / CDS** (TAP + résolveur de noms) — <https://simbad.cds.unistra.fr> | 4 801 objets : étoiles hôtes d'exoplanètes, étoiles de magnitude V < 3, étoiles à moins de ≈ 5 pc, objets compacts emblématiques, catalogue Messier (110), objets NGC/IC célèbres ; recherche en direct pour tout le reste | usage libre avec citation (CDS) |
| **Union astronomique internationale** — <https://www.iau.org/public/themes/constellations/> | les 88 constellations officielles (noms, abréviations, génitifs) | liste officielle |
| **NASA NSSDCA** (Master Catalog) — <https://nssdc.gsfc.nasa.gov/nmc/> | 29 missions : dates, lanceur, site, masse, agence, description | domaine public NASA |
| **NASA Science** (pages missions) — <https://science.nasa.gov/missions/> | 9 missions en repli (Hubble, Cassini, Galileo, SOHO, Ulysses, Magellan, DART, JUICE, Europa Clipper) | contenu public NASA |
| **NASA — ISS Facts and Figures** + **ISS Trajectory Data (OEM, JSC)** | faits de l'ISS ; position en direct calculée depuis l'éphéméride officielle | contenu public NASA |
| **NASA APIs** (`api.nasa.gov`, `NASA_API_KEY`) | APOD (repli sur apod.nasa.gov quand l'API renvoie une entrée vide), EPIC / DSCOVR | public NASA ; certaines images APOD sont protégées : crédit affiché |
| **NASA/JPL Mars raw images** | dernières images brutes de Curiosity et Perseverance | public NASA/JPL |
| **NASA SkyView / DSS2** — <https://skyview.gsfc.nasa.gov> | une vue du ciel centrée sur chaque étoile et région sans photo | Digitized Sky Surveys (STScI/Palomar) : usage éducatif et non commercial |
| **NASA Image and Video Library** — <https://images.nasa.gov> | photos et illustrations vérifiées une à une (planètes, lunes, nébuleuses, galaxies…) | domaine public NASA (hors mention contraire) |
| **Wikimedia Commons** — <https://commons.wikimedia.org> | cartes UAI des constellations (CC BY 3.0/4.0 : « IAU and Sky & Telescope »), images NASA/ESA/ESO/EHT d'étoiles, trous noirs, pulsars, missions, petits corps | licence libre **vérifiée par fichier** (domaine public, CC0, CC BY, CC BY-SA) ; crédit et lien conservés |
| **GWOSC** (LIGO/Virgo/KAGRA) — <https://gwosc.org> | 268 événements d'ondes gravitationnelles confirmés (masses, distance, rapport signal/bruit) | CC BY 4.0 |
| **NASA GSFC Eclipse Web Site** (F. Espenak) — <https://eclipse.gsfc.nasa.gov> | 224 éclipses de Soleil et 228 de Lune, 2001-2100 | citation demandée |
| **Natural Earth** (contour des terres) | fond de carte de l'ISS | domaine public |
| **YouTube** (flux officiels NASA et Sen) | lecteur « ISS TV », chargé seulement après un clic | conditions YouTube |

## Ce qui est couvert, ce qui ne l'est pas

**Couvert**
- *Planètes* : 8 planètes, 5 planètes naines, 479 lunes, **toutes** les exoplanètes confirmées (6 473).
- *Étoiles* : 4 641 (types spectraux O–M, naines brunes et blanches, étoiles à neutrons, pulsars, magnétars, trous noirs).
- *Régions* : 159 (galaxies, amas de galaxies, nébuleuses, amas ouverts et globulaires).
- *Petits corps* : 4 994 (astéroïdes, comètes, objets de Kuiper, interstellaires).
- *Événements* (onglet dédié, filtre « À venir / Passés ») : **agenda du ciel des 12 prochains mois** en tête, puis 268 ondes gravitationnelles, 224 éclipses solaires, 228 éclipses lunaires, et les événements à venir ci-dessous.
- *Autres* : 88 constellations, 39 missions et sondes dont l'ISS.
- *En direct* : ISS (position + vidéo), APOD, EPIC, rovers, recherche SIMBAD.
- *Événements à venir* : maxima des pluies de météores (calendrier officiel IMO, année en cours et suivante), oppositions des planètes, plus grandes élongations de Mercure et Vénus, rapprochements de planètes (calculés au pas d'un jour avec les éphémérides **JPL Horizons**), éclipses.
- *Graphiques interactifs* : masse–rayon des exoplanètes (les valeurs **estimées** par la NASA via une relation masse-rayon sont séparées des valeurs mesurées et masquées par défaut), diagramme de Hertzsprung-Russell (magnitude absolue calculée, sans correction d'extinction), découvertes d'exoplanètes par année et par méthode ; survol, clic vers la fiche, zoom par sélection, légende filtrante, export PNG/CSV.

**Non couvert ou partiel (à dire clairement)**
- Les étoiles et galaxies **ne sont pas toutes** importées (des milliards) : le catalogue local en contient ~4 800 ; le reste passe par la recherche SIMBAD en direct (bouton qui apparaît sous la barre de recherche).
- **Bras spiraux** : non importés (aucune source officielle structurée trouvée).
- Astéroïdes : seulement ceux ≥ 50 km, dangereux ou visités (≈ 1,4 million existent) ; comètes : seulement numérotées + célèbres ; Kuiper : seulement les objets numérotés.
- Missions : 39 sur la centaine de grandes missions. Manquent notamment Gaia, Rosetta, Mars Express, Herschel, Planck, Hayabusa2 (sites ESA/JAXA injoignables), Sputnik 1, Vostok 1 ; le catalogue NSSDCA renvoie une erreur pour une partie des missions NASA (le script les réessaie à chaque import).
- Événements : seulement les ondes gravitationnelles confirmées (probabilité astrophysique ≥ 0,9) et les éclipses 2001-2100 ; pas de météores, comètes à venir ni conjonctions.
- Magnétars SGR 1806-20, SGR 1900+14, SGR 1935+2154, SGR 0526-66, TON 618 et Abell 2744 : introuvables dans SIMBAD sous ces identifiants.
- 548 étoiles hôtes d'exoplanètes sur 4 865 n'ont pas été retrouvées dans SIMBAD (leurs fiches de planètes existent, mais pas celle de l'étoile).
- **Images** : seules **19 exoplanètes** sur 6 473 ont une illustration d'artiste (pas de photo possible) ; les autres affichent « Pas d'image disponible ». Aucune image générique ou générée n'est utilisée.

## Valeurs calculées (et signalées comme telles sur le site)

- **Zone habitable** des exoplanètes : modèle conservateur de Kopparapu et al. (2013), à partir de la température et de la luminosité de l'étoile ; ce n'est pas une mesure.
- **Distance des étoiles** sans valeur NASA : 1000 / parallaxe (SIMBAD), avec incertitude seulement si la parallaxe est fiable.
- **Classification des exoplanètes** (tellurique, super-Terre, type Neptune, géante gazeuse) : par rayon (convention de la NASA), repli sur la masse.
- **Position de l'ISS** : interpolation d'Hermite de l'éphéméride officielle, précession + rotation terrestre (nutation négligée) ; précision de l'ordre de quelques km. L'ombre de la Terre est modélisée par un cylindre.
- **Schémas d'orbite** des petits corps sans photo : calculés à partir des éléments orbitaux du JPL (vue du dessus, échelle racine carrée).

## Images et licences

- Chaque image affiche son **crédit, sa licence et un lien vers sa source**.
- Les illustrations d'artiste sont marquées « illustration » ; les vues du ciel (DSS2) « vue du ciel » avec un cercle de repérage ; les schémas d'orbite « orbite ».
- Les textes de vulgarisation (descriptions) sont rédigés pour ce projet ; les chiffres viennent exclusivement des données sourcées. La fiche l'indique.
- Aucun asset ni design Pokémon n'est utilisé.

## Accessibilité et responsive

Navigation clavier (cartes = liens, fiches dans `<dialog>`, focus visible), lien d'évitement, étiquettes ARIA, annonces `aria-live` (résultats, ISS), respect de `prefers-reduced-motion`, contrastes élevés sur fond sombre, mise en page adaptée mobile (filtres repliables, lecteur vidéo empilé).
Un test automatique **axe-core** (WCAG 2.1 A/AA, hors contraste) passe sur le HTML statique des pages (`npm test`). **Non audités automatiquement** : le contraste, et les vues construites dynamiquement (fiches, comparateur, direct). Un audit manuel avec lecteur d'écran reste à faire.

## Données ouvertes, citation, qualité (pour l'enseignement et la recherche)

- **Page « Méthodologie et données »** (`/methodologie/`, FR/EN) : sources et dates d'import, valeurs calculées et hypothèses, politique éditoriale, licences, confidentialité, limites.
- **Exports** : CSV global et par catégorie (`/export/*.csv`), JSON public (`/data/index.json`, `/data/o/<id>.json`, `/data/meta.json`), bouton « Exporter ces résultats (CSV) » sur la grille filtrée.
- **Citation** : bouton « Citer » sur chaque fiche (texte + BibTeX, lien permanent `?o=<id>`, **version des données** `AAAA.MM.JJ`, date de consultation) ; `CITATION.cff` pour le projet.
- **Provenance** : chaque donnée est rattachée à sa source ; les valeurs calculées sont signalées ; les textes de vulgarisation sont distingués des données.
- **Relecture scientifique** : *aucun relecteur à ce jour*. Les **données** viennent de sources officielles (NASA, JPL, CDS…), mais les **textes de vulgarisation** et les **méthodes de calcul** sont de la rédaction de ce projet et n'ont pas été validés par un expert ; la fiche l'affiche. Pour nommer un relecteur : `scripts/review.json` (son nom et la date apparaissent alors sur les fiches).
- **Tests automatiques** (`npm test`, 12 tests) : unicité des identifiants, valeurs finies et sourcées, plausibilité physique (excentricité < 1, masses et rayons réalistes…), crédits et licences des images, cohérence des descriptions, couverture minimale, exports CSV, position et jour/nuit de l'ISS, accessibilité statique. Ils tournent dans l'action hebdomadaire **avant** tout redéploiement.
- **Licences** : code sous MIT (`LICENSE`) ; données et images sous la licence de leur source (`DATA-LICENSES.md`).

## Mises à jour automatiques

| Se met à jour tout seul (chaque lundi) | Reste manuel (à ajouter dans le code) |
|---|---|
| nouvelles exoplanètes confirmées et paramètres révisés (badge « nouveau » pendant 6 mois) ; nouvelles ondes gravitationnelles ; astéroïdes ≥ 50 km / dangereux, comètes numérotées, objets de Kuiper numérotés ; paramètres SIMBAD des objets déjà listés ; ISS, flux vidéo, APOD, EPIC, rovers (en direct) | **nouvelles missions** (`scripts/import-missions.mjs`), **images** (`scripts/images-*.json`), **textes** (`scripts/descriptions.json`), objets « emblématiques » (`scripts/simbad-curated.mjs`) |

Une nouvelle exoplanète apparaît donc sans intervention (sans image ni description rédigée : texte généré à partir des données). Une nouvelle mission, elle, doit être ajoutée à la liste d'identifiants.

## Limites connues

- Les flux vidéo de l'ISS sont noirs quand la station est dans l'ombre de la Terre (≈ 35 min par orbite) ; seul le flux Sen permet de revenir en arrière.
- Les appels `/api/*` ont été testés en local (`npm run preview`) ; le comportement sur Vercel est à confirmer au premier déploiement.
- `public/sky/` (66 Mo) est versionné ; les images du ciel ne sont pas régénérées par l'action hebdomadaire.
