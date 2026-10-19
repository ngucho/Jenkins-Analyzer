# Guide de développement

Ce guide explique comment faire évoluer le projet sans casser son architecture.
Lisez d'abord l'[architecture](./architecture.md).

## Conventions

- **Langue** : code (noms de variables, fonctions) en anglais ; commentaires, textes affichés et
  documentation en français.
- **Composants** : standalone, `ChangeDetectionStrategy.OnPush`, `input()` / `output()` /
  `signal()` / `computed()`. Pas de `NgModule`, pas de décorateurs `@Input`.
- **Templates** : nouvelle syntaxe de contrôle (`@if`, `@for`, `@switch`).
- **Domaine** : fonctions pures, données immuables (`readonly`), aucun import d'Angular ou RxJS.
- **Formatage des dates et durées** : uniquement via `presentation/shared/format.ts`.
- **Couleurs et espacements** : uniquement via les variables CSS de `src/styles.scss`
  (`--accent`, `--idle`, `--border`…). Le thème sombre suit automatiquement le système.
- **Commentaires** : expliquer le *pourquoi*, pas le *quoi*.
- **Formatage du code** : Prettier (config dans `package.json`, 100 colonnes, guillemets simples).

## Où mettre un nouveau code ?

| Je veux… | Je modifie… |
| --- | --- |
| Un nouveau calcul (indicateur, statistique) | `core/domain/analytics/` + son test `.spec.ts` |
| Un nouveau champ lu depuis Jenkins | DTO + `tree` + mapper dans `infrastructure/jenkins/`, modèle dans `core/domain/` |
| Une nouvelle source de données | Un adaptateur dans `infrastructure/` qui étend `JenkinsRepository` |
| Un nouvel état d'écran (filtre, option) | `application/workload.store.ts` |
| Un nouveau paramètre utilisateur | `core/domain/jenkins-settings.ts` + formulaire `presentation/pages/settings/` |
| Un nouvel élément visuel | `presentation/components/` |

## Recettes

### Ajouter un indicateur (ex. « durée moyenne d'un build »)

1. **Domaine** — dans `workload-analysis.ts`, ajoutez le champ à `WorkloadSummary` et
   calculez-le dans `analyzeWorkload` :
   ```ts
   averageBuildDuration: builds.length > 0 ? cumulatedBuildTime / builds.length : 0,
   ```
2. **Test** — ajoutez un cas dans un `*.spec.ts` du dossier `analytics`.
3. **Présentation** — ajoutez une entrée dans la liste `kpis` de `kpi-strip.ts`.

Le store n'a pas à changer : `analysis` est déjà un signal calculé.

### Lire un nouveau champ de Jenkins (ex. la cause du déclenchement)

1. Ajoutez le champ au `BuildDto` dans `jenkins-api.types.ts`.
2. Ajoutez-le à `BUILD_FIELDS` dans `http-jenkins.repository.ts` (pour qu'il soit dans `tree`).
3. Ajoutez-le au modèle `Build` du domaine et remplissez-le dans `toBuild` (`jenkins.mapper.ts`).
4. Mettez à jour le générateur de la démo (`demo-jenkins.repository.ts`) : le compilateur vous
   le signalera puisque `Build` a changé.

### Ajouter une source de données (ex. GitLab CI, fichier CSV)

1. Créez `infrastructure/gitlab/gitlab.repository.ts` qui `extends JenkinsRepository` et
   implémente `checkConnection` et `fetchWorkload`.
2. Ajoutez la valeur au type `DataSource` (`jenkins-settings.ts`).
3. Ajoutez le cas dans `RoutingJenkinsRepository.sourceFor`.
4. Ajoutez le choix dans la page de paramètres.

Ni le domaine, ni les stores, ni les composants du tableau de bord ne changent.
*(Si les sources se multiplient, renommer le port en `CiRepository` serait plus juste.)*

### Ajouter un paramètre utilisateur

1. Ajoutez le champ à `JenkinsSettings` et à `DEFAULT_SETTINGS`. Les anciens paramètres
   enregistrés sont complétés automatiquement par les valeurs par défaut
   (`local-storage-settings.repository.ts`).
2. Ajoutez le contrôle au formulaire (`settings.page.ts`) et le champ dans le template.
3. Lisez-le dans le store via `this.settingsStore.settings()`.

## Tests

```bash
npm test          # watch, ouvre Chrome
npm run test:ci   # une fois, headless
```

Les tests couvrent ce qui contient de la logique :
- `core/domain/analytics/*.spec.ts` — les calculs (plages creuses, charge, heatmap,
  maintenance, statistiques) ;
- `infrastructure/jenkins/jenkins.mapper.spec.ts` — la conversion des réponses Jenkins ;
- `presentation/shared/format.spec.ts` — le formatage des durées.

Bonne pratique : construisez les dates de test avec des heures simples
(`const at = (h: number) => h * HOUR`) pour que les attentes restent lisibles.
Un bug de calcul du pic de concurrence a été trouvé grâce à ces tests : quand vous touchez à un
algorithme, ajoutez d'abord le cas qui vous inquiète.

### Tester contre un faux Jenkins

Pour vérifier le chemin HTTP sans vrai Jenkins, un petit serveur Node suffit : il répond à
`/api/json`, `/computer/api/json` et `/job/<nom>/api/json` avec du JSON de la forme décrite dans
`jenkins-api.types.ts`, et renvoie 401 si l'en-tête `Authorization` est faux. Lancez-le sur le
port 8080, puis `JENKINS_URL=http://localhost:8080` dans `.env` (c'est aussi la valeur par défaut du proxy) et le proxy coché dans les paramètres.

## Avant de pousser

- [ ] `npm run build` passe sans erreur
- [ ] `npm run test:ci` est vert
- [ ] Le mode démo s'affiche correctement, en thème clair et sombre
- [ ] Aucun import d'Angular ou de RxJS dans `core/domain`
- [ ] La documentation est à jour si le comportement change

## Pistes d'évolution

Classées de la plus simple à la plus ambitieuse :

1. **Actualisation automatique** toutes les N minutes (un `interval` dans le store).
2. **Export** CSV des builds et des plages creuses.
3. **Vue par agent** : filtrer la charge par nœud (`build.node`), utile si plusieurs agents.
4. **Temps d'attente en file** : l'API `/queue/api/json` permet de mesurer quand les jobs
   attendent un exécuteur libre — le meilleur signal de saturation.
5. **Comparaison de périodes** (cette semaine vs la précédente).
6. **Planification assistée** : proposer pour un job lourd le créneau le plus libre de la
   semaine type.
7. **Historique long** : Jenkins purge ses builds ; un petit backend qui archive les snapshots
   permettrait d'analyser plusieurs mois.
