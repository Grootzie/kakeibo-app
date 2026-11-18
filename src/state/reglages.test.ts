// Réglages (E10, J5.6) : ce que l'écran montre du budget du mois et des dépenses récurrentes, et
// quand un changement s'applique à l'enveloppe. Purs : l'état et l'heure leur sont passés.
import catalogueJson from '../content/catalogue.json';
import type { RecurringChargeRow } from '../data/repositories';
import type { Catalog } from '../domain/objets';
import { type AppState, createAppState, process } from '../domain/traitement';
import {
  apercuReglages,
  changementApplique,
  chargeSaisieValide,
  decalerJourCharge,
  vueBudgetReglages,
} from './reglages';

const catalog = catalogueJson as Catalog;
const INSTALL = '2026-11-02';
const euros = (n: number): number => Math.round(n * 100);

const chargesFixes: RecurringChargeRow = {
  id: 'c-fixes',
  label: 'Charges fixes',
  amount: euros(1100),
  frequency: 'monthly',
  day: 1,
  starts_on: '2026-11-01',
  ends_on: null,
};

function avecBudget(): AppState {
  const s0 = createAppState(
    { installDay: INSTALL, at: { day: INSTALL, time: '08:00' }, budgets: [] },
    catalog,
  );
  return process(
    s0,
    {
      type: 'set_initial_budget',
      id: 'b-1',
      income: euros(2000),
      savingsGoal: euros(300),
      charges: [
        {
          id: 'c-fixes',
          label: 'Charges fixes',
          amount: euros(1100),
          frequency: 'monthly',
          day: 1,
          startsOn: '2026-11-01',
          endsOn: null,
        },
      ],
    },
    { day: INSTALL, time: '08:05' },
    catalog,
  ).state;
}

describe('budget du mois dans les réglages', () => {
  test('les montants de la version qui s’appliquera, et les dépenses récurrentes en cours', () => {
    const arretee: RecurringChargeRow = {
      ...chargesFixes,
      id: 'c-old',
      label: 'Ancien abonnement',
      ends_on: '2026-11-03',
    };
    const vue = vueBudgetReglages(avecBudget(), [chargesFixes, arretee], {
      day: '2026-11-04',
      time: '12:00',
    });
    expect(vue).toEqual({
      income: euros(2000),
      fixedCosts: euros(1100),
      savingsGoal: euros(300),
      budgetMois: euros(600),
      changementLe: '2026-11-09',
      charges: [chargesFixes],
    });
  });

  test('après un changement, les nouveaux montants (en vigueur demain)', () => {
    const s = process(
      avecBudget(),
      {
        type: 'revise_budget',
        id: 'b-2',
        income: euros(2100),
        savingsGoal: euros(200),
        charges: [
          {
            id: 'c-fixes',
            label: 'Charges fixes',
            amount: euros(1100),
            frequency: 'monthly',
            day: 1,
            startsOn: '2026-11-01',
            endsOn: null,
          },
        ],
      },
      { day: '2026-11-04', time: '12:00' },
      catalog,
    ).state;
    const vue = vueBudgetReglages(s, [chargesFixes], { day: '2026-11-04', time: '12:05' });
    expect(vue).toMatchObject({ income: euros(2100), savingsGoal: euros(200), budgetMois: 80000 });
  });

  test('sans budget posé : rien à montrer', () => {
    const s0 = createAppState(
      { installDay: INSTALL, at: { day: INSTALL, time: '08:00' }, budgets: [] },
      catalog,
    );
    expect(vueBudgetReglages(s0, [], { day: INSTALL, time: '09:00' })).toBeNull();
  });
});

describe('quand un changement s’applique', () => {
  test('au lundi suivant, même un lundi ou un dimanche', () => {
    expect(changementApplique('2026-11-04')).toBe('2026-11-09');
    expect(changementApplique('2026-11-09')).toBe('2026-11-16');
    expect(changementApplique('2026-11-15')).toBe('2026-11-16');
    expect(changementApplique('2026-12-28')).toBe('2027-01-04');
  });
});

describe('aperçu du budget saisi', () => {
  test('revenus − charges fixes − épargne ; on n’enregistre qu’un budget positif et changé', () => {
    const base = { income: euros(2000), fixedCosts: euros(1100), savingsGoal: euros(300) };
    expect(apercuReglages({ income: euros(2100), savingsGoal: euros(200) }, base)).toEqual({
      budgetMois: euros(800),
      peutEnregistrer: true,
    });
    expect(apercuReglages({ income: euros(2000), savingsGoal: euros(300) }, base)).toEqual({
      budgetMois: euros(600),
      peutEnregistrer: false,
    });
    expect(apercuReglages({ income: euros(1400), savingsGoal: euros(300) }, base)).toEqual({
      budgetMois: 0,
      peutEnregistrer: false,
    });
    expect(apercuReglages({ income: null, savingsGoal: euros(300) }, base)).toEqual({
      budgetMois: null,
      peutEnregistrer: false,
    });
  });
});

describe('saisie d’une dépense récurrente', () => {
  test('libellé, montant positif et jour dans les bornes de la fréquence', () => {
    const ok = { label: 'Loyer', amount: euros(700), frequency: 'monthly' as const, day: 5 };
    expect(chargeSaisieValide(ok)).toBe(true);
    expect(chargeSaisieValide({ ...ok, label: '  ' })).toBe(false);
    expect(chargeSaisieValide({ ...ok, amount: null })).toBe(false);
    expect(chargeSaisieValide({ ...ok, amount: 0 })).toBe(false);
    expect(chargeSaisieValide({ ...ok, day: 31 })).toBe(true);
    expect(chargeSaisieValide({ ...ok, frequency: 'weekly', day: 8 })).toBe(false);
  });

  test('le jour tourne dans ses bornes : 1 à 31 pour un mois, lundi à dimanche pour une semaine', () => {
    expect(decalerJourCharge('monthly', 31, 1)).toBe(1);
    expect(decalerJourCharge('monthly', 1, -1)).toBe(31);
    expect(decalerJourCharge('monthly', 14, 1)).toBe(15);
    expect(decalerJourCharge('weekly', 7, 1)).toBe(1);
    expect(decalerJourCharge('weekly', 1, -1)).toBe(7);
    // Passer de « chaque mois, le 15 » à « chaque semaine » ramène le jour dans ses bornes.
    expect(decalerJourCharge('weekly', 15, 0)).toBe(7);
  });
});
