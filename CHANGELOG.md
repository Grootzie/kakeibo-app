# Journal des modifications

## Non publié

- Mise en place du dépôt : spécifications, règles des agents, découpage des jalons J0 et J1.
- Projet Expo (TypeScript strict, expo-router, ESLint, Prettier, Jest) avec les dossiers de la structure du code et les scripts `typecheck`, `lint` et `test` (#1).
- Intégration continue GitHub Actions : types, lint et tests sur chaque demande de fusion et sur `main` ; workflow d'émulateur Android avec Maestro, lancé à la main (#2).
- Base locale : expo-sqlite, migration SQL versionnée 1 avec les neuf tables du modèle de données, exécuteur de migrations transactionnel, dépôts vides et tests (#3).
- Textes et thème : `src/i18n/fr.ts` (vocabulaire, catégories, messages et cartes d'explication de la spec, montants à la française), thème neutre avec les couleurs et icônes des catégories, tests de typographie, de contraste et d'absence de texte en dur (#4).
- Horloge de test : réglage caché des builds de développement (appui long sur le titre) qui avance l’heure d’un jour, d’une semaine ou d’un mois ; inactif dans les builds publiés ; le domaine ne la lit jamais (#5).
- Démarrage vérifié : l’intégration continue exporte la version web et échoue si l’export échoue ; le workflow « Émulateur Android » construit un APK de développement (sans compte ni dépense), l’installe, lance l’appli et capture l’écran d’accueil (#13).
- Les 23 scénarios de la spec écrits en tests « à faire » dans `src/domain`, un fichier par groupe de règles, avec un garde-fou qui vérifie que chaque numéro figure une fois (#14).
