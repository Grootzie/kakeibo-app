// Budget du nouveau mois (E7, J3.5) : confirmation du budget pré-rempli après le bilan du mois.
// Contexte commun : installation le lundi 2 novembre 2026, budget de novembre de 600 € par mois
// (2 000 € de revenus, 1 100 € de charges fixes, 300 € d'épargne visée), bilan de novembre
// validé le mardi 1er décembre à 08:00.
import catalogueJson from '../content/catalogue.json';
import { type BudgetVersion, budgetInForce, weekEnvelope } from './budget';
import { type Catalog } from './objets';
import { type LocalDateTime } from './scellement';
import {
  type AppEvent,
  type AppState,
  budgetToConfirm,
  createAppState,
  process,
} from './traitement';

const catalog: Catalog = catalogueJson as Catalog;
const INSTALL = '2026-11-02';
const euros = (n: number): number => Math.round(n * 100);
const at = (day: string, time = '08:00'): LocalDateTime => ({ day, time });

const novembre: BudgetVersion = {
  id: 'b-nov',
  month: '2026-11',
  income: euros(2000),
  fixedCosts: euros(1100),
  savingsGoal: euros(300),
  effectiveFrom: INSTALL,
};

function ok(state: AppState, event: AppEvent, now: LocalDateTime): AppState {
  const r = process(state, event, now, catalog);
  expect(r.refusal).toBeNull();
  return r.state;
}

/** Bilan de novembre validé le 1er décembre à 08:00. */
function apresBilan(budgets: BudgetVersion[] = [novembre]): AppState {
  const s = createAppState({ installDay: INSTALL, at: at(INSTALL), budgets }, catalog);
  return ok(s, { type: 'validate_month', month: '2026-11', resolution: '' }, at('2026-12-01'));
}

const confirmer = (
  montants: { income: number; fixedCosts: number; savingsGoal: number },
  id = 'b-dec',
): AppEvent => ({ type: 'confirm_budget', id, ...montants });

describe('budget en vigueur', () => {
  test('la version du mois déjà effective, sinon la plus récente tous mois confondus', () => {
    const dec: BudgetVersion = {
      ...novembre,
      id: 'b-dec',
      month: '2026-12',
      income: euros(2100),
      effectiveFrom: '2026-12-01',
    };
    expect(budgetInForce('2026-12', [novembre], '2026-12-01')).toEqual(novembre);
    expect(budgetInForce('2026-12', [novembre, dec], '2026-12-01')).toEqual(dec);
    expect(budgetInForce('2026-12', [novembre, dec], '2026-11-30')).toEqual(novembre);
    expect(budgetInForce('2026-12', [], '2026-12-01')).toBeNull();
  });
});

describe('budget à confirmer après le bilan du mois', () => {
  test('pré-rempli avec la version en vigueur, pour le mois en cours', () => {
    expect(budgetToConfirm(apresBilan(), at('2026-12-01'))).toEqual({
      month: '2026-12',
      income: euros(2000),
      fixedCosts: euros(1100),
      savingsGoal: euros(300),
    });
  });

  test('sans aucune version, pré-rempli à zéro', () => {
    expect(budgetToConfirm(apresBilan([]), at('2026-12-01'))).toEqual({
      month: '2026-12',
      income: 0,
      fixedCosts: 0,
      savingsGoal: 0,
    });
  });

  test('rien à confirmer tant que le bilan du mois précédent n’est pas validé', () => {
    const s = createAppState(
      { installDay: INSTALL, at: at(INSTALL), budgets: [novembre] },
      catalog,
    );
    expect(budgetToConfirm(ok(s, { type: 'open' }, at('2026-12-01')), at('2026-12-01'))).toBeNull();
  });

  test('confirmer sans rien changer n’ajoute aucune version', () => {
    const s = ok(
      apresBilan(),
      confirmer({ income: euros(2000), fixedCosts: euros(1100), savingsGoal: euros(300) }),
      at('2026-12-01', '08:01'),
    );
    expect(s.budgets).toEqual([novembre]);
  });

  test('changer un montant ajoute une version pour le nouveau mois, sans modifier l’ancienne', () => {
    const s = ok(
      apresBilan(),
      confirmer({ income: euros(2100), fixedCosts: euros(1100), savingsGoal: euros(300) }),
      at('2026-12-01', '08:01'),
    );
    expect(s.budgets).toEqual([
      novembre,
      {
        id: 'b-dec',
        month: '2026-12',
        income: euros(2100),
        fixedCosts: euros(1100),
        savingsGoal: euros(300),
        effectiveFrom: '2026-12-01',
      },
    ]);
    // Le bilan de novembre reste chiffré avec la version de novembre.
    expect(s.reviews.map((r) => r.month)).toEqual(['2026-11']);
  });

  test('les charges fixes se modifient à la main, en attendant les dépenses récurrentes', () => {
    const s = ok(
      apresBilan(),
      confirmer({ income: euros(2000), fixedCosts: euros(1000), savingsGoal: euros(300) }),
      at('2026-12-01', '08:01'),
    );
    expect(s.budgets[1]).toMatchObject({ month: '2026-12', fixedCosts: euros(1000) });
  });

  test('l’enveloppe suit la nouvelle version à partir de la semaine suivante', () => {
    const s = ok(
      apresBilan(),
      // Budget de décembre : 2 155 € − 1 100 € − 300 € = 755 €, soit 24,35… € par jour.
      confirmer({ income: euros(2155), fixedCosts: euros(1100), savingsGoal: euros(300) }),
      at('2026-12-01', '08:01'),
    );
    // Semaine du 30 novembre : la version en vigueur le lundi 00:00 reste celle de novembre.
    expect(weekEnvelope('2026-W49', s.budgets, INSTALL)).toBe(
      weekEnvelope('2026-W49', [novembre], INSTALL),
    );
    // Semaine du 7 décembre : 7 × 755 € / 31 = 170,48 €.
    expect(weekEnvelope('2026-W50', s.budgets, INSTALL)).toBe(17048);
  });

  test('un budget nul ou négatif est refusé, et rien ne s’ajoute', () => {
    const avant = apresBilan();
    const r = process(
      avant,
      confirmer({ income: euros(1400), fixedCosts: euros(1100), savingsGoal: euros(300) }),
      at('2026-12-01', '08:01'),
      catalog,
    );
    expect(r.refusal).toBe('invalid_budget');
    expect(r.state.budgets).toEqual([novembre]);
  });

  test('un montant négatif ou non entier est refusé', () => {
    for (const montants of [
      { income: euros(2000), fixedCosts: -1, savingsGoal: 0 },
      { income: 200000.5, fixedCosts: 0, savingsGoal: 0 },
    ]) {
      const r = process(apresBilan(), confirmer(montants), at('2026-12-01', '08:01'), catalog);
      expect(r.refusal).toBe('invalid_budget');
    }
  });

  test('refusé tant que le bilan du mois précédent n’est pas validé', () => {
    const s = createAppState(
      { installDay: INSTALL, at: at(INSTALL), budgets: [novembre] },
      catalog,
    );
    const r = process(
      s,
      confirmer({ income: euros(2100), fixedCosts: euros(1100), savingsGoal: euros(300) }),
      at('2026-12-01'),
      catalog,
    );
    expect(r.refusal).toBe('budget_not_open');
    expect(r.state.budgets).toEqual([novembre]);
  });

  test('après plusieurs mois d’absence, le budget confirmé est celui du mois en cours', () => {
    let s = createAppState({ installDay: INSTALL, at: at(INSTALL), budgets: [novembre] }, catalog);
    s = ok(s, { type: 'open' }, at('2027-02-03'));
    expect(s.monthToReview).toBe('2027-01');
    s = ok(s, { type: 'validate_month', month: '2027-01', resolution: '' }, at('2027-02-03'));
    expect(budgetToConfirm(s, at('2027-02-03'))?.month).toBe('2027-02');
    s = ok(
      s,
      confirmer({ income: euros(2100), fixedCosts: euros(1100), savingsGoal: euros(300) }, 'b-fev'),
      at('2027-02-03', '08:05'),
    );
    expect(s.budgets[1]).toMatchObject({ month: '2027-02', effectiveFrom: '2027-02-03' });
  });
});
