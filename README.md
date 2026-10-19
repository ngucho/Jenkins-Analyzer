# Jenkins Workload

Application Angular (sans backend) qui interroge l’API REST de Jenkins pour visualiser la charge
de travail de la machine : chronologie des builds, plages creuses, semaine type et créneaux de
maintenance recommandés.

## Démarrage

```bash
npm install
npm start                # http://localhost:4200
```

Au premier lancement, l’application est en **mode démo** (données fictives réalistes).
Dans **Paramètres**, choisissez *Jenkins* et renseignez :

| Champ | Valeur |
| --- | --- |
| URL de Jenkins | `https://jenkins.mon-entreprise.fr` |
| Utilisateur | votre identifiant Jenkins |
| Token API | profil › *Security* › *API Token* › *Add new token* (un compte en lecture seule suffit) |

« Tester la connexion » vérifie l’accès et affiche la version, le nombre de jobs et d’exécuteurs.
La configuration est stockée dans le `localStorage` du navigateur, rien n’est envoyé ailleurs.

### CORS

Le navigateur appelle Jenkins directement. Si Jenkins ne renvoie pas d’en-têtes CORS, utilisez :

- **En développement** : le proxy intégré.
  ```bash
  JENKINS_URL=https://jenkins.mon-entreprise.fr npm start
  ```
  puis cochez *Passer par le proxy de développement*. (`JENKINS_INSECURE=true` pour un certificat auto-signé.)
- **En production** : servez l’application et Jenkins depuis la même origine, par exemple avec nginx :
  ```nginx
  location /jenkins-proxy/ { proxy_pass https://jenkins.mon-entreprise.fr/; }
  location / { root /srv/jenkins-workload/browser; try_files $uri /index.html; }
  ```
  et cochez la même option (l’application appelle alors `/jenkins-proxy/...`).
  Alternative : le plugin Jenkins *CORS Filter*.

## Ce que montre le tableau de bord

- **Indicateurs** : nombre de builds, taux d’occupation (temps avec ≥ 1 build), temps libre,
  temps machine cumulé, pic de concurrence vs exécuteurs en ligne, plus longue plage creuse.
- **Chronologie** : charge (builds simultanés moyens + pic), capacité, plages creuses en vert,
  et chaque build sur sa ligne coloré selon son résultat. Glisser pour zoomer, cliquer sur un build
  pour l’ouvrir dans Jenkins.
- **Semaine type** : charge moyenne par jour × heure sur toute la période, avec les créneaux
  de maintenance récurrents les plus calmes (durée réglable).
- **Plages creuses** : les plus longues périodes sans aucun build (seuil réglable) — clic = zoom.
- **Jobs** : exécutions, durées moyenne / max, temps cumulé et part de charge, taux de succès.
  Clic sur un job = filtre global.

## Interrogation de Jenkins

Le client est conçu pour ménager le serveur :

1. `GET /api/json?tree=jobs[name,url,_class,jobs[…]]` — arborescence complète (dossiers,
   multibranch) en **une** requête, avec uniquement les champs utiles.
2. `GET /computer/api/json?tree=computer[…]` — nœuds et exécuteurs.
3. `GET /job/…/api/json?tree=builds[…]{0,N}` par job, **4 requêtes en parallèle maximum**.

Chaque requête a un timeout de 30 s, 2 retries avec backoff exponentiel sur les erreurs
transitoires (réseau, 429, 502-504) et des messages d’erreur explicites (401, 403, 404, CORS…).
Un job illisible n’interrompt pas l’analyse : il est signalé. Si la limite de builds par job
tronque l’historique de la période, c’est également signalé.

## Architecture

Clean architecture : les dépendances pointent vers le domaine, qui ne connaît ni Angular ni HTTP.

```
src/app/
├── core/
│   ├── domain/                 Modèles et règles métier — TypeScript pur, testé
│   │   ├── build.ts, job.ts, agent-node.ts, time-window.ts, jenkins-settings.ts …
│   │   └── analytics/          Calculs : occupation & plages creuses, série de charge,
│   │                           semaine type & maintenance, stats par job, synthèse
│   └── ports/                  Contrats abstraits : JenkinsRepository, SettingsRepository
├── application/                Stores à base de signals (état, filtres, zoom, dérivés)
├── infrastructure/             Adaptateurs des ports
│   ├── jenkins/                Client HTTP, DTO, mapper, repository HTTP
│   ├── demo/                   Source de données fictive
│   ├── storage/                Persistance localStorage
│   └── provide-infrastructure.ts   Branchement ports → adaptateurs
└── presentation/               Composants Angular (standalone, OnPush, zoneless)
    ├── pages/                  dashboard, settings
    ├── components/             timeline SVG, heatmap, KPI, plages creuses, table des jobs
    └── shared/                 formatage FR, pipes
```

Alias d’import : `@domain/*`, `@ports/*`, `@application/*`, `@infrastructure/*`, `@presentation/*`.

## Scripts

```bash
npm start          # serveur de dev (+ proxy Jenkins)
npm run build      # build de production dans dist/
npm test           # tests unitaires (Karma)
npm run test:ci    # tests en headless (CI, conteneurs)
```
