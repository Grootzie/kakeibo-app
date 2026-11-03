// Fêlure, file de réparation et réparation à l'or (J1.6).
// Contexte commun : installation le lundi 2 novembre 2026, semaine 45 du lundi 2 au dimanche 8,
// enveloppe de 140 €, chaque jour clôturé le soir même sauf mention contraire.

describe('fêlure et réparation', () => {
  test.todo(
    'scénario 2 : semaine 45 avec 7 clôtures et 150 € dépensés ; le même objet qu’au scénario 1 sort de sa capsule, et le 3e objet de base de novembre se fêle (à date égale, le dernier dans l’ordre du catalogue)',
  );
  test.todo(
    'scénario 4 : comme le scénario 3 (mercredi 4 jamais clôturé) avec 150 € dépensés ; pas de capsule, poussière comme au scénario 3, et le même objet qu’au scénario 2 se fêle',
  );
  test.todo(
    'scénario 10 : objet fêlé au bilan de la semaine 45, clôtures du lundi 9 au dimanche 15 ; réparé à la clôture du dimanche 15',
  );
  test.todo(
    'scénario 11 : fêlé en semaine 45, clôtures les 9 et 10 puis du 12 au 18, mercredi 11 jamais rattrapé ; affiche « 4 jours sur 7 » le dimanche 15, réparé à la clôture du mercredi 18',
  );
  test.todo(
    'scénario 12 : objet A fêlé en semaine 45, objet B fêlé en semaine 46, clôtures sans interruption à partir du lundi 9 ; A réparé dimanche 15, avant le scellement de la semaine 46, B réparé dimanche 22',
  );
  test.todo(
    'scénario 13 : semaine hors budget alors que tous les objets possédés sont fêlés ou réparés ; rien ne se fêle',
  );
  test.todo(
    'scénario 22 : semaines 45 à 47 complètes et dans le budget (objets A, B et C), semaine 48 avec 7 tampons hors budget ; l’objet D sort de sa capsule et C se fêle, l’objet gagné au même bilan ne se fêle jamais',
  );
});
