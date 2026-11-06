// Bilan du mois : les quatre questions (J1.7).
// Contexte commun : revenus 2 000 €, charges fixes 1 100 €, épargne visée 300 €.
// Le déblocage de la pièce du mois suivant (fin du scénario 17) relève de J1.4 : il est testé
// dans objets.test.ts, sous le titre « scénario 17 (déblocage) ».
import type { BudgetVersion, Expense } from './budget';
import {
  RESOLUTION_MAX_LENGTH,
  isValidResolution,
  latestBudgetOfMonth,
  monthReview,
  monthToReview,
} from './bilanMois';

const euros = (n: number): number => Math.round(n * 100);

const novembre: BudgetVersion = {
  id: 'b-nov',
  month: '2026-11',
  income: euros(2000),
  fixedCosts: euros(1100),
  savingsGoal: euros(300),
  effectiveFrom: '2026-11-02',
};

const depense = (id: string, day: string, amount: number): Expense => ({ id, day, amount });

describe('bilan du mois', () => {
  test('scénario 17 : bilan de novembre avec 520 € dépensés dans le mois ; Q1 900 €, Q2 300 €, Q3 520 €, épargne réelle 380 €, objectif atteint', () => {
    const depenses = [
      depense('a', '2026-11-03', euros(120)),
      depense('b', '2026-11-12', euros(150)),
      depense('c', '2026-11-30', euros(250)),
    ];
    const bilan = monthReview('2026-11', novembre, depenses);
    expect(bilan).toEqual({
      month: '2026-11',
      q1: euros(900),
      q2: euros(300),
      q3: euros(520),
      realSavings: euros(380),
      goalReached: true,
    });
  });

  test('Q3 compte toutes les semaines du mois, y compris celles à cheval sur deux mois, et rien d’autre', () => {
    const depenses = [
      depense('oct', '2026-10-31', euros(40)), // semaine 44, mois précédent
      depense('nov1', '2026-11-01', euros(10)),
      depense('nov30', '2026-11-30', euros(20)),
      depense('dec', '2026-12-01', euros(70)), // semaine 49, mois suivant
    ];
    expect(monthReview('2026-11', novembre, depenses).q3).toBe(euros(30));
  });

  test('objectif atteint quand l’épargne réelle égale l’épargne visée', () => {
    const bilan = monthReview('2026-11', novembre, [depense('a', '2026-11-05', euros(600))]);
    expect(bilan.realSavings).toBe(euros(300));
    expect(bilan.goalReached).toBe(true);
  });

  test('objectif manqué d’un centime, et épargne réelle négative possible', () => {
    const juste = monthReview('2026-11', novembre, [depense('a', '2026-11-05', euros(600) + 1)]);
    expect(juste.realSavings).toBe(euros(300) - 1);
    expect(juste.goalReached).toBe(false);

    const large = monthReview('2026-11', novembre, [depense('a', '2026-11-05', euros(1000))]);
    expect(large.realSavings).toBe(-euros(100));
    expect(large.goalReached).toBe(false);
  });

  test('sans dépense, l’épargne réelle vaut Q1', () => {
    const bilan = monthReview('2026-11', novembre, []);
    expect(bilan.q3).toBe(0);
    expect(bilan.realSavings).toBe(euros(900));
    expect(bilan.goalReached).toBe(true);
  });

  test('les échéances récurrentes ne sont pas des dépenses : Q1 les retire déjà, Q3 ne les voit pas', () => {
    const bilan = monthReview('2026-11', { ...novembre, fixedCosts: euros(1112) }, []);
    expect(bilan.q1).toBe(euros(888));
  });

  test('refuse une version de budget d’un autre mois', () => {
    expect(() => monthReview('2026-12', novembre, [])).toThrow();
  });
});

describe('Q4 : comment puis-je faire mieux ?', () => {
  test('texte libre de 0 à 140 caractères', () => {
    expect(RESOLUTION_MAX_LENGTH).toBe(140);
    expect(isValidResolution('')).toBe(true);
    expect(isValidResolution('a'.repeat(140))).toBe(true);
    expect(isValidResolution('a'.repeat(141))).toBe(false);
  });

  test('un caractère compte pour un, même hors du plan de base', () => {
    expect(isValidResolution('é'.repeat(140))).toBe(true);
    expect(isValidResolution('🍵'.repeat(140))).toBe(true);
    expect(isValidResolution('🍵'.repeat(141))).toBe(false);
  });
});

describe('version du budget utilisée par le bilan', () => {
  const v = (id: string, month: string, from: string, income = euros(2000)): BudgetVersion => ({
    ...novembre,
    id,
    month,
    effectiveFrom: from,
    income,
  });

  test('la dernière version du mois, même créée en cours de mois', () => {
    const versions = [
      v('a', '2026-11', '2026-11-02'),
      v('c', '2026-11', '2026-11-20', euros(2500)),
      v('b', '2026-11', '2026-11-04', euros(2200)),
      v('d', '2026-12', '2026-12-01'),
    ];
    expect(latestBudgetOfMonth('2026-11', versions)?.id).toBe('c');
  });

  test('aucune version pour le mois : rien', () => {
    expect(latestBudgetOfMonth('2026-12', [v('a', '2026-11', '2026-11-02')])).toBeNull();
  });
});

describe('mois proposé au bilan', () => {
  const installation = '2026-11-02';

  test('rien avant le 1er du mois suivant', () => {
    expect(monthToReview('2026-11-30', installation, null)).toBeNull();
  });

  test('le 1er du mois suivant, le mois terminé est proposé', () => {
    expect(monthToReview('2026-12-01', installation, null)).toBe('2026-11');
  });

  test('après plusieurs mois d’absence, seul le dernier mois terminé est proposé', () => {
    expect(monthToReview('2027-02-10', installation, null)).toBe('2027-01');
    expect(monthToReview('2027-02-10', installation, '2026-11')).toBe('2027-01');
  });

  test('un mois déjà validé n’est plus proposé', () => {
    expect(monthToReview('2026-12-15', installation, '2026-11')).toBeNull();
  });

  test('passage d’année : décembre est proposé en janvier', () => {
    expect(monthToReview('2027-01-04', installation, '2026-11')).toBe('2026-12');
  });
});
