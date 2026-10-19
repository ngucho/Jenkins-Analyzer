# Prévisions et planification

Trois pages aident à **anticiper** et à **mieux répartir** la charge, toujours sans backend :
tout est calculé dans le navigateur à partir de l'API Jenkins.

| Page | Question | Résultat |
| --- | --- | --- |
| **Prévisions** | « Que va-t-il se passer ces prochains jours ? » | Courbe de charge attendue avec fourchette, fenêtres calmes, risques de saturation |
| **Optimisation** | « Mes jobs planifiés sont-ils bien répartis ? » | Décalages proposés et nouveaux crons à copier |
| **Nouveau job** | « Quand lancer ce nouveau job ? » | Les 5 meilleurs créneaux, avec le cron à copier |

## Les données utilisées

Les trois pages partagent les mêmes données, chargées une fois à l'ouverture de la première
d'entre elles (bouton *Actualiser* pour recharger) :

1. **Un historique long** : par défaut 28 jours (réglable dans les paramètres, de 7 à 90 jours),
   indépendant de la période choisie sur le tableau de bord.
2. **La cause de chaque build** : planification (cron), commit, utilisateur, autre job…
3. **La planification de chaque job** : le champ *Build periodically* (ou `triggers { cron(...) }`
   d'un pipeline), lu dans le `config.xml` du job.

> La lecture des `config.xml` demande le droit **Job/ExtendedRead** (ou Configure). Sans ce droit,
> les jobs concernés sont signalés et leur charge est prévue uniquement d'après leur historique :
> les pages restent utilisables, mais l'optimisation ne peut pas les déplacer.

### Le symbole `H` de Jenkins

Jenkins remplace `H` (ex. `H 2 * * *`) par une valeur stable calculée à partir du nom du job, pour
étaler les démarrages. Ce calcul interne n'est pas reproductible côté navigateur. L'application
retrouve donc la valeur réelle dans **la dernière exécution planifiée observée** (ex. 02:17). Si
le job n'a jamais tourné, une valeur arbitraire mais stable est utilisée et signalée par « ≈ ».

### La durée d'un job planifié

C'est la **médiane** des durées de ses exécutions terminées (de préférence les exécutions
planifiées, s'il y en a au moins 3). Sans historique : 10 minutes, signalé « (supposée) ».

## Prévisions

### Méthode

La prévision additionne deux composantes, par quart d'heure :

1. **La charge habituelle** : tous les builds **non planifiés** de l'historique (commits,
   lancements manuels, jobs déclenchés par d'autres) donnent, pour chacun des 672 quarts d'heure
   de la semaine (7 × 24 × 4), la moyenne du nombre de builds simultanés. Les semaines récentes
   comptent davantage (le poids est divisé par deux toutes les 2 semaines). Une moyenne glissante
   sur 45 minutes atténue le bruit.
2. **Les jobs planifiés** : leurs prochaines exécutions sont calculées d'après leur cron et placées
   avec leur durée typique.

Les exécutions planifiées passées sont retirées de la charge habituelle, pour ne pas les compter
deux fois.

La **fourchette probable** est la charge habituelle ± 1,28 écart-type (≈ 80 % des cas si les
variations d'une semaine à l'autre suivent une loi normale).

### Ce qu'affiche la page

- **Fenêtres calmes prévues** : périodes d'au moins *Durée de maintenance* (paramètre) sans job
  planifié et où même la borne haute reste sous 0,5 build. C'est le bon moment pour une
  maintenance.
- **Risques de saturation** : périodes où la borne haute atteint le nombre d'exécuteurs en ligne :
  des builds risquent d'attendre en file.
- **Fiabilité** : la méthode est rejouée sur la semaine passée (apprise sur les semaines
  précédentes) et comparée à la réalité. « ± 0,3 » signifie qu'elle s'est trompée en moyenne de
  0,3 build simultané. Il faut au moins 2 semaines d'historique.

### Pourquoi une méthode statistique simple ?

- Elle est **explicable** : chacun comprend « la charge habituelle du mardi à 10 h, plus les jobs
  planifiés ».
- La charge d'une machine CI est très **saisonnière** (journée de travail, nuits, week-ends) :
  un profil hebdomadaire en capture l'essentiel.
- Elle tourne **en quelques millisecondes** dans le navigateur, sans serveur ni bibliothèque.
- La mesure de fiabilité dit honnêtement quand elle est utile.

## Optimisation des planifications

### Principe

L'outil construit la **semaine type** (charge habituelle + exécutions de tous les jobs planifiés),
puis cherche à décaler les jobs planifiés pour la rendre plus régulière.

Le coût d'un quart d'heure vaut *charge²*, plus une forte pénalité au-delà de la capacité. Comme
le total de travail ne change pas quand on décale un job, minimiser la somme des carrés revient à
**étaler** la charge : deux jobs qui se chevauchent coûtent plus cher que les mêmes jobs à la suite.

Algorithme (recherche locale) : les jobs, du plus lourd au plus léger, sont retirés un à un puis
replacés au meilleur décalage autorisé (pas de 15 minutes, jusqu'au décalage maximal choisi). On
recommence jusqu'à ce que plus rien ne bouge (4 passes au plus). Un petit coût par heure de
décalage évite de déplacer un job pour un gain négligeable.

### Quels jobs peuvent être déplacés ?

Ceux dont la planification s'écrit « une minute fixe, une ou plusieurs heures, certains jours de
la semaine » (ex. `H 2 * * *`, `30 8,14 * * 1-5`). C'est le cas de l'immense majorité des jobs
nocturnes et des tâches périodiques. Ne sont pas déplacés :

- les planifications sur plusieurs lignes, mensuelles ou annuelles ;
- les jobs lancés plusieurs fois par heure ou plus de 6 fois par jour (les décaler n'a pas de sens) ;
- les jobs que vous **verrouillez** (case « Ne pas déplacer ») : fenêtre imposée, dépendance
  entre jobs, contrainte métier…

Un job qui ne tourne que certains jours n'est jamais décalé au-delà de minuit (le cron proposé
deviendrait trompeur). Les jobs non déplaçables restent pris en compte dans la charge.

### Appliquer une proposition

Rien n'est modifié dans Jenkins (l'application est en lecture seule). Pour chaque job retenu :

1. copiez la nouvelle planification avec le bouton **Copier** ;
2. collez-la dans *Configurer › Build Triggers › Build periodically*, ou dans
   `triggers { cron('…') }` du Jenkinsfile ;
3. le cron proposé fixe la minute (ex. `31 14,20 * * 1-5`). Pour garder l'étalement automatique
   de Jenkins, vous pouvez la remplacer par une plage proche : `H(25-35) 14,20 * * 1-5`.

Vérifiez toujours qu'aucune contrainte ne s'y oppose (un job qui doit finir avant 8 h, deux jobs
qui doivent s'enchaîner…) : l'outil ne connaît pas ces règles.

## Planifier un nouveau job

Renseignez la **durée estimée**, la **fréquence** (chaque jour, jours ouvrés, une fois par
semaine, toutes les N heures, une seule fois) et la **plage de démarrage autorisée** (elle peut
passer minuit : 22:00 → 06:00).

- **Job récurrent** : chaque départ possible (par pas de 15 minutes) est évalué sur la semaine
  type, en comptant le surcoût de charge pendant l'exécution et, plus légèrement, la charge dans
  l'heure qui précède et celle qui suit (marge en cas de dépassement). Les 5 meilleurs créneaux,
  espacés d'au moins une heure, sont proposés avec le cron correspondant.
- **Exécution ponctuelle** : même principe sur la prévision des 7 prochains jours, avec une date
  et une heure précises à lancer à la main.

Pour chaque créneau : la charge déjà présente pendant l'exécution, et le pic atteint avec le
nouveau job (en rouge s'il dépasse la capacité).

## Limites à connaître

- Les calculs reposent sur l'heure **du navigateur**. Si Jenkins tourne dans un autre fuseau
  horaire (ou avec une ligne `TZ=` dans le cron), les heures sont décalées d'autant.
- La charge est une **moyenne par quart d'heure** : un pic très bref peut ne pas apparaître.
- Les jobs déclenchés par d'autres jobs (*upstream*) sont prévus statistiquement, pas comme
  conséquence de la planification de leur parent.
- Le changement d'heure (été/hiver) peut décaler d'une heure les créneaux de la semaine concernée.
- La capacité est le nombre d'exécuteurs **en ligne au moment du chargement**, tous nœuds confondus.
