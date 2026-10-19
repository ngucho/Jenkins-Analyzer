# Prise en main

Ce guide s'adresse à quelqu'un qui découvre le projet. En 15 minutes, vous aurez l'application
qui tourne, vous saurez où se trouve quoi, et vous aurez fait votre première modification.

## 1. Prérequis

| Outil | Version | Vérifier |
| --- | --- | --- |
| Node.js | 20.19+ ou 22.12+ (exigé par Angular 20) | `node -v` |
| npm | fourni avec Node | `npm -v` |
| Git | n'importe quelle version récente | `git --version` |
| Chrome ou Chromium | pour les tests unitaires | — |

Un éditeur avec le support TypeScript/Angular est conseillé : VS Code avec l'extension
*Angular Language Service* (recommandée automatiquement par le dossier `.vscode/`).

Aucun backend, aucune base de données : l'application parle directement à Jenkins depuis le navigateur.

## 2. Installer et lancer

```bash
git clone https://github.com/ngucho/jenkins-analyzer.git
cd jenkins-analyzer
npm install
npm start
```

Ouvrez <http://localhost:4200>. Au premier lancement, l'application est en **mode démo** :
elle génère des données fictives mais réalistes (jobs déclenchés par les commits en journée,
jobs nocturnes, week-ends calmes). Vous pouvez tout explorer sans Jenkins.

> Le serveur de dev recharge la page à chaque sauvegarde de fichier.

## 3. Brancher un vrai Jenkins

1. Dans Jenkins, créez un token API : **votre profil › Security › API Token › Add new token**.
   Un compte avec le seul droit de lecture (*Overall/Read*, *Job/Read*) suffit.
2. Dans l'application, allez dans **Paramètres**, choisissez **Jenkins** et renseignez l'URL,
   l'utilisateur et le token.
3. Cliquez sur **Tester la connexion**. En cas de succès, vous voyez la version de Jenkins,
   le nombre de jobs et d'exécuteurs.
4. Cliquez sur **Enregistrer et analyser**.

### Si le test échoue avec « Jenkins est injoignable »

C'est presque toujours **CORS** : le navigateur refuse d'appeler un autre domaine que celui de
l'application si Jenkins ne l'autorise pas explicitement. Solution en développement :

Le proxy lit l'adresse de Jenkins dans un fichier `.env` (identique sur Windows, macOS et Linux) :

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

Cochez ensuite **Passer par le proxy de développement** dans les paramètres. Les appels passent
alors par le serveur de dev Angular (même origine), qui les relaie vers Jenkins.
Certificat auto-signé ? Ajoutez `JENKINS_INSECURE=true`.


Pour la production, voir [Déploiement](./jenkins-api.md#cors-et-déploiement).

## 4. Les commandes utiles

| Commande | Rôle |
| --- | --- |
| `npm start` | Serveur de dev sur le port 4200, avec le proxy Jenkins |
| `npm run build` | Build de production dans `dist/jenkins-workload/browser/` |
| `npm run package` | Version installable pour l'équipe (NAS) dans `dist/jenkins-analyzer/` — voir [Installation](./deployment.md) |
| `npm test` | Tests unitaires en mode watch (ouvre Chrome) |
| `npm run test:ci` | Tests une seule fois, Chrome headless (CI, conteneurs, WSL) |

Si `npm run test:ci` ne trouve pas Chrome, indiquez son chemin :
`CHROME_BIN=/chemin/vers/chrome npm run test:ci`.

## 5. Visite guidée du code

```
src/app/
├── core/domain/        ← le cœur : modèles + calculs. Commencez votre lecture ici.
│   ├── analytics/      ← tableau de bord : occupation, plages creuses, semaine type
│   └── planning/       ← prévisions, cron Jenkins, optimisation, nouveau job
├── core/ports/         ← les interfaces que le domaine attend du monde extérieur
├── application/        ← l'état de l'écran (stores à base de signals)
├── infrastructure/     ← le code qui parle à Jenkins, au localStorage, la démo
└── presentation/       ← les pages et composants Angular
```

Ordre de lecture conseillé pour comprendre le projet :

1. `core/domain/build.ts` et `time-window.ts` — les deux notions de base : un build est un
   intervalle de temps `[start, end[` avec un job et un résultat.
2. `core/domain/analytics/occupancy.ts` — comment on trouve les plages creuses (≈ 50 lignes).
3. `core/ports/jenkins.repository.ts` — ce que l'application attend d'une source de données.
4. `infrastructure/jenkins/http-jenkins.repository.ts` — comment on interroge Jenkins.
5. `application/workload.store.ts` — comment tout est assemblé pour l'écran.
6. `presentation/pages/dashboard/` — comment c'est affiché.
7. Pour les prévisions : `core/domain/planning/weekly-profile.ts` puis `forecast.ts`, et
   `application/planning.store.ts` qui charge les données communes aux trois pages de planification.

L'[architecture](./architecture.md) explique pourquoi le code est découpé ainsi.

## 6. Votre première modification (exercice)

Objectif : ajouter la période « 90 jours » au sélecteur du tableau de bord.

1. Ouvrez `src/app/application/period.ts`.
2. Ajoutez `'90d'` au type `PeriodId`, puis une entrée dans `PERIODS` :
   ```ts
   { id: '90d', label: '90 jours', days: 90 },
   ```
3. Sauvegardez : le bouton apparaît, tout le reste (chargement, heatmap, KPI) suit
   automatiquement, car le reste du code ne dépend que de la fenêtre de temps.

C'est l'idée générale du projet : chaque changement se fait à **un seul endroit**.
Pour aller plus loin, voir le [guide de développement](./development.md).

## 7. Dépannage rapide

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| « Identifiants refusés » | Utilisateur ou token incorrect | Régénérez un token ; l'utilisateur est l'identifiant, pas l'e-mail |
| « Accès refusé » | Droits insuffisants | Donnez *Overall/Read* et *Job/Read* au compte |
| « Ressource introuvable » | URL incorrecte | Utilisez l'URL racine de Jenkins, sans `/job/...` |
| « La réponse n'est pas du JSON » | L'URL pointe vers une page de login SSO ou un autre site | Vérifiez l'URL ; avec un SSO, passez par le proxy |
| « Planification illisible » sur les pages de prévision | Le compte n'a pas le droit *Job/ExtendedRead* | Ajoutez ce droit pour lire les `config.xml` ; sans lui, les prévisions restent statistiques |
| Bandeau « Historique incomplet » | Plus de builds que la limite par job sur la période | Augmentez *Builds max. par job* dans les paramètres |
| `http proxy error … ECONNREFUSED` dans le terminal | Proxy coché mais `JENKINS_URL` non défini : le proxy vise `localhost:8080` | Créez le fichier `.env` (copie de `.env.example`) avec `JENKINS_URL=...`, puis relancez `npm start` (le démarrage affiche `[jenkins-proxy] … -> <cible>` : vérifiez-la). Un changement de `.env` n'est pris en compte qu'après redémarrage |
| Chargement très long | Beaucoup de jobs | Réduisez la période ou la limite de builds par job |
