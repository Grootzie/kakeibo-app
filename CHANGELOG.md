# Journal des modifications

## Non publié

- Spec, révision 833 : un mois sans version de budget reprend la version en vigueur la plus récente (scénario 24).
- Mise en place du dépôt : spécifications, règles des agents, découpage des jalons J0 et J1.
- Projet Expo (TypeScript strict, expo-router, ESLint, Prettier, Jest) avec les dossiers de la structure du code et les scripts `typecheck`, `lint` et `test` (#1).
- Intégration continue GitHub Actions : types, lint et tests sur chaque demande de fusion et sur `main` ; workflow d'émulateur Android avec Maestro, lancé à la main (#2).
- Base locale : expo-sqlite, migration SQL versionnée 1 avec les neuf tables du modèle de données, exécuteur de migrations transactionnel, dépôts vides et tests (#3).
- Textes et thème : `src/i18n/fr.ts` (vocabulaire, catégories, messages et cartes d'explication de la spec, montants à la française), thème neutre avec les couleurs et icônes des catégories, tests de typographie, de contraste et d'absence de texte en dur (#4).
- Horloge de test : réglage caché des builds de développement (appui long sur le titre) qui avance l’heure d’un jour, d’une semaine ou d’un mois ; inactif dans les builds publiés ; le domaine ne la lit jamais (#5).
- Démarrage vérifié : l’intégration continue exporte la version web et échoue si l’export échoue ; le workflow « Émulateur Android » construit un APK de développement (sans compte ni dépense), l’installe, lance l’appli et capture l’écran d’accueil (#13).
- Parcours Maestro `e2e/accueil.yaml` : le passage échoue si l’accueil n’affiche pas « Noter une dépense » ; bouton ajouté à l’accueil (sans action pour l’instant) ; règle de preuve ajoutée à « Terminé, c’est » (#13).
- Le workflow « Émulateur Android » se lance sur chaque demande de fusion : il prouve le critère d’affichage de l’accueil et doit être vert avant fusion (#13).
- Les 23 scénarios de la spec écrits en tests « à faire » dans `src/domain`, un fichier par groupe de règles, avec un garde-fou qui vérifie que chaque numéro figure une fois (#14).
- Calendrier du domaine : jours, semaines ISO 8601, jours décomptés, mois d'une semaine (celui de son jeudi) et emplacements des mois de 4 ou 5 semaines ; scénario 20 activé, partie calendrier du scénario 7 testée (#15).
- Budget et enveloppe du domaine : budget du mois, versions du budget (jamais écrasées), dépenses récurrentes et leurs échéances, enveloppe d’une semaine au prorata exact arrondi une fois, dépensé de la semaine ; scénarios 8, 16 et 23 activés (#16).
- Objets et pièces du domaine : catalogue JSON des 12 pièces, 36 objets de base et 59 objets à gagner (noms du tableau de la spec), objet suivant sans hasard selon les emplacements du mois, objet de la semaine, objet en attente d’une pièce non débloquée, déblocage par le bilan du mois (mois sautés compris), nouvelle année et album ; scénarios 18 et 21 activés, scénarios 17 (déblocage) et 20 (emplacements) couverts (#18).
- Clôture et scellement du domaine : clôtures acceptées ou refusées (avant l’installation, jour futur, déjà clôturé, semaine scellée), délai de grâce du lundi 12:00, moment de scellement, semaines à sceller dans l’ordre, résultat d’une semaine (capsule, fêlure, drapeau « complète » lu par la poussière), résultat figé après modification d’une dépense ; scénarios 1, 3, 5, 6, 7, 15 et 19 activés (#17).
- Fêlure et réparation du domaine : objet qui se fêle (le plus récent intact, hors objet gagné au même bilan, dernier du catalogue à date égale), file de réparation, jour de départ, série de 7 jours clôturés, progression « x jours sur 7 », passage à l’or ; scénarios 2, 4, 10, 11, 12, 13 et 22 activés (#20).
