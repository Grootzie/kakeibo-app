# Mettre les agents en route

Deux façons de faire travailler les agents seuls. Les deux tournent dans le cloud, même ordinateur éteint, et consomment le quota de l'abonnement Claude.

Réglages communs :

- **Dépôt :** `Grootzie/kakeibo-app`, avec l'appli GitHub de Claude installée dessus.
- **Environnement cloud :** **Default**, dont le réseau « Trusted » donne accès à npm et à GitHub.
- **Connecteurs :** garde Claude Docs, qui sert à relire le document en ligne, et retire les autres.

## A. Avec un projet Claude Code

Si **Projects** apparaît sur claude.ai/code (bêta en cours de déploiement) :

1. Crée un projet avec le dépôt `Grootzie/kakeibo-app` et l'environnement Default.
2. Colle ces instructions de projet :

   > Tu coordonnes la construction de l'appli « Kakeibo, budget à la japonaise ». Le dépôt contient la spec (`docs/spec.md`), les règles de travail (`CLAUDE.md`) et le découpage des jalons (`docs/backlog.md`) : suis-les à la lettre. Avance jalon par jalon, de J0 à J9. Pour chaque jalon, crée les issues des tickets, puis lance un fil par ticket, en parallèle quand les tickets sont indépendants. Chaque fil travaille sur sa branche `claude/` et ouvre une demande de fusion. Relis chaque demande par rapport à la spec et fusionne-la quand l'intégration continue est verte. Ne me sollicite que pour les tickets `besoin de toi` et aux trois points de contrôle de la spec : lots de visuels, feu vert des versions, dépenses et textes légaux.

3. Envoie ce premier message :

   > Démarre J0 puis J1. Programme ensuite une tâche toutes les trois heures qui fait avancer le jalon en cours, et un point chaque matin à 8 h qui met à jour la page « Suivi kakeibo ».

## B. Avec trois tâches planifiées

Sur claude.ai/code/routines, pour chaque tâche : **New task**, le nom et la consigne ci-dessous, le dépôt et l'environnement Default, puis le déclencheur indiqué. Une fois les trois créées, lance la tâche Produit avec **Run now** : c'est elle qui crée les premières issues.

### 1. Produit, chaque matin

Déclencheur : **Schedule**, tous les jours à 8 h 07.

> Tu es l'agent Produit de l'appli « Kakeibo, budget à la japonaise », dépôt Grootzie/kakeibo-app. Lis CLAUDE.md, docs/spec.md et docs/backlog.md, puis fais dans l'ordre : 1. Si le document en ligne (https://claude.ai/artifact/71tMXdJNxRnPD14BioaLJb, par le connecteur Claude Docs) a changé depuis la copie docs/spec.md, ré-exporte-le en Markdown dans docs/spec.md par une demande de fusion « docs : spec à jour ». 2. Si le jalon en cours n'a pas encore ses issues, crée-les à partir de docs/backlog.md, une par ticket, avec l'étiquette `prêt`. 3. Si le jalon en cours remplit son critère « Validé quand », découpe le jalon suivant en tickets, dans docs/backlog.md et en issues. 4. Publie ou mets à jour la page « Suivi kakeibo » : le jalon en cours, ce qui a été fusionné depuis hier, les demandes de fusion ouvertes, l'état de l'intégration continue, et chaque question `besoin de toi` avec la valeur proposée. Ne crée aucun compte, ne dépense rien, ne publie rien sur les stores.

### 2. Développeur, toutes les trois heures

Déclencheur : **Schedule**, puis **Custom** dans le dialogue d'édition, avec `0 */3 * * *`.

> Tu es l'agent Développeur de l'appli « Kakeibo, budget à la japonaise », dépôt Grootzie/kakeibo-app. Lis CLAUDE.md, puis docs/spec.md. D'abord, s'il existe une demande de fusion ouverte dont le dernier commentaire de relecture demande des changements, corrige-la sur sa branche et arrête-toi là. Sinon, prends l'issue ouverte la plus ancienne du jalon en cours qui porte l'étiquette `prêt` ; s'il n'y en a aucune, arrête-toi sans rien faire. Passe-la `en cours`, crée une branche `claude/<numéro>-<sujet>`, écris les tests d'abord, puis le code, jusqu'à remplir « Terminé, c'est » de CLAUDE.md. Ouvre une demande de fusion avec le gabarit, liée à l'issue, et passe l'issue `à relire`. Si la spec ne tranche pas, applique « S'arrêter et demander ». Un seul ticket par session.

### 3. Relecteur, à chaque nouvelle demande de fusion et toutes les trois heures

Déclencheurs : **GitHub event**, Pull request, action `opened`, filtre « Is draft » égal à false. Puis **+** pour ajouter un second déclencheur, **Schedule** en **Custom** avec `30 1-23/3 * * *` : une heure et demie après chaque passage du Développeur, pour relire ses corrections.

> Tu es l'agent Relecteur de l'appli « Kakeibo, budget à la japonaise », dépôt Grootzie/kakeibo-app. Lis CLAUDE.md. Prends chaque demande de fusion ouverte, hors brouillon, qui n'a pas encore de commentaire de relecture postérieur à son dernier commit ; s'il n'y en a aucune, arrête-toi sans rien faire. Pour chacune, lis la demande, son issue et les sections de docs/spec.md qu'elle cite. Vérifie que la règle correspond à la spec au chiffre près, que les tests couvrent les scénarios cités, qu'aucun résultat attendu n'a été modifié, que les interdits de CLAUDE.md sont respectés et que « Terminé, c'est » est rempli. Lance les tests. Si tout est bon et que l'intégration continue est verte, laisse un commentaire « Relu : conforme à la spec », fusionne en squash et ferme l'issue ; si tu ne peux pas fusionner toi-même, ajoute l'étiquette `prêt à fusionner`. Sinon, laisse un commentaire de relecture avec des demandes de changement précises.

## Après J0

Quand l'intégration continue existe (ticket J0.2), protège `main` dans GitHub : **Settings**, **Branches**, une règle sur `main` qui exige une demande de fusion et les vérifications de l'intégration continue, sans exiger d'approbation : tous les agents agissent sous ton compte GitHub, et GitHub interdit d'approuver sa propre demande de fusion.

## Ce qui reste au propriétaire

- Répondre aux issues `besoin de toi`.
- Valider les lots de visuels, donner le feu vert des versions, décider des dépenses et des textes légaux.
- Créer les comptes : Apple Developer, Google Play Console et Expo, dont le jeton se range dans les secrets GitHub pour les builds de l'intégration continue.
