# Fonctionnalités : ce qui a été fait et pourquoi

## Le besoin

La machine Jenkins exécute des dizaines de jobs. Deux questions reviennent :

1. **Comment mieux répartir la charge ?** Quels jobs pèsent le plus, quand y a-t-il des pics,
   la capacité (nombre d'exécuteurs) est-elle saturée ?
2. **Quand lancer une maintenance** (mise à jour, redémarrage, sauvegarde) sans casser de build ?

Jenkins n'offre pas de vue d'ensemble dans le temps. L'application reconstruit cette vue à partir
de l'historique des builds, exposé par l'API REST de Jenkins.

## Les écrans

### Paramètres

- **Source de données** : *Jenkins* (réel) ou *Démo* (fictif, pour découvrir l'outil).
- **Connexion** : URL, utilisateur, token API, option proxy de dev. Bouton de test.
- **Analyse** :
  - *Plage creuse à partir de* (30 min par défaut) : un trou d'activité plus court n'est pas
    considéré comme exploitable.
  - *Durée de maintenance* (2 h) : taille du créneau recherché.
  - *Builds max. par job* (300) : borne la taille des requêtes.

Les paramètres sont enregistrés dans le `localStorage` du navigateur.

### Tableau de bord

En haut : choix de la **période** (24 h, 7, 14, 30 jours), **filtre** sur le nom des jobs,
bouton **Actualiser**. Le filtre et le zoom s'appliquent à toutes les vues.

| Vue | Ce qu'elle montre | Question à laquelle elle répond |
| --- | --- | --- |
| **Indicateurs** | Builds, taux d'occupation, temps libre, temps machine, pic de concurrence, plus longue plage creuse | « La machine est-elle chargée ? » |
| **Chronologie** | Courbe de charge, capacité, plages creuses en vert, chaque build sur une ligne | « Que s'est-il passé, et quand ? » |
| **Semaine type** | Carte de chaleur jour × heure de la charge moyenne | « Quelles sont les habitudes ? » |
| **Créneaux de maintenance** | Les 3 créneaux hebdomadaires les plus calmes | « Quand intervenir ? » |
| **Plages creuses** | Les plus longs trous d'activité observés | « Où puis-je placer un job lourd ? » |
| **Jobs** | Exécutions, durées, temps cumulé, part de charge, taux de succès | « Qui consomme la machine ? » |

Interactions :
- **Glisser** sur la chronologie zoome sur la zone ; les indicateurs, plages creuses et jobs
  se recalculent pour cette zone.
- **Cliquer sur un build** l'ouvre dans Jenkins.
- **Cliquer sur une plage creuse** zoome dessus.
- **Cliquer sur un job** filtre tout le tableau de bord sur ce job.

## Définitions des indicateurs

Toutes les durées sont bornées à la fenêtre affichée : un build commencé avant la période ne
compte que pour sa partie visible.

| Indicateur | Définition |
| --- | --- |
| **Taux d'occupation** | Temps pendant lequel *au moins un* build tourne ÷ durée de la fenêtre. Les builds simultanés ne comptent qu'une fois. |
| **Temps libre** | Durée de la fenêtre − temps occupé. |
| **Temps machine** | Somme des durées de tous les builds. Peut dépasser la durée de la fenêtre quand des builds tournent en parallèle. |
| **Charge** (courbe) | Nombre moyen de builds simultanés sur chaque intervalle de la courbe. Le trait fin montre le pic sur l'intervalle. |
| **Pic de concurrence** | Nombre maximal de builds simultanés. Affiché en orange s'il atteint le nombre d'exécuteurs en ligne (saturation). |
| **Plage creuse** | Période sans aucun build, d'une durée au moins égale au seuil réglé. |
| **Taux d'échec / de succès** | Calculé sur les builds terminés uniquement (les builds en cours sont exclus). *Instable* compte comme un échec. |

## Comment sont trouvés les créneaux de maintenance

1. On découpe la période chargée en heures pleines et on calcule la charge moyenne de chacune.
2. On les regroupe par (jour de la semaine, heure) : 7 × 24 = 168 cases, chacune étant la
   moyenne de toutes les semaines observées. C'est la **semaine type**.
3. On fait glisser une fenêtre de *N* heures (la durée de maintenance) sur ces 168 cases, en
   bouclant de dimanche soir à lundi matin, et on garde celles dont la charge moyenne est la
   plus faible, sans chevauchement entre elles.
4. Les cases sans données (période trop courte) ne sont jamais proposées.

**Pourquoi une moyenne hebdomadaire plutôt que les trous observés ?** Une maintenance se planifie
de façon récurrente (« chaque mardi à 4 h »). Un trou observé une seule fois peut être un hasard ;
une case à zéro sur 4 semaines est une habitude fiable. Plus la période est longue, plus la
suggestion est fiable : utilisez 14 ou 30 jours pour décider.

## Ce que l'application ne fait pas (encore)

- Elle ne voit que ce que Jenkins garde en historique (les builds supprimés par la politique de
  rétention sont perdus).
- Les pipelines n'indiquent pas toujours sur quel agent ils ont tourné : l'analyse porte sur
  l'ensemble de l'instance, pas agent par agent.
- Pas de temps d'attente en file (*queue*), pas d'alerting, pas d'historique stocké côté
  application. Voir les pistes dans le [guide de développement](./development.md#pistes-dévolution).
