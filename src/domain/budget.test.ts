// Budget, enveloppe et dépenses récurrentes (J1.2).
// Contexte commun : budget de novembre et de décembre 2026 = 2 000 € − 1 100 € − 300 € = 600 € par mois ;
// novembre compte 30 jours : 20 € par jour, 140 € pour une semaine entière.

describe('budget et enveloppe', () => {
  test.todo(
    'scénario 8 : semaine du lundi 30 novembre au dimanche 6 décembre, enveloppe de 136,13 € (20 € pour le 30 novembre, plus 6 × 600/31 €)',
  );
  test.todo(
    'scénario 16 : le mercredi 4, le budget de novembre passe à 900 € ; enveloppe de la semaine 45 inchangée (140 €), semaine 46 à 210 €',
  );
  test.todo(
    "scénario 23 : le mardi 3 novembre, ajout d'un abonnement de 12 € le 15 de chaque mois ; charges fixes de 1 112 €, budget de novembre de 588 €, semaine 45 inchangée (140 €), semaine 46 à 137,20 €, l'échéance du 15 n'entre pas dans le dépensé",
  );
});
