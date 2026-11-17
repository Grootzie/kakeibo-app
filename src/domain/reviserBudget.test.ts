// Revenus et épargne visée changés dans les réglages (E10, J5.6) : comme un changement de
// dépense récurrente, une nouvelle version du budget s'ajoute (on n'écrase jamais), en vigueur le
// lendemain, donc à l'enveloppe à partir de la semaine suivante. Contexte : installation le lundi
// 2 novembre 2026, 2 000 € de revenus, 1 100 € de charges fixes, 300 € d'épargne (600 € par mois).
import catalogueJson from '../content/catalogue.json';
import { type BudgetVersion, type RecurringCharge, budgetOf, weekEnvelope } from './budget';
import type { Catalog } from './objets';
import { type AppState, createAppState, process } from './traitement';

const catalog = catalogueJson as Catalog;
const INSTALL = '2026-11-02';
const euros = (n: number): number => Math.round(n * 100);

const chargesFixes: RecurringCharge = {
  id: 'c-fixes',
  label: 'Charges fixes',
  amount: euros(1100),
  frequency: 'monthly',
  day: 1,
  startsOn: '2026-11-01',
  endsOn: null,
};

function avecBudgetInitial(): AppState {
  const installe = createAppState(
    { installDay: INSTALL, at: { day: INSTALL, time: '08:00' }, budgets: [] },
    catalog,
  );
  const { state, refusal } = process(
    installe,
    {
      type: 'set_initial_budget',
      id: 'b-1',
      income: euros(2000),
      savingsGoal: euros(300),
      charges: [chargesFixes],
    },
    { day: INSTALL, time: '08:05' },
    catalog,
  );
  expect(refusal).toBeNull();
  return state;
}

describe('revenus et épargne changés dans les réglages (E10)', () => {
  test('une nouvelle version, en vigueur le lendemain : l’enveloppe change la semaine suivante', () => {
    const avant = avecBudgetInitial();
    const { state, refusal } = process(
      avant,
      {
        type: 'revise_budget',
        id: 'b-2',
        income: euros(2100),
        savingsGoal: euros(200),
        charges: [chargesFixes],
      },
      { day: '2026-11-04', time: '12:00' },
      catalog,
    );
    expect(refusal).toBeNull();
    expect(state.budgets).toHaveLength(2);
    expect(state.budgets[0]).toEqual(avant.budgets[0]);
    expect(state.budgets[1]).toEqual<BudgetVersion>({
      id: 'b-2',
      month: '2026-11',
      income: euros(2100),
      fixedCosts: euros(1100),
      savingsGoal: euros(200),
      effectiveFrom: '2026-11-05',
    });
    expect(budgetOf(state.budgets[1])).toBe(euros(800));
    // Semaine en cours inchangée : 600 € / 30 × 7 = 140 €.
    expect(weekEnvelope('2026-W45', state.budgets, INSTALL)).toBe(euros(140));
    // Semaine suivante : 800 € / 30 × 7 = 186,666… arrondi à 186,67 €.
    expect(weekEnvelope('2026-W46', state.budgets, INSTALL)).toBe(18667);
  });

  test('un changement fait un lundi ne touche pas la semaine en cours', () => {
    const { state } = process(
      avecBudgetInitial(),
      {
        type: 'revise_budget',
        id: 'b-2',
        income: euros(2100),
        savingsGoal: euros(200),
        charges: [chargesFixes],
      },
      { day: '2026-11-09', time: '07:00' },
      catalog,
    );
    expect(weekEnvelope('2026-W46', state.budgets, INSTALL)).toBe(euros(140));
    expect(weekEnvelope('2026-W47', state.budgets, INSTALL)).toBe(18667);
  });

  test('le dernier jour d’un mois : la version est celle du mois suivant', () => {
    const { state } = process(
      avecBudgetInitial(),
      {
        type: 'revise_budget',
        id: 'b-2',
        income: euros(2100),
        savingsGoal: euros(200),
        charges: [chargesFixes],
      },
      { day: '2026-11-30', time: '12:00' },
      catalog,
    );
    expect(state.budgets[1]).toMatchObject({
      month: '2026-12',
      income: euros(2100),
      fixedCosts: euros(1100),
      savingsGoal: euros(200),
      effectiveFrom: '2026-12-01',
    });
    // Semaine 49 : version en vigueur le lundi 30 novembre, comme au scénario 8.
    expect(weekEnvelope('2026-W49', state.budgets, INSTALL)).toBe(13613);
  });

  test('sans aucun changement, rien ne s’ajoute', () => {
    const avant = avecBudgetInitial();
    const { state, refusal } = process(
      avant,
      {
        type: 'revise_budget',
        id: 'b-2',
        income: euros(2000),
        savingsGoal: euros(300),
        charges: [chargesFixes],
      },
      { day: '2026-11-04', time: '12:00' },
      catalog,
    );
    expect(refusal).toBeNull();
    expect(state.budgets).toEqual(avant.budgets);
  });

  test('refuse un montant négatif ou non entier, et un budget du mois nul ou négatif', () => {
    const avant = avecBudgetInitial();
    const now = { day: '2026-11-04', time: '12:00' };
    const essai = (income: number, savingsGoal: number) =>
      process(
        avant,
        { type: 'revise_budget', id: 'b-2', income, savingsGoal, charges: [chargesFixes] },
        now,
        catalog,
      );
    for (const [income, savingsGoal] of [
      [-1, 0],
      [euros(2000), -1],
      [12.5, 0],
      [euros(1400), euros(300)],
      [euros(1000), 0],
    ]) {
      const { state, refusal } = essai(income, savingsGoal);
      expect({ income, savingsGoal, refusal }).toEqual({
        income,
        savingsGoal,
        refusal: 'invalid_budget',
      });
      expect(state.budgets).toEqual(avant.budgets);
    }
  });

  test('sans budget posé (bienvenue pas faite), refuse', () => {
    const installe = createAppState(
      { installDay: INSTALL, at: { day: INSTALL, time: '08:00' }, budgets: [] },
      catalog,
    );
    const { refusal } = process(
      installe,
      { type: 'revise_budget', id: 'b', income: euros(2000), savingsGoal: 0, charges: [] },
      { day: INSTALL, time: '09:00' },
      catalog,
    );
    expect(refusal).toBe('budget_not_set');
  });
});
