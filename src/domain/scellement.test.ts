// Clôture des jours, scellement et résultat d'une semaine (J1.3).
// Contexte commun : installation le lundi 2 novembre 2026, semaine 45 du lundi 2 au dimanche 8,
// enveloppe de 140 €, chaque jour clôturé le soir même sauf mention contraire.

describe('clôture et scellement', () => {
  test.todo(
    'scénario 1 : semaine 45 avec 7 clôtures et 120 € dépensés, scellée à la clôture du dimanche 8 ; le 1er objet à gagner de la pièce de novembre sort de sa capsule, rien ne se fêle',
  );
  test.todo(
    'scénario 3 : semaine 45, mercredi 4 jamais clôturé, 100 € dépensés ; scellée le lundi 9 à 12:00 avec 6 tampons, pas de capsule, la poussière reste au moins au niveau 1 jusqu’à la prochaine semaine complète',
  );
  test.todo(
    'scénario 5 : mercredi 4 rattrapé le jeudi 5 à 8:00, les autres jours clôturés le soir ; 7 tampons, même résultat que le scénario 1 ou 2 selon le dépensé',
  );
  test.todo(
    'scénario 6 : dimanche 8 clôturé le lundi 9 à 10:00, accepté (7 tampons, scellement à cette clôture) ; à 12:01 la même clôture est refusée, semaine déjà scellée à 12:00 avec 6 tampons',
  );
  test.todo(
    'scénario 7 : installation le jeudi 5 novembre, 4 clôtures, 70 € dépensés ; 4 jours décomptés, enveloppe de 80 €, le 1er objet à gagner de novembre sort de sa capsule',
  );
  test.todo(
    'scénario 15 : une dépense de la semaine 45 modifiée le mardi 10 ; résultat de la semaine 45 inchangé, le carnet affiche le nouveau montant',
  );
  test.todo(
    'scénario 19 : le lundi 9, clôture du mardi 10 refusée (jour futur) et dépense datée du jeudi 29 octobre refusée (jour avant l’installation)',
  );
});
