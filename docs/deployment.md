# Installation pour l'équipe (NAS, partage réseau)

Objectif : construire l'application une fois, la déposer sur un partage réseau, et permettre à
chaque membre de l'équipe de la lancer d'un double-clic, sans rien installer d'autre que Node.js.

## Pourquoi un lanceur ?

Ouvrir directement `index.html` depuis un partage (`file://…`) **ne fonctionne pas** : les
navigateurs refusent d'exécuter une application moderne (modules JavaScript) chargée ainsi, et
bloqueraient de toute façon les appels à Jenkins (CORS).

La version installable contient donc un **lanceur** (`serve.mjs`) : un petit script Node.js, sans
aucune dépendance, qui :

- sert l'application sur `http://localhost:4300` (sur le poste de chacun) ;
- relaie `/jenkins-proxy/*` vers Jenkins, ce qui supprime les problèmes de CORS ;
- n'écoute que sur le poste local (`127.0.0.1`) : rien n'est exposé sur le réseau.

Ce n'est pas un backend : il ne stocke rien, ne calcule rien et ne voit passer que les requêtes
de l'utilisateur, avec ses propres identifiants.

## 1. Construire la version installable

Sur un poste de développement :

```bash
npm install
npm run package
```

Résultat dans `dist/jenkins-analyzer/` :

```
jenkins-analyzer/
├── app/                          l'application construite
│   └── app-config.json           réglages par défaut de l'équipe (optionnel)
├── serve.mjs                     le lanceur
├── Lancer Jenkins Analyzer.bat   double-clic sous Windows
├── lancer.sh                     macOS / Linux
├── .env.example                  modèle de configuration du relais
└── LISEZMOI.txt                  mode d'emploi pour l'équipe
```

## 2. Configurer pour l'équipe

Dans le dossier `dist/jenkins-analyzer/` :

1. **`.env`** — copiez `.env.example` en `.env` et indiquez l'adresse de Jenkins :
   ```ini
   JENKINS_URL=https://jenkins.mon-entreprise.fr
   # JENKINS_INSECURE=true   # certificat d'autorité interne ou auto-signé
   # PORT=4300               # autre port si 4300 est pris
   ```
2. **`app/app-config.json`** (optionnel) — réglages proposés par défaut à tous :
   ```json
   {
     "dataSource": "jenkins",
     "baseUrl": "https://jenkins.mon-entreprise.fr",
     "useDevProxy": true,
     "planningHistoryDays": 28,
     "idleThresholdMinutes": 30,
     "maintenanceDurationHours": 2
   }
   ```
   Avec `useDevProxy: true`, l'application passe par le relais du lanceur. L'utilisateur et le
   token API n'y sont **jamais** lus, même s'ils y figurent : ils sont personnels.

Chaque utilisateur peut ensuite modifier ses propres réglages ; ses choix priment sur ceux de
l'équipe.

## 3. Déposer sur le NAS

Copiez tout le dossier `jenkins-analyzer/` sur le partage, par exemple
`\\nas\outils\jenkins-analyzer\`.

## 4. Utilisation par l'équipe

1. Prérequis : **Node.js 20.19 ou plus récent** sur le poste.
2. Double-cliquez sur `Lancer Jenkins Analyzer.bat` (depuis le partage, ou une copie locale).
   Une fenêtre s'ouvre et le navigateur affiche l'application.
3. Première fois : dans **Paramètres**, saisissez votre utilisateur et votre token API Jenkins.
   Ils restent dans votre navigateur, sur votre poste.
4. Laissez la fenêtre du lanceur ouverte pendant l'utilisation ; fermez-la pour arrêter.

Relancer alors que l'application tourne déjà ouvre simplement le navigateur.

## Mettre à jour

1. `git pull`, puis `npm run package` sur le poste de développement.
2. Sur le NAS, remplacez le dossier `app/` et `serve.mjs` par les nouveaux. **Gardez** votre
   `.env` et votre `app/app-config.json` (sauvegardez-les avant de remplacer `app/`).
3. Les utilisateurs rechargent la page (les fichiers sont mis en cache mais leurs noms changent à
   chaque version, donc aucune purge n'est nécessaire).

## Plus tard : héberger sur un serveur

Le dossier `app/` est un site statique : n'importe quel serveur web peut le servir (IIS, nginx,
Apache). Il faut seulement :

- relayer `/jenkins-proxy/` vers Jenkins (ou activer CORS dans Jenkins) — exemple nginx dans
  [Interrogation de Jenkins](./jenkins-api.md#cors-et-déploiement) ;
- renvoyer `index.html` pour les adresses inconnues (routes de l'application comme `/forecast`) ;
- si l'application est servie dans un sous-dossier (ex. `/outils/jenkins/`), la construire avec
  `npx ng build --base-href /outils/jenkins/`.

Une fois hébergée, plus besoin de Node.js sur les postes, ni du lanceur.

## Sécurité

- Le token API est stocké dans le navigateur de l'utilisateur (`localStorage`). Utilisez des
  comptes en **lecture seule** (Overall/Read, Job/Read, et Job/ExtendedRead pour les prévisions).
- Le relais n'écoute qu'en local et n'ajoute aucun identifiant : chaque requête porte ceux de
  l'utilisateur.
- Ne mettez jamais de token dans `.env` ni dans `app-config.json`.
