# Kakeibo, budget à la japonaise : règles des agents

Ce fichier dit comment travailler. `docs/spec.md` dit quoi construire. Lis les deux au début de chaque session.

## La référence

- `docs/spec.md` est la copie du [document de spécifications](https://claude.ai/artifact/71tMXdJNxRnPD14BioaLJb). Si les deux diffèrent, le document en ligne fait foi.
- Avant d'écrire du code, lis « Principes du produit » puis les sections que cite ton ticket.
- Le code ne change jamais une règle. Pour changer une règle, on met d'abord à jour la spec et ses scénarios, avec l'accord du propriétaire du projet.
- Ne modifie jamais `docs/spec.md` toi-même : c'est une copie que le propriétaire fait ré-exporter quand il change le document en ligne. Si une règle doit changer, écris dans le ticket le texte actuel et le texte proposé, et mets l'étiquette `besoin de toi`.

## Comment on avance

- Les tickets sont des issues GitHub. `docs/backlog.md` donne le découpage des jalons ; l'agent Produit en tire les issues.
- Un ticket = un objectif vérifiable, faisable en moins d'une journée, qui cite les sections de la spec concernées.
- Étiquettes : `prêt` (à prendre), `en cours`, `à relire`, `prêt à fusionner`, `besoin de toi` (attend une décision humaine), `bloqué`.
- Une branche par ticket, préfixée `claude/`, et une demande de fusion par ticket, remplie avec le gabarit.
- `main` ne reçoit que des demandes de fusion dont l'intégration continue est verte. Personne ne pousse directement sur `main`. Exception, décidée par le propriétaire : tant que le ticket J0.2 n'est pas fusionné, une demande de fusion relue dont les tests passent en session peut être fusionnée sans intégration continue.
- Les jalons se suivent dans l'ordre de la spec (J0 à J9). Deux tickets indépendants peuvent avancer en parallèle.

## Règles techniques

- Expo et React Native, TypeScript strict, sans `any`. Les choix techniques de la spec s'appliquent ; un autre choix demande l'accord du propriétaire.
- Montants en centimes (entiers), jours `AAAA-MM-JJ`, semaines ISO 8601 (`AAAA-Www`).
- `src/domain` est pur : ni horloge, ni hasard, ni base, ni React, ni Expo. L'heure courante lui est passée en paramètre.
- Le domaine se développe tests d'abord. Les 25 scénarios de la spec sont des tests ; on ne modifie jamais un résultat attendu pour faire passer un test.
- Tous les textes visibles passent par `src/i18n/fr.ts`, au tutoiement, selon « Textes et ton ».
- Aucune dépendance payante, aucun service en ligne, aucun SDK qui collecte des données.

## Terminé, c'est

- Vérification des types, lint et tests au vert.
- Les 25 scénarios passent.
- Captures des écrans modifiés jointes : émulateur Android dans l'intégration continue, iPhone pendant la bêta.
- Textes dans `src/i18n/fr.ts`, libellés d'accessibilité présents.
- Toute nouvelle mécanique a son explication de première fois et sa fiche dans Comprendre.
- Entrée ajoutée à `CHANGELOG.md`.
- Chaque critère d’un ticket est prouvé par un test automatique ou vérifié par l’agent lui-même, capture regardée et décrite dans la demande de fusion. Un critère invérifiable bloque la fusion : on ne fusionne pas avec une réserve. (Règle décidée par le propriétaire. Il ne valide que les visuels, les versions et les dépenses.)

## S'arrêter et demander

Mets l'étiquette `besoin de toi` et écris dans le ticket une question fermée, les options et la valeur que tu proposes, quand :

- la spec est ambiguë ou contradictoire sur une règle, une donnée ou un texte visible ;
- une action coûte de l'argent ou crée un compte ;
- un store refuse l'appli ;
- une exigence paraît techniquement impossible ;
- un choix touche à la vie privée.

Puis passe au ticket suivant : ne reste pas bloqué.

## Jamais sans feu vert du propriétaire

Créer un compte, payer, publier sur un store, envoyer une version aux testeurs, modifier un texte légal, changer une décision marquée « Validé », livrer un lot de visuels définitifs.
