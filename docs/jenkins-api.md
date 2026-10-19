# Interrogation de Jenkins

## Authentification

Jenkins accepte l'authentification HTTP *Basic* avec `utilisateur:token API`. Chaque requête
porte l'en-tête :

```
Authorization: Basic base64(utilisateur:token)
```

Le token est préférable au mot de passe : il est révocable et ne nécessite pas de jeton CSRF
(*crumb*). L'application ne fait que des `GET`, donc aucun crumb n'est jamais nécessaire.

## Les requêtes envoyées

Toutes les requêtes utilisent le paramètre **`tree`**, qui demande à Jenkins de ne renvoyer que
les champs listés. Sans lui, l'API renvoie des réponses très lourdes.

| # | Requête | Rôle |
| --- | --- | --- |
| 1 | `GET /api/json?tree=jobs[name,url,_class,jobs[…]]` | Toute l'arborescence des jobs en **une** requête, dossiers et multibranch compris (5 niveaux) |
| 2 | `GET /computer/api/json?tree=computer[displayName,numExecutors,offline,idle]` | Nœuds et exécuteurs (capacité) |
| 3 | `GET /job/<dossier>/job/<nom>/api/json?tree=builds[number,timestamp,duration,estimatedDuration,result,building,builtOn,url]{0,N}` | Historique d'un job, *N* = « builds max. par job » |

Les requêtes 1 et 2 partent en parallèle. Les requêtes 3 partent ensuite, **4 au maximum en
même temps** (`PARALLEL_REQUESTS` dans `http-jenkins.repository.ts`), pour ne pas surcharger
Jenkins. L'écran affiche une barre de progression job par job.

Le chemin d'un job est reconstruit à partir des noms (`job/a/job/b/`, noms encodés) plutôt qu'en
réutilisant l'URL absolue renvoyée par Jenkins : c'est ce qui permet de passer par un proxy.

## Robustesse

Gérée dans `jenkins-http.client.ts` :

- **Timeout** de 30 s par requête.
- **2 nouvelles tentatives** avec délai croissant (1 s puis 2 s) sur les erreurs passagères :
  réseau, 429, 502, 503, 504. Jamais sur 401/403/404.
- **Erreurs traduites** en `JenkinsError` avec un message en français prêt à afficher.
- Un job dont l'historique est illisible (ex. 404) **n'interrompt pas** l'analyse : il est
  listé dans un bandeau. Seules les erreurs d'authentification ou de réseau arrêtent tout.
- **Historique tronqué détecté** : Jenkins renvoie les builds du plus récent au plus ancien. Si
  on a reçu *N* builds et que le plus ancien est encore dans la période, il en manque : un
  bandeau le signale.

## Conversion des données

`jenkins.mapper.ts` transforme les réponses en objets du domaine :

- Un build en cours a `duration = 0` côté Jenkins : on le prolonge jusqu'à maintenant et son
  résultat devient `RUNNING`.
- `builtOn` vide signifie le contrôleur : il devient `built-in`. Les pipelines n'ont pas ce
  champ : `node` vaut alors `null`.
- Les résultats inconnus deviennent `UNKNOWN`.

## CORS et déploiement

Le navigateur bloque les appels vers un autre domaine si le serveur ne l'autorise pas (CORS).
Trois solutions :

### 1. Proxy de développement (local)

```bash
JENKINS_URL=https://jenkins.mon-entreprise.fr npm start
```

`proxy.conf.mjs` relaie `/jenkins-proxy/*` vers `JENKINS_URL`. Cochez *Passer par le proxy de
développement* dans les paramètres.

### 2. Reverse proxy en production (recommandé)

Construisez l'application (`npm run build`) et servez `dist/jenkins-workload/browser/` derrière
le même serveur web que le proxy vers Jenkins. Exemple nginx :

```nginx
server {
  listen 80;
  server_name jenkins-analyzer.mon-entreprise.fr;

  location /jenkins-proxy/ {
    proxy_pass https://jenkins.mon-entreprise.fr/;
  }

  location / {
    root /srv/jenkins-analyzer/browser;
    try_files $uri /index.html;
  }
}
```

Cochez la même option dans les paramètres : l'application appellera `/jenkins-proxy/...`.

### 3. Autoriser CORS dans Jenkins

Installez un plugin de filtre CORS et autorisez l'origine de l'application, les en-têtes
`Authorization` et `Accept`, et exposez l'en-tête `X-Jenkins` (pour afficher la version).

## Tester les requêtes à la main

```bash
curl -u utilisateur:token "https://jenkins/api/json?tree=jobs[name]"
curl -u utilisateur:token "https://jenkins/job/mon-job/api/json?tree=builds[number,timestamp,duration,result]{0,5}"
```

Si `curl` fonctionne et l'application non, le problème est CORS.
