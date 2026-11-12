# Découpage des jalons

L'agent Produit transforme ces tickets en issues GitHub, avec l'étiquette `prêt`, et tient ce fichier à jour. Chaque ticket cite les sections de `docs/spec.md` à lire.

## J0 · Socle

Validé quand : l'appli démarre sur l'émulateur Android et en version web, intégration continue verte.

- **J0.1 · Projet Expo.** TypeScript strict, expo-router, dossiers de « Structure du code », ESLint et Prettier, scripts `typecheck`, `lint` et `test`. Sections : Architecture technique.
- **J0.2 · Intégration continue.** GitHub Actions sur chaque demande de fusion et sur `main` : types, lint, tests. Prévoir l'émulateur Android pour les parcours Maestro et les captures. Sections : Choix techniques.
- **J0.3 · Base locale.** expo-sqlite, migrations SQL versionnées, dépôts vides, test d'une migration. Sections : Modèle de données.
- **J0.4 · Textes et thème.** `src/i18n/fr.ts` et thème neutre avec les couleurs des catégories. Sections : Textes et ton, Fiche des visuels.
- **J0.5 · Horloge de test.** Réglage caché des builds de développement qui avance l'heure. Sections : Horloge de test.
- **J0.6 · Démarrage vérifié.** Export web vérifié dans l'intégration continue, APK de développement sur l'émulateur Android, parcours Maestro de l'accueil. Ajouté à la demande du propriétaire (#12), fusionné avant J2.

## J1 · Règles du jeu

Validé quand : les 25 scénarios passent, sans dépendance à l'interface. Tout se passe dans `src/domain`.

- **J1.0 · Les 25 scénarios en tests (Testeur).** Écrits avant le code, marqués « à faire » tant que la règle n'existe pas. Sections : Scénarios de test.
- **J1.1 · Calendrier.** Semaines ISO, mois d'une semaine (celui de son jeudi), jours décomptés. Scénarios 7 et 20.
- **J1.2 · Budget et enveloppe.** Versions du budget, dépenses récurrentes, enveloppe au prorata, reconduction d’un mois sans budget. Scénarios 8, 16, 23 et 24.
- **J1.3 · Clôture et scellement.** Clôtures acceptées ou refusées, délai de grâce, résultat d'une semaine. Scénarios 1, 3, 5, 6, 7, 15 et 19.
- **J1.4 · Objets et pièces.** Catalogue, objet suivant, déblocage, objet en attente, nouvelle année. Scénarios 17, 18, 20 et 21.
- **J1.5 · Poussière.** Niveaux et plancher après une semaine incomplète. Scénarios 3, 9 et 14.
- **J1.6 · Fêlure et réparation.** Objet qui se fêle, file de réparation, réparation à l'or. Scénarios 2, 4, 10, 11, 12, 13 et 22.
- **J1.7 · Bilan du mois.** Les quatre questions, reconduction d’un mois sans budget. Scénarios 17 et 25.
- **J1.8 · Ordre de traitement.** `process` : enchaînement des règles, retour après une longue absence. Scénarios 14 et 15.
- **J1.9 · Reconduction du budget d'un mois sans version.** Scénario 24 (spec, révision 833).
- **J1.10 · Bilan d'un mois sans version du budget.** Scénario 25 (spec, révision 837).

Validé le 6 novembre 2026 : les 25 scénarios passent, intégration continue verte sur `main`.

## J2 · Saisie et clôture

Validé quand : parcours Maestro « journée type » et « rattrapage » au vert sur l'émulateur Android, avec l'horloge de test.

Pas de maison à l'accueil (J4), pas de bienvenue (E1, J5), pas de dépenses récurrentes ni de calendrier (J5). En attendant E1, un budget de démonstration est posé par le réglage caché des builds de développement.

- **J2.1 · Dépôts et état.** (#42) Dépôts des dépenses, clôtures, versions du budget et réglages, écritures transactionnelles ; store Zustand qui appelle `process` avec l'heure de l'horloge (vraie ou de test) ; budget de démonstration dans le réglage caché. Sections : Architecture technique, Modèle de données, Ordre de traitement, Horloge de test.
- **J2.2 · Accueil sans maison (E2).** (#43) En-tête avec la date, enveloppe (reste ou dépassement, jauge), carte de 7 tampons et ses cinq états annoncés au lecteur d'écran, boutons « Noter une dépense » et « Clôturer ma journée » / « Journée clôturée », bandeau « jour à rattraper ». Sections : E2, Budget et enveloppe, Textes et ton, Accessibilité.
- **J2.3 · Noter une dépense (E3).** (#44) Feuille avec pavé numérique, quatre catégories qui enregistrent, note de 80 caractères, date parmi les semaines ouvertes, montants de 0,01 € à 99 999,99 €, « Annuler » pendant 5 secondes. Sans les dépenses récurrentes (J5). Sections : E3, Modèle de données, Textes et ton, Accessibilité.
- **J2.4 · Clôturer ma journée (E4).** (#45) Dépenses du jour et totaux par catégorie, « Ajouter une dépense oubliée », bouton unique « J'ai tout noté » ou « Rien dépensé aujourd'hui », tampon animé, retour à l'accueil ; refus expliqué si la clôture n'est pas permise. Sections : E4, Scellement de la semaine, Textes et ton.
- **J2.5 · Rattraper un jour (E5).** (#46) E4 pour un jour passé d'une semaine ouverte, titre « Rattraper mercredi 4 novembre », ouvert depuis la case oubliée ou le bandeau ; plus possible après le lundi 12:00. Sections : E5, E2, Scellement de la semaine.
- **J2.6 · Rappel du soir.** (#47) Notification locale (expo-notifications) à 21:00 par défaut, seulement si la journée n'est pas clôturée, annulée à la clôture, qui ouvre E4 ; trois textes en alternance ; un refus d'autorisation n'empêche rien. Sections : Notifications, Textes et ton, E10.
- **J2.7 · Cartes de première fois de J2.** (#48) Première dépense, premier tampon, premier jour à rattraper : une seule fois chacune (`seen_explanations`). Leur fiche dans Comprendre attend la décision du propriétaire (E12 est prévu en J5). Sections : E12, Messages d'explication, Principes du produit (10).
- **J2.8 · Parcours « journée type » et « rattrapage » (Testeur).** (#49) Deux parcours Maestro sur l'émulateur, avec l'horloge de test : noter, voir l'enveloppe baisser, clôturer ; oublier un jour, le rattraper, puis constater qu'il ne l'est plus après le lundi 12:00. Sections : Jalons, E2 à E5, Horloge de test.
- **J2.1 bis · Fiabiliser le parcours Maestro de l'émulateur.** (#52) Ajouté en cours de jalon : attente du lanceur de l'émulateur, capture et journaux joints même en cas d'échec.

Validé le 8 novembre 2026 : parcours « journée type » et « rattrapage » au vert sur l'émulateur Android avec l'horloge de test, intégration continue verte sur `main`.

## J3 · Bilans

Validé quand : parcours Maestro « semaine parfaite » et « semaine hors budget » au vert sur l'émulateur Android, avec l'horloge de test.

La maison arrive en J4 (en parallèle) : en attendant, le bilan montre l'objet seul, avec son dessin provisoire. Les fiches dans Comprendre attendent E12 (J5).

- **J3.1 · Bilans prêts dans l'état et bandeau de l'accueil.** (#61) Le store expose les bilans que `process` prépare ; `ceremony_seen` et `month_review` enregistrés ; un seul bandeau à l'accueil, par priorité : bilan de la semaine, bilan du mois, jour à rattraper, résolution. Sections : E2, E6, E7, Ordre de traitement, Modèle de données.
- **J3.2 · Bilan de la semaine (E6).** (#62) Quatre temps animés : tampons, dépensé face à l'enveloppe, résultat (tirette « Tirer la tirette » quand la semaine a tous ses jetons, capsule et objet, poussière, fêlure ; spec, révision 847) avec les textes de la spec, conclusion ; objet en attente ; animations réduites et lecteur d'écran. Sections : E6, Résultat d'une semaine, Objets et pièces, Textes et ton, Accessibilité.
- **J3.3 · Récapitulatif après une longue absence (E6).** (#63) Un seul écran pour les semaines manquées, sans reproche. Sections : E6, Ordre de traitement, scénarios 14 et 15.
- **J3.4 · Bilan du mois : les quatre questions (E7).** (#64) Q1 à Q3 chiffrées, par catégorie, épargne réelle, Q4 en 140 caractères, validation qui débloque la pièce suivante (et celles des mois sautés). Sections : E7, Bilan du mois, Objets et pièces, scénarios 17 et 25.
- **J3.5 · Budget du nouveau mois et résolution sur l'accueil.** (#65) Budget pré-rempli à confirmer (une version ajoutée seulement si un montant change), résolution affichée sur l'accueil tout le mois. Sections : E7, E2, Budget et enveloppe, Modèle de données.
- **J3.6 · Réparation annoncée et cartes de première fois de J3.** (#66) Annonce « Réparée à l'or, … » (emplacement à décider par le propriétaire) ; cartes première capsule, première poussière, première fêlure, première réparation, premier bilan du mois, nouvelle pièce. Sections : Fêlure et réparation, Textes et ton, E12, Messages d'explication.
- **J3.7 · Parcours « semaine parfaite » et « semaine hors budget » (Testeur).** (#67) Deux parcours Maestro sur l'émulateur, avec l'horloge de test, une capture par temps du bilan. Sections : Jalons, E2, E4, E6, Horloge de test.
- **J3.8 · Jeton du soir.** (#74) Ajouté à la demande du propriétaire (spec, révision 847) : à chaque clôture (E4 et E5), un jeton tombe dans la machine avec le tampon ; texte de la carte « Premier tampon » mis à jour. Aucune règle du domaine ne change. Sections : E4, E5, Objets et pièces, Fiche des visuels, Messages d'explication, Accessibilité.

## Ensuite

J4 à J9 : voir « Jalons » dans la spec. L'agent Produit découpe chaque jalon en tickets quand le précédent est validé.
