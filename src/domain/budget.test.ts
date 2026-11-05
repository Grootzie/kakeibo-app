// Budget, enveloppe et dépenses récurrentes (J1.2).
// Contexte commun : budget de novembre et de décembre 2026 = 2 000 € − 1 100 € − 300 € = 600 € par mois ;
// novembre compte 30 jours : 20 € par jour, 140 € pour une semaine entière.
import {
  type BudgetVersion,
  type Expense,
  type RecurringCharge,
  budgetOf,
  chargeDueDays,
  isInBudget,
  monthFixedCosts,
  reviseBudget,
  weekEnvelope,
  weekSpent,
} from './budget';

const INSTALL = '2026-11-02';
const euros = (n: number): number => Math.round(n * 100);

const novembre: BudgetVersion = {
  id: 'b-nov',
  month: '2026-11',
  income: euros(2000),
  fixedCosts: euros(1100),
  savingsGoal: euros(300),
  effectiveFrom: '2026-11-02',
};
const decembre: BudgetVersion = {
  ...novembre,
  id: 'b-dec',
  month: '2026-12',
};
const chargesFixes: RecurringCharge = {
  id: 'c-fixes',
  label: 'Charges fixes',
  amount: euros(1100),
  frequency: 'monthly',
  day: 1,
  startsOn: '2026-11-01',
  endsOn: null,
};

describe('budget et enveloppe', () => {
  test('le budget du mois vaut revenus − charges fixes − épargne visée', () => {
    expect(budgetOf(novembre)).toBe(euros(600));
  });

  test('semaine entière de novembre : 140 €, et seuls les jours décomptés comptent', () => {
    expect(weekEnvelope('2026-W45', [novembre], INSTALL)).toBe(euros(140));
    expect(weekEnvelope('2026-W45', [novembre], '2026-11-05')).toBe(euros(80));
    expect(weekEnvelope('2026-W44', [novembre], INSTALL)).toBe(0);
  });

  test(
    'scénario 8 : semaine du lundi 30 novembre au dimanche 6 décembre, ' +
      'enveloppe de 136,13 € (20 € pour le 30 novembre, plus 6 × 600/31 €)',
    () => {
      expect(weekEnvelope('2026-W49', [novembre, decembre], INSTALL)).toBe(13613);
    },
  );

  test(
    'scénario 24 : semaine du lundi 30 novembre au dimanche 6 décembre, aucune version de budget pour décembre ; ' +
      'décembre reprend la version de novembre (600 €), enveloppe de 136,13 €, comme au 8',
    () => {
      expect(weekEnvelope('2026-W49', [novembre], INSTALL)).toBe(13613);
    },
  );

  test('reconduction : sans version pour le mois, la plus récente déjà effective, tous mois confondus', () => {
    const octobre: BudgetVersion = {
      ...novembre,
      id: 'b-oct',
      month: '2026-10',
      income: euros(3000),
      effectiveFrom: '2026-10-01',
    };
    // Novembre (600 €) est plus récent qu'octobre (1 600 €) : décembre reprend novembre.
    expect(weekEnvelope('2026-W49', [octobre, novembre], INSTALL)).toBe(13613);
    // Une version qui n'est pas encore effective le lundi de la semaine n'est pas reprise.
    const futur: BudgetVersion = {
      ...novembre,
      id: 'b-futur',
      income: euros(2300),
      effectiveFrom: '2026-12-02',
    };
    expect(weekEnvelope('2026-W49', [novembre, futur], INSTALL)).toBe(13613);
    // Aucune version effective : rien n'est décompté.
    expect(weekEnvelope('2026-W49', [], INSTALL)).toBe(0);
  });

  test(
    'scénario 16 : le mercredi 4, le budget de novembre passe à 900 € ; ' +
      'enveloppe de la semaine 45 inchangée (140 €), semaine 46 à 210 €',
    () => {
      const revise: BudgetVersion = {
        ...novembre,
        id: 'b-nov-2',
        income: euros(2300),
        effectiveFrom: '2026-11-04',
      };
      expect(budgetOf(revise)).toBe(euros(900));
      const versions = [novembre, revise];
      expect(weekEnvelope('2026-W45', versions, INSTALL)).toBe(euros(140));
      expect(weekEnvelope('2026-W46', versions, INSTALL)).toBe(euros(210));
    },
  );

  test(
    "scénario 23 : le mardi 3 novembre, ajout d'un abonnement de 12 € le 15 de chaque mois ; " +
      "charges fixes de 1 112 €, budget de novembre de 588 €, semaine 45 inchangée (140 €), semaine 46 à 137,20 €, l'échéance du 15 n'entre pas dans le dépensé",
    () => {
      const abonnement: RecurringCharge = {
        id: 'c-abo',
        label: 'Abonnement',
        amount: euros(12),
        frequency: 'monthly',
        day: 15,
        startsOn: '2026-11-03',
        endsOn: null,
      };
      const charges = [chargesFixes, abonnement];
      expect(monthFixedCosts('2026-11', charges)).toBe(euros(1112));

      const revise = reviseBudget(novembre, charges, '2026-11-03', 'b-nov-2');
      expect(revise.fixedCosts).toBe(euros(1112));
      expect(budgetOf(revise)).toBe(euros(588));
      // On n'écrase jamais une version : la précédente reste intacte.
      expect(novembre.fixedCosts).toBe(euros(1100));

      const versions = [novembre, revise];
      expect(weekEnvelope('2026-W45', versions, INSTALL)).toBe(euros(140));
      expect(weekEnvelope('2026-W46', versions, INSTALL)).toBe(13720);

      // L'échéance du 15 est une charge fixe, pas une dépense : le dépensé de la semaine 46 l'ignore.
      const depenses: Expense[] = [{ id: 'e1', day: '2026-11-10', amount: euros(30) }];
      expect(chargeDueDays('2026-11', abonnement)).toEqual(['2026-11-15']);
      expect(weekSpent('2026-W46', depenses)).toBe(euros(30));
    },
  );

  test('arrondi au centime le plus proche, une seule fois, à la fin', () => {
    // 600/31 = 19,3548… € par jour : 3 jours → 58,06 €, pas 3 × 19,35 = 58,05 €.
    const sansArrondiIntermediaire = weekEnvelope('2026-W49', [decembre], '2026-12-04');
    expect(sansArrondiIntermediaire).toBe(5806);
  });
});

describe('dépenses récurrentes', () => {
  test('mensuelle : le jour est ramené au dernier jour des mois plus courts', () => {
    const fin: RecurringCharge = { ...chargesFixes, id: 'c31', day: 31 };
    expect(chargeDueDays('2026-11', fin)).toEqual(['2026-11-30']);
    expect(chargeDueDays('2027-02', { ...fin, startsOn: '2026-11-01' })).toEqual(['2027-02-28']);
    expect(chargeDueDays('2028-02', fin)).toEqual(['2028-02-29']);
  });

  test('hebdomadaire : une échéance chaque semaine, le jour de la semaine choisi', () => {
    const lundi: RecurringCharge = {
      id: 'c-lundi',
      label: 'Courses',
      amount: euros(10),
      frequency: 'weekly',
      day: 1,
      startsOn: '2026-11-01',
      endsOn: null,
    };
    expect(chargeDueDays('2026-11', lundi)).toEqual([
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
      '2026-11-23',
      '2026-11-30',
    ]);
    expect(monthFixedCosts('2026-11', [lundi])).toBe(euros(50));
  });

  test('une charge arrêtée garde son historique : ses échéances passées comptent, pas les suivantes', () => {
    const arretee: RecurringCharge = { ...chargesFixes, endsOn: '2026-11-30' };
    expect(monthFixedCosts('2026-11', [arretee])).toBe(euros(1100));
    expect(monthFixedCosts('2026-12', [arretee])).toBe(0);
    const avant: RecurringCharge = { ...chargesFixes, startsOn: '2026-11-02' };
    expect(monthFixedCosts('2026-11', [avant])).toBe(0);
  });
});

describe('dépensé et reste', () => {
  const depenses: Expense[] = [
    { id: 'a', day: '2026-11-01', amount: 999 },
    { id: 'b', day: '2026-11-02', amount: 4000 },
    { id: 'c', day: '2026-11-08', amount: 8000 },
    { id: 'd', day: '2026-11-09', amount: 500 },
  ];

  test('le dépensé est la somme des dépenses datées des jours de la semaine', () => {
    expect(weekSpent('2026-W45', depenses)).toBe(12000);
  });

  test('dans le budget : dépensé ≤ enveloppe ; le reste peut être négatif', () => {
    expect(isInBudget(14000, 14000)).toBe(true);
    expect(isInBudget(14001, 14000)).toBe(false);
  });
});
