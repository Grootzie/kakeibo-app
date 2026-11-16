// Dépenses récurrentes dans l'état (J5.1) : chaque changement ajoute une version du budget dont
// les charges fixes sont la somme des échéances du mois ; elle s'applique à partir de la semaine
// suivante. Contexte commun des scénarios : installation le lundi 2 novembre 2026, 600 € par mois.
import catalogueJson from '../content/catalogue.json';
import {
  type BudgetVersion,
  type RecurringCharge,
  budgetOf,
  isValidCharge,
  weekEnvelope,
  weekSpent,
} from './budget';
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
const abonnement: RecurringCharge = {
  id: 'c-abo',
  label: 'Abonnement',
  amount: euros(12),
  frequency: 'monthly',
  day: 15,
  startsOn: '2026-11-03',
  endsOn: null,
};

function installe(): AppState {
  return createAppState(
    { installDay: INSTALL, at: { day: INSTALL, time: '08:00' }, budgets: [] },
    catalog,
  );
}

function avecBudgetInitial(): AppState {
  const { state, refusal } = process(
    installe(),
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

describe('budget initial (E1)', () => {
  test('les charges fixes saisies deviennent la version du mois d’installation, dès son lundi', () => {
    const s = avecBudgetInitial();
    expect(s.budgets).toEqual<BudgetVersion[]>([
      {
        id: 'b-1',
        month: '2026-11',
        income: euros(2000),
        fixedCosts: euros(1100),
        savingsGoal: euros(300),
        effectiveFrom: '2026-11-02',
      },
    ]);
    expect(weekEnvelope('2026-W45', s.budgets, INSTALL)).toBe(euros(140));
  });

  test('installé un dimanche : la version vaut dès le lundi de la semaine d’installation', () => {
    const s0 = createAppState(
      { installDay: '2026-11-08', at: { day: '2026-11-08', time: '08:00' }, budgets: [] },
      catalog,
    );
    const { state } = process(
      s0,
      {
        type: 'set_initial_budget',
        id: 'b-1',
        income: euros(2000),
        savingsGoal: euros(300),
        charges: [chargesFixes],
      },
      { day: '2026-11-08', time: '08:05' },
      catalog,
    );
    expect(state.budgets[0].effectiveFrom).toBe('2026-11-02');
    expect(weekEnvelope('2026-W45', state.budgets, '2026-11-08')).toBe(euros(20));
  });

  test('refusé si un budget existe déjà, ou si le budget du mois n’est pas supérieur à zéro', () => {
    const s = avecBudgetInitial();
    const evenement = {
      type: 'set_initial_budget' as const,
      id: 'b-2',
      income: euros(2000),
      savingsGoal: euros(300),
      charges: [chargesFixes],
    };
    expect(process(s, evenement, { day: INSTALL, time: '09:00' }, catalog).refusal).toBe(
      'budget_already_set',
    );
    const nul = process(
      installe(),
      { ...evenement, income: euros(1400) },
      { day: INSTALL, time: '09:00' },
      catalog,
    );
    expect(nul.refusal).toBe('invalid_budget');
    expect(nul.state.budgets).toEqual([]);
  });

  test('sans charges fixes, la version a 0 € de charges fixes', () => {
    const { state, refusal } = process(
      installe(),
      { type: 'set_initial_budget', id: 'b-1', income: euros(600), savingsGoal: 0, charges: [] },
      { day: INSTALL, time: '08:05' },
      catalog,
    );
    expect(refusal).toBeNull();
    expect(budgetOf(state.budgets[0])).toBe(euros(600));
  });
});

describe('changement des dépenses récurrentes', () => {
  test(
    'ajout d’un abonnement le mardi 3 novembre (comme au scénario 23) : nouvelle version, ' +
      'la précédente reste, semaine 45 inchangée, semaine 46 à 137,20 €',
    () => {
      const avant = avecBudgetInitial();
      const { state, refusal } = process(
        avant,
        { type: 'revise_fixed_costs', id: 'b-2', charges: [chargesFixes, abonnement] },
        { day: '2026-11-03', time: '12:00' },
        catalog,
      );
      expect(refusal).toBeNull();
      expect(state.budgets).toHaveLength(2);
      expect(state.budgets[0]).toEqual(avant.budgets[0]);
      expect(state.budgets[1]).toEqual<BudgetVersion>({
        id: 'b-2',
        month: '2026-11',
        income: euros(2000),
        fixedCosts: euros(1112),
        savingsGoal: euros(300),
        effectiveFrom: '2026-11-04',
      });
      expect(budgetOf(state.budgets[1])).toBe(euros(588));
      expect(weekEnvelope('2026-W45', state.budgets, INSTALL)).toBe(euros(140));
      expect(weekEnvelope('2026-W46', state.budgets, INSTALL)).toBe(13720);
      // Les échéances ne sont pas des dépenses.
      expect(state.expenses).toEqual([]);
      expect(weekSpent('2026-W46', state.expenses)).toBe(0);
    },
  );

  test('un changement fait un lundi ne touche pas la semaine en cours', () => {
    const { state } = process(
      avecBudgetInitial(),
      { type: 'revise_fixed_costs', id: 'b-2', charges: [chargesFixes, abonnement] },
      { day: '2026-11-09', time: '07:00' },
      catalog,
    );
    expect(weekEnvelope('2026-W46', state.budgets, INSTALL)).toBe(euros(140));
    expect(weekEnvelope('2026-W47', state.budgets, INSTALL)).toBe(13720);
  });

  test('arrêter une charge : l’échéance d’après l’arrêt sort des charges fixes', () => {
    const s1 = process(
      avecBudgetInitial(),
      { type: 'revise_fixed_costs', id: 'b-2', charges: [chargesFixes, abonnement] },
      { day: '2026-11-03', time: '12:00' },
      catalog,
    ).state;
    const arrete = { ...abonnement, endsOn: '2026-11-10' };
    const { state } = process(
      s1,
      { type: 'revise_fixed_costs', id: 'b-3', charges: [chargesFixes, arrete] },
      { day: '2026-11-10', time: '12:00' },
      catalog,
    );
    expect(state.budgets.map((b) => b.fixedCosts)).toEqual([euros(1100), euros(1112), euros(1100)]);
    expect(state.budgets[2].effectiveFrom).toBe('2026-11-11');
  });

  test('le dernier jour d’un mois : la version est celle du mois suivant, sa semaine en cours inchangée', () => {
    const { state } = process(
      avecBudgetInitial(),
      {
        type: 'revise_fixed_costs',
        id: 'b-2',
        charges: [chargesFixes, { ...abonnement, startsOn: '2026-11-30' }],
      },
      { day: '2026-11-30', time: '12:00' },
      catalog,
    );
    expect(state.budgets[1]).toMatchObject({
      month: '2026-12',
      income: euros(2000),
      savingsGoal: euros(300),
      fixedCosts: euros(1112),
      effectiveFrom: '2026-12-01',
    });
    // Semaine 49 : version en vigueur le lundi 30 novembre, comme au scénario 8.
    expect(weekEnvelope('2026-W49', state.budgets, INSTALL)).toBe(13613);
  });

  test('jour 31 ramené au dernier jour des mois plus courts', () => {
    const s0 = createAppState(
      { installDay: '2027-02-01', at: { day: '2027-02-01', time: '08:00' }, budgets: [] },
      catalog,
    );
    const fevrier = { ...chargesFixes, startsOn: '2027-02-01' };
    const s1 = process(
      s0,
      {
        type: 'set_initial_budget',
        id: 'b-1',
        income: euros(2000),
        savingsGoal: euros(300),
        charges: [fevrier],
      },
      { day: '2027-02-01', time: '08:05' },
      catalog,
    ).state;
    const fin: RecurringCharge = {
      id: 'c-31',
      label: 'Assurance',
      amount: euros(20),
      frequency: 'monthly',
      day: 31,
      startsOn: '2027-02-02',
      endsOn: null,
    };
    const { state } = process(
      s1,
      { type: 'revise_fixed_costs', id: 'b-2', charges: [fevrier, fin] },
      { day: '2027-02-02', time: '12:00' },
      catalog,
    );
    // Échéance du 28 février : comptée dans les charges fixes de février.
    expect(state.budgets[1].fixedCosts).toBe(euros(1120));
  });

  test('refusé sans budget, avec une charge invalide, ou si le budget du mois tombe à zéro', () => {
    const now = { day: '2026-11-03', time: '12:00' };
    expect(
      process(
        installe(),
        { type: 'revise_fixed_costs', id: 'b', charges: [abonnement] },
        now,
        catalog,
      ).refusal,
    ).toBe('budget_not_set');
    const s = avecBudgetInitial();
    const invalide = process(
      s,
      {
        type: 'revise_fixed_costs',
        id: 'b',
        charges: [chargesFixes, { ...abonnement, amount: 0 }],
      },
      now,
      catalog,
    );
    expect(invalide.refusal).toBe('invalid_charge');
    expect(invalide.state.budgets).toEqual(s.budgets);
    const trop = process(
      s,
      {
        type: 'revise_fixed_costs',
        id: 'b',
        charges: [chargesFixes, { ...abonnement, amount: euros(600) }],
      },
      now,
      catalog,
    );
    expect(trop.refusal).toBe('invalid_budget');
    expect(trop.state.budgets).toEqual(s.budgets);
  });
});

describe('validité d’une charge récurrente', () => {
  test('libellé non vide, montant entier positif, jour dans les bornes de sa fréquence', () => {
    expect(isValidCharge(abonnement)).toBe(true);
    expect(isValidCharge({ ...abonnement, label: '  ' })).toBe(false);
    expect(isValidCharge({ ...abonnement, amount: 0 })).toBe(false);
    expect(isValidCharge({ ...abonnement, amount: 12.5 })).toBe(false);
    expect(isValidCharge({ ...abonnement, day: 0 })).toBe(false);
    expect(isValidCharge({ ...abonnement, day: 31 })).toBe(true);
    expect(isValidCharge({ ...abonnement, day: 32 })).toBe(false);
    expect(isValidCharge({ ...abonnement, frequency: 'weekly', day: 7 })).toBe(true);
    expect(isValidCharge({ ...abonnement, frequency: 'weekly', day: 8 })).toBe(false);
    expect(isValidCharge({ ...abonnement, startsOn: '2026-11-03', endsOn: '2026-11-03' })).toBe(
      true,
    );
    expect(isValidCharge({ ...abonnement, startsOn: '2026-11-03', endsOn: '2026-11-02' })).toBe(
      false,
    );
  });
});
