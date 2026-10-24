# MyTube SEO — extension Firefox pour YouTube

Boîte à outils complète pour créateurs YouTube, inspirée de l'ensemble des fonctionnalités de TubeBuddy (projet indépendant, sans lien avec TubeBuddy) :
recherche de mots-clés, SEO, tags, suivi de classement, concurrents, miniatures, commentaires, traitement en masse, tests A/B, mises à jour programmées, Analytics…

- **Interface entièrement en français**, thème clair/sombre.
- **Fonctionne sans compte ni serveur** : les données publiques sont lues directement sur YouTube depuis votre navigateur.
- Options facultatives : clé API YouTube (précision), connexion Google (gestion de votre chaîne), clé API Claude (IA).
- Toutes les données restent dans Firefox (stockage local).

## Installation

### Essai immédiat (module temporaire)

1. Ouvrez `about:debugging#/runtime/this-firefox` dans Firefox (version 140 ou plus récente).
2. Cliquez sur **« Charger un module complémentaire temporaire… »** et choisissez le fichier `extension/manifest.json`.
3. La page de bienvenue s'ouvre : autorisez l'accès à YouTube et indiquez votre chaîne.

Un module temporaire est retiré à la fermeture de Firefox (vos données sont conservées tant que l'identifiant de l'extension ne change pas).

### Installation permanente

```bash
npm install
npm run build        # crée web-ext-artifacts/mytube_seo-1.0.0.zip
```

Firefox n'installe durablement que des extensions signées : soumettez l'archive sur [addons.mozilla.org](https://addons.mozilla.org/developers/) en distribution « non listée » (signature automatique, quelques minutes), puis installez le fichier `.xpi` signé. Sur Firefox Developer Edition / Nightly, vous pouvez aussi désactiver `xpinstall.signatures.required` dans `about:config`.

## Fonctionnalités

Légende des prérequis : — aucun · 🔑 clé API YouTube (facultative, améliore la précision) · 🔐 connexion Google (OAuth) · ✨ clé API Claude.

### Directement sur YouTube

| Fonction TubeBuddy | Dans MyTube SEO | Prérequis |
| --- | --- | --- |
| Videolytics, View & Copy Tags, Tag Rankings | Panneau à droite de chaque vidéo (et des Shorts) : vues, vues/jour, j'aime, commentaires, engagement, tags copiables, **classement de la vidéo pour chaque tag**, score SEO, audit de démonétisation, outils | — |
| Search Explorer, Instasuggest, SEO score des résultats | Panneau sur les résultats de recherche : score du mot-clé (global, volume, concurrence, optimisation, pondéré pour votre chaîne), recherches associées, **tags les plus utilisés**, badges « #rang · vues/jour · tags · SEO » sur chaque résultat | — |
| Channelytics | Panneau sur les chaînes : abonnés, vues, rythme de publication, revenus estimés, mots-clés de chaîne, liens, raccourcis | — |
| Canned Responses, Emoji Picker, Comment Formatting | Barre d'outils sous chaque zone de commentaire (YouTube et Studio) : réponses types avec variables `{auteur}`, `{chaine}`, `{date}`, émojis, suggestions de réponses par IA | ✨ pour l'IA |
| SEO Studio intégré, Upload Checklist, Default Upload Profiles, Tag suggestions | **Assistant YouTube Studio** (modification et mise en ligne) : score SEO en direct, analyse du mot-clé, suggestions et ajout de tags en un clic, listes de tags, profils de mise en ligne, checklist par vidéo, émojis, génération IA | ✨ pour l'IA |
| Video Frame Grabber | Capture de l'image en cours de lecture → éditeur de miniatures | — |
| Keyboard Shortcuts, Quick Links | Raccourcis clavier, menu de l'icône avec liens Studio et contexte de l'onglet, menus contextuels (clic droit) | — |

### Tableau de bord (icône de l'extension → « Tableau de bord », ou `Alt+Maj+Y`)

| Fonction TubeBuddy | Dans MyTube SEO | Prérequis |
| --- | --- | --- |
| Keyword Explorer | Volume, concurrence, optimisation, score global et pondéré, meilleurs résultats, tags des concurrents, **longue traîne a→z**, idées de titres, historique, export CSV | — |
| SEO Studio | Rédaction titre/description/tags avec score en direct, aperçu dans les résultats, suggestions, application directe à une de vos vidéos | 🔐 pour appliquer |
| Tag Explorer, Tag Lists, Tag Sorter, Tag Translator, Tag Suggestions | Outils de tags : générateur, trieur par pertinence, listes réutilisables, traduction, compteur de caractères (méthode YouTube) | — |
| Title Generator, Description templates | Générateur de titres (modèles + IA), constructeur de descriptions structurées | ✨ pour l'IA |
| Search Insights, Opportunity Finder | Opportunités : mots-clés liés à votre chaîne (tags, mots-clés de chaîne, termes de recherche Analytics) avec score et votre position | 🔐 pour les termes Analytics |
| Video Translate | Traducteur de titre/description en 18 langues et publication comme localisations YouTube | 🔐 pour publier |
| Videolytics (complet) | Analyse détaillée, comparaison avec la médiane de la chaîne, classement et score de chaque tag, miniatures, vidéos suggérées | — |
| Channelytics (complet), Channel Valuation | Statistiques, revenus et valorisation estimés, jours de publication, courbe des vues, vidéos récentes vs médiane, tags les plus utilisés | — |
| Search Rank Tracking | Suivi de position de vos vidéos sur des mots-clés, historique et graphique, vérification automatique, notifications | — |
| Competitor Scorecard | Concurrents : tableau comparatif (vous inclus), croissance 7/30 jours, graphiques, dernières vidéos, instantanés quotidiens | — |
| Best Time to Publish | Carte de chaleur jour × heure des performances corrigées de l'âge, recommandations, comparaison avec les concurrents | 🔑 pour plus de vidéos |
| Best Practice Audit, Health Report | Audit de chaîne : santé globale, régularité, tendance, score SEO de chaque vidéo, termes sensibles | — |
| Demonetization Audit | Détection des termes à risque (violence, adulte, drogues, grossièretés, tragédies…) avec texte annoté | — |
| Retention Analyzer, statistiques | Analytics & rétention : vues, durée de visionnage, abonnés, sources de trafic, termes de recherche, pays, appareils, **courbe de rétention et points de décrochage** | 🔐 |
| Milestones | Objectifs & projections (date estimée des prochains paliers) | — |
| Video Topic Planner, Daily Ideas | Planificateur kanban (idée → publiée), score des mots-clés, idées générées par IA | ✨ pour l'IA |
| Thumbnail Generator | Éditeur de miniatures 1280×720 : image/capture/miniature existante, textes avec contour, bandeaux, flèches, cercles, logos, émojis, export < 2 Mo, envoi direct sur YouTube | 🔐 pour envoyer |
| Thumbnail Analyzer / Preview | Test en situation (accueil, recherche, mobile, thème sombre/clair) face aux miniatures concurrentes ; analyse (contraste, luminosité, couleurs, complexité, palette, aperçus réduits) | — |
| Pick a Winner, Comment Word Cloud, Sentiment, Comment Filters | Commentaires : tirage au sort équitable (aléatoire cryptographique, filtres), nuage de mots, expressions, sentiment, questions, filtres, export CSV | — |
| Brand Alerts | Alertes : nouvelles vidéos mentionnant votre marque ou un sujet, notifications | — |
| Share Tracker / Promo Materials | Suivi des partages par réseau social avec liens de partage | — |
| Bulk Processing (find & replace, append, tags, profils, thumbnail overlays) | Traitement en masse : rechercher/remplacer (y compris regex), ajout de texte, ajout/suppression/remplacement/copie de tags, profils, visibilité, **bandeaux sur miniatures** ; aperçu des différences et **restauration** | 🔐 |
| A/B Tests | Tests A/B de titres, miniatures ou descriptions (rotation automatique, vues/heure par variante, application du gagnant) | 🔐 |
| Scheduled Video Updates | Mises à jour programmées : titre, description, tags, miniature, visibilité | 🔐 |
| Video Export | Export CSV/JSON des vidéos d'une chaîne (y compris privées avec connexion) | 🔐 pour les vidéos privées |

## Configuration (Paramètres)

- **Région / langue** : les recherches et classements sont non personnalisés, pour la région choisie.
- **Clé API YouTube** (gratuite, 10 000 unités/jour) : Google Cloud Console → activer *YouTube Data API v3* → *Identifiants* → *Clé API*.
- **Connexion Google** (traitement en masse, tests A/B, mises à jour programmées, Analytics) : vous utilisez votre propre identifiant client OAuth, sans serveur intermédiaire. Dans Google Cloud Console : activez *YouTube Data API v3* et *YouTube Analytics API*, configurez l'écran de consentement (type externe, vous comme utilisateur test), créez un *ID client OAuth* de type **Application Web** avec l'URI de redirection affichée dans les paramètres, puis collez l'ID client. Le guide pas à pas est intégré à la page.
- **Clé API Claude** (facultative) : génération de titres, descriptions, tags, idées, textes de miniatures, réponses aux commentaires et traductions (modèles Claude Opus 5.5, Sonnet 5.5 ou Haiku 5.5).
- **Tâches automatiques** : fréquence des vérifications (classements, concurrents, alertes), journal et exécution manuelle.
- **Données** : sauvegarde/restauration JSON, effacement complet.

## Raccourcis clavier

| Raccourci | Action |
| --- | --- |
| `Alt+Maj+Y` | Ouvrir le tableau de bord (partout) |
| `Alt+Maj+K` | Explorateur de mots-clés (partout) |
| `Alt+Maj+T` | Copier les tags de la vidéo |
| `Alt+Maj+V` | Videolytics complet de la vidéo |
| `Alt+Maj+E` | Modifier la vidéo dans Studio |
| `Alt+Maj+C` | Capturer l'image pour une miniature |
| `Alt+Maj+P` | Masquer / afficher les panneaux |

Les deux premiers se modifient dans `about:addons` → ⚙️ → *Gérer les raccourcis*.

## Limites (à connaître)

- **Volumes de recherche** : YouTube ne publie pas de volumes exacts. Les scores sont des estimations relatives fondées sur l'autocomplétion YouTube et les performances des meilleurs résultats.
- **Données publiques** : elles proviennent de l'API interne du site YouTube, non documentée ; un changement côté YouTube peut nécessiter une mise à jour de l'extension. La clé API officielle sert de complément quand elle est renseignée.
- **Tests A/B** : l'API publique ne fournit pas le taux de clics des impressions ; le gagnant est déterminé par les vues/heure, chaque variante étant active la même durée.
- **Non disponible via l'API YouTube** : cartes, écrans de fin et modèles de fiches (copie en masse impossible), taux de clics des impressions.
- **Tâches automatiques** (classements, concurrents, alertes, tests A/B, mises à jour programmées) : elles s'exécutent quand Firefox est ouvert ; sinon, à la réouverture.
- **YouTube Studio** : l'assistant lit et remplit les champs de la page ; si Studio change sa structure, l'insertion de tags peut se replier sur une copie dans le presse-papiers.
- **Miniatures personnalisées** : nécessitent une chaîne validée. Coût en quota : 50 unités par modification de vidéo ou de miniature.

## Confidentialité

Aucune donnée n'est envoyée au développeur. L'extension contacte uniquement YouTube/Google (données, API, traduction) et, si vous l'activez, l'API Claude d'Anthropic. Clés et jetons sont stockés localement dans Firefox ; la sauvegarde exportée n'inclut pas le jeton Google.

## Développement

```
extension/
  manifest.json          Manifest V3 (Firefox)
  lib/                   bibliothèques partagées (données YouTube, SEO, mots-clés, API Google, OAuth, IA, composants)
  background/            routeur de messages, tâches périodiques, menus, raccourcis
  content/               panneaux injectés dans YouTube et YouTube Studio
  app/                   tableau de bord (≈ 30 outils) — app/views/*.js
  popup/                 menu de l'icône
tests/                   tests unitaires (node:test) des analyseurs et des scores
```

```bash
npm install
npm test          # tests unitaires
npm run lint      # validation web-ext (règles addons.mozilla.org)
npm start         # lance Firefox avec l'extension chargée (web-ext run)
npm run build     # archive prête à signer
npm run format    # formatage Prettier
```

Le code n'utilise ni `innerHTML` ni code distant : toute l'interface est construite avec des fonctions DOM (`MT.el`), compatible avec les Trusted Types de YouTube.
