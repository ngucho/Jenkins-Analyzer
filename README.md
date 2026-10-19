# Jenkins Analyzer

Application web qui lit l'API REST de Jenkins pour **visualiser la charge de travail** de la
machine : chronologie des builds, plages creuses, semaine type et créneaux de maintenance
recommandés. L'objectif : **mieux répartir les jobs** et **savoir quand intervenir** sur la machine
sans casser de build.

Angular 20, sans backend : le navigateur interroge Jenkins directement.

## Démarrage rapide

```bash
npm install
npm start          # http://localhost:4200, en mode démo
```

Pour brancher votre Jenkins : **Paramètres** → *Jenkins* → URL, utilisateur, token API →
*Tester la connexion*. Si Jenkins refuse les appels du navigateur (CORS) :

```bash
cp .env.example .env        # Windows : copy .env.example .env
```

Éditez ensuite `.env` :

```ini
JENKINS_URL=https://jenkins.mon-entreprise.fr
# JENKINS_INSECURE=true     # certificat auto-signé ou d'autorité interne
```

Relancez `npm start` : le terminal affiche `[jenkins-proxy] /jenkins-proxy/* -> <votre URL>`.
Le fichier `.env` est ignoré par Git (il reste sur votre poste).

puis cochez *Passer par le proxy de développement*.

## Ce que montre l'application

- **Indicateurs** : builds, taux d'occupation, temps libre, temps machine, pic de concurrence
  par rapport aux exécuteurs, plus longue plage creuse.
- **Chronologie** : courbe de charge, capacité, plages creuses, chaque build coloré selon son
  résultat. Glisser pour zoomer, cliquer sur un build pour l'ouvrir dans Jenkins.
- **Semaine type** : charge moyenne par jour et par heure, et les créneaux de maintenance
  hebdomadaires les plus calmes.
- **Plages creuses** : les plus longues périodes sans aucun build.
- **Jobs** : exécutions, durées, temps cumulé, part de charge, taux de succès.

## Documentation

| Document | Pour qui, pour quoi |
| --- | --- |
| [Prise en main](docs/getting-started.md) | **Commencez ici.** Installer, lancer, brancher Jenkins, visite du code, premier exercice, dépannage |
| [Fonctionnalités](docs/features.md) | Ce qui a été fait et pourquoi, définition de chaque indicateur, calcul des créneaux de maintenance |
| [Architecture](docs/architecture.md) | Découpage en couches, flux de données, choix techniques et leurs raisons, carte des fichiers |
| [Interrogation de Jenkins](docs/jenkins-api.md) | Requêtes envoyées, authentification, robustesse, CORS et déploiement en production |
| [Guide de développement](docs/development.md) | Conventions, où mettre quel code, recettes pas à pas, tests, pistes d'évolution |

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm start` | Serveur de dev (+ proxy Jenkins) |
| `npm run build` | Build de production dans `dist/` |
| `npm test` | Tests unitaires (watch) |
| `npm run test:ci` | Tests unitaires en headless (CI, conteneurs) |

## Structure

```
src/app/
├── core/domain/      Modèles et calculs métier — TypeScript pur, testé
├── core/ports/       Contrats des sources de données
├── application/      État de l'écran (signals)
├── infrastructure/   Jenkins HTTP, mode démo, localStorage
└── presentation/     Pages et composants Angular
```
