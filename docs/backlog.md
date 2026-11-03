# Découpage des jalons

L'agent Produit transforme ces tickets en issues GitHub, avec l'étiquette `prêt`, et tient ce fichier à jour. Chaque ticket cite les sections de `docs/spec.md` à lire.

## J0 · Socle

Validé quand : l'appli démarre sur l'émulateur Android et en version web, intégration continue verte.

- **J0.1 · Projet Expo.** TypeScript strict, expo-router, dossiers de « Structure du code », ESLint et Prettier, scripts `typecheck`, `lint` et `test`. Sections : Architecture technique.
- **J0.2 · Intégration continue.** GitHub Actions sur chaque demande de fusion et sur `main` : types, lint, tests. Prévoir l'émulateur Android pour les parcours Maestro et les captures. Sections : Choix techniques.
- **J0.3 · Base locale.** expo-sqlite, migrations SQL versionnées, dépôts vides, test d'une migration. Sections : Modèle de données.
- **J0.4 · Textes et thème.** `src/i18n/fr.ts` et thème neutre avec les couleurs des catégories. Sections : Textes et ton, Fiche des visuels.
- **J0.5 · Horloge de test.** Réglage caché des builds de développement qui avance l'heure. Sections : Horloge de test.

- **J0.6 · Démarrage vérifié.** Export web vérifié dans l'intégration continue, premier passage de l'émulateur Android avec un APK de développement. Ajouté par décision du propriétaire (#12) : à traiter en parallèle de J1, fusionné avant le premier ticket de J2. Sections : Architecture technique, Choix techniques.

Statut : J0.1 à J0.5 fusionnés, J0 validé par le propriétaire le 2026-11-03 (#12). Issues : J0.6 = #13, J1.0 à J1.8 = #14 à #22.

## J1 · Règles du jeu

Validé quand : les 23 scénarios passent, sans dépendance à l'interface. Tout se passe dans `src/domain`.

- **J1.0 · Les 23 scénarios en tests (Testeur).** Écrits avant le code, marqués « à faire » tant que la règle n'existe pas. Sections : Scénarios de test.
- **J1.1 · Calendrier.** Semaines ISO, mois d'une semaine (celui de son jeudi), jours décomptés. Scénarios 7 et 20.
- **J1.2 · Budget et enveloppe.** Versions du budget, dépenses récurrentes, enveloppe au prorata. Scénarios 8, 16 et 23.
- **J1.3 · Clôture et scellement.** Clôtures acceptées ou refusées, délai de grâce, résultat d'une semaine. Scénarios 1, 3, 5, 6, 7, 15 et 19.
- **J1.4 · Objets et pièces.** Catalogue, objet suivant, déblocage, objet en attente, nouvelle année. Scénarios 17, 18, 20 et 21.
- **J1.5 · Poussière.** Niveaux et plancher après une semaine incomplète. Scénarios 3, 9 et 14.
- **J1.6 · Fêlure et réparation.** Objet qui se fêle, file de réparation, réparation à l'or. Scénarios 2, 4, 10, 11, 12, 13 et 22.
- **J1.7 · Bilan du mois.** Les quatre questions. Scénario 17.
- **J1.8 · Ordre de traitement.** `process` : enchaînement des règles, retour après une longue absence. Scénarios 14 et 15.

## Ensuite

J2 à J9 : voir « Jalons » dans la spec. L'agent Produit découpe chaque jalon en tickets quand le précédent est validé.
