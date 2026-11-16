// Dépenses récurrentes dans l'état (J5.1), avec le vrai store, une base en mémoire et l'horloge
// de test : ajouter, modifier et arrêter une charge ajoute une version du budget, qui s'applique
// à l'enveloppe à partir de la semaine suivante ; les échéances ne sont jamais des dépenses.
import catalogueJson from '../content/catalogue.json';
import { migrate } from '../data/migrations';
import { createRepositories } from '../data/repositories';
import { createTestDb } from '../data/testDb';
import type { Catalog } from '../domain/objets';
import { fr } from '../i18n/fr';
import { createClock } from './clock';
import { enveloppeSemaine } from './selecteurs';
import { type DependancesStore, createKakeiboStore } from './store';

const catalogue = catalogueJson as Catalog;
const euros = (n: number): number => Math.round(n * 100);

async function monter(debut = new Date(2026, 10, 2, 8, 0)) {
  const db = createTestDb();
  await migrate(db);
  const repos = createRepositories(db);
  let reel = debut;
  const horloge = createClock({ actif: true, reel: () => reel });
  let n = 0;
  const deps: DependancesStore = {
    depots: async () => repos,
    catalogue,
    horloge,
    nouvelId: () => `id-${++n}`,
  };
  const store = createKakeiboStore(deps);
  const regler = (annee: number, mois: number, jour: number, h = 12, m = 0) => {
    horloge.reinitialiser();
    reel = new Date(annee, mois - 1, jour, h, m);
  };
  const rouvrir = async () => {
    const autre = createKakeiboStore(deps);
    await autre.getState().ouvrir();
    return autre;
  };
  return { store, repos, regler, rouvrir };
}

/** Installation le lundi 2 novembre 2026 et budget de la bienvenue : 2 000 €, 1 100 €, 300 €. */
async function installe() {
  const m = await monter();
  await m.store.getState().ouvrir();
  const refus = await m.store
    .getState()
    .poserBudgetInitial({ income: euros(2000), fixedCosts: euros(1100), savingsGoal: euros(300) });
  expect(refus).toBeNull();
  return m;
}

const enveloppe = (s: ReturnType<typeof createKakeiboStore>) =>
  enveloppeSemaine(s.getState().etat!, s.getState().maintenant!);

describe('budget de la bienvenue (E1)', () => {
  test('les charges fixes saisies deviennent une première charge mensuelle « Charges fixes »', async () => {
    const { store, repos } = await installe();
    const [charge] = await repos.recurringCharges.all();
    expect(charge).toEqual({
      id: expect.any(String),
      label: fr.budget.chargesFixes,
      amount: euros(1100),
      frequency: 'monthly',
      day: 1,
      starts_on: '2026-11-01',
      ends_on: null,
    });
    expect(fr.budget.chargesFixes).toBe('Charges fixes');
    expect(store.getState().charges).toEqual([charge]);
    expect(await repos.budgetVersions.all()).toEqual([
      {
        id: expect.any(String),
        month: '2026-11',
        income: euros(2000),
        fixed_costs: euros(1100),
        savings_goal: euros(300),
        effective_from: '2026-11-02',
      },
    ]);
    expect(enveloppe(store)).toMatchObject({ enveloppe: euros(140), depense: 0 });
  });

  test('sans charges fixes, aucune charge ; une seule fois ; budget du mois supérieur à zéro', async () => {
    const { store, repos } = await monter();
    await store.getState().ouvrir();
    expect(
      await store
        .getState()
        .poserBudgetInitial({ income: euros(300), fixedCosts: 0, savingsGoal: euros(300) }),
    ).toBe('invalid_budget');
    expect(await repos.budgetVersions.all()).toEqual([]);
    expect(
      await store
        .getState()
        .poserBudgetInitial({ income: euros(600), fixedCosts: 0, savingsGoal: 0 }),
    ).toBeNull();
    expect(await repos.recurringCharges.all()).toEqual([]);
    expect(store.getState().charges).toEqual([]);
    expect(
      await store
        .getState()
        .poserBudgetInitial({ income: euros(900), fixedCosts: 0, savingsGoal: 0 }),
    ).toBe('budget_already_set');
    expect(await repos.budgetVersions.all()).toHaveLength(1);
  });
});

describe('dépenses récurrentes', () => {
  test(
    'scénario 23 avec le store : le mardi 3, abonnement de 12 € le 15 ; semaine 45 inchangée, ' +
      'semaine 46 à 137,20 €, l’échéance du 15 n’entre ni dans l’enveloppe ni dans le dépensé',
    async () => {
      const { store, repos, regler, rouvrir } = await installe();
      regler(2026, 11, 3);
      const { id, refusal } = await store
        .getState()
        .ajouterCharge({ label: 'Abonnement', amount: euros(12), frequency: 'monthly', day: 15 });
      expect(refusal).toBeNull();
      expect(await repos.recurringCharges.all()).toContainEqual({
        id,
        label: 'Abonnement',
        amount: euros(12),
        frequency: 'monthly',
        day: 15,
        starts_on: '2026-11-03',
        ends_on: null,
      });
      const versions = await repos.budgetVersions.all();
      expect(versions).toHaveLength(2);
      expect(versions[1]).toMatchObject({
        month: '2026-11',
        fixed_costs: euros(1112),
        effective_from: '2026-11-04',
      });
      expect(enveloppe(store)).toMatchObject({ enveloppe: euros(140), depense: 0 });

      // Le dimanche 15, jour de l'échéance, puis le lendemain : rien n'entre dans le dépensé.
      regler(2026, 11, 15, 21, 0);
      await store.getState().ouvrir();
      expect(enveloppe(store)).toMatchObject({ enveloppe: 13720, depense: 0, reste: 13720 });
      expect(store.getState().depenses).toEqual([]);
      expect(await repos.expenses.all()).toEqual([]);
      regler(2026, 11, 16, 12, 1);
      await store.getState().ouvrir();
      const semaine46 = store.getState().etat!.results.find((r) => r.week === '2026-W46');
      expect(semaine46).toMatchObject({ envelope: 13720, spent: 0 });

      // On retrouve tout à la prochaine ouverture.
      const autre = await rouvrir();
      expect(autre.getState().charges).toEqual(store.getState().charges);
      expect(autre.getState().etat!.budgets).toEqual(store.getState().etat!.budgets);
    },
  );

  test('modifier une charge : la ligne change et une nouvelle version s’ajoute', async () => {
    const { store, repos, regler } = await installe();
    regler(2026, 11, 3);
    const { id } = await store
      .getState()
      .ajouterCharge({ label: 'Abonnement', amount: euros(12), frequency: 'monthly', day: 15 });
    regler(2026, 11, 10);
    expect(
      await store
        .getState()
        .modifierCharge(id, { label: 'Musique', amount: euros(15), frequency: 'monthly', day: 20 }),
    ).toBeNull();
    const ligne = (await repos.recurringCharges.all()).find((c) => c.id === id);
    expect(ligne).toEqual({
      id,
      label: 'Musique',
      amount: euros(15),
      frequency: 'monthly',
      day: 20,
      starts_on: '2026-11-03',
      ends_on: null,
    });
    const versions = await repos.budgetVersions.all();
    expect(versions.map((v) => [v.fixed_costs, v.effective_from])).toEqual([
      [euros(1100), '2026-11-02'],
      [euros(1112), '2026-11-04'],
      [euros(1115), '2026-11-11'],
    ]);
    // Semaine 46 (lundi 9) inchangée : version du 4 novembre.
    expect(enveloppe(store)).toMatchObject({ enveloppe: 13720 });
  });

  test('arrêter une charge : ends_on posé, la ligne et son historique restent', async () => {
    const { store, repos, regler, rouvrir } = await installe();
    regler(2026, 11, 3);
    const { id } = await store
      .getState()
      .ajouterCharge({ label: 'Abonnement', amount: euros(12), frequency: 'monthly', day: 15 });
    regler(2026, 11, 10);
    expect(await store.getState().arreterCharge(id)).toBeNull();
    expect((await repos.recurringCharges.all()).find((c) => c.id === id)).toMatchObject({
      label: 'Abonnement',
      starts_on: '2026-11-03',
      ends_on: '2026-11-10',
    });
    expect((await repos.recurringCharges.all()).length).toBe(2);
    const versions = await repos.budgetVersions.all();
    expect(versions.map((v) => v.fixed_costs)).toEqual([euros(1100), euros(1112), euros(1100)]);
    // Une charge arrêtée ne se modifie ni ne s'arrête à nouveau.
    expect(await store.getState().arreterCharge(id)).toBe('charge_stopped');
    expect(
      await store.getState().modifierCharge(id, {
        label: 'Abonnement',
        amount: euros(9),
        frequency: 'monthly',
        day: 15,
      }),
    ).toBe('charge_stopped');
    expect(await store.getState().arreterCharge('inconnue')).toBe('unknown_charge');
    expect(await repos.budgetVersions.all()).toHaveLength(3);
    const autre = await rouvrir();
    expect(autre.getState().charges.find((c) => c.id === id)?.ends_on).toBe('2026-11-10');
  });

  test('jour 31 ramené au dernier jour des mois plus courts', async () => {
    const { store, repos, regler } = await installe();
    regler(2026, 11, 3);
    await store
      .getState()
      .ajouterCharge({ label: 'Assurance', amount: euros(20), frequency: 'monthly', day: 31 });
    // Novembre n'a que 30 jours : l'échéance du 30 compte dans ses charges fixes.
    expect((await repos.budgetVersions.all())[1].fixed_costs).toBe(euros(1120));
    // Le 3 février 2027, une modification calcule les charges fixes de février : le 28.
    regler(2027, 2, 3);
    const charge = store.getState().charges.find((c) => c.label === 'Assurance')!;
    await store.getState().modifierCharge(charge.id, {
      label: 'Assurance',
      amount: euros(25),
      frequency: 'monthly',
      day: 31,
    });
    const fevrier = (await repos.budgetVersions.all()).at(-1)!;
    expect(fevrier).toMatchObject({ month: '2027-02', fixed_costs: euros(1125) });
  });

  test('refus : charge invalide, budget absent, budget du mois à zéro ; rien ne s’écrit', async () => {
    const { store, repos } = await monter();
    await store.getState().ouvrir();
    const sansBudget = await store
      .getState()
      .ajouterCharge({ label: 'Loyer', amount: euros(500), frequency: 'monthly', day: 5 });
    expect(sansBudget.refusal).toBe('budget_not_set');
    expect(await repos.recurringCharges.all()).toEqual([]);

    await store.getState().poserBudgetInitial({
      income: euros(2000),
      fixedCosts: euros(1100),
      savingsGoal: euros(300),
    });
    const invalide = await store
      .getState()
      .ajouterCharge({ label: ' ', amount: euros(5), frequency: 'weekly', day: 3 });
    expect(invalide.refusal).toBe('invalid_charge');
    const trop = await store
      .getState()
      .ajouterCharge({ label: 'Voiture', amount: euros(600), frequency: 'monthly', day: 5 });
    expect(trop.refusal).toBe('invalid_budget');
    expect(await repos.recurringCharges.all()).toHaveLength(1);
    expect(store.getState().charges).toHaveLength(1);
    expect(await repos.budgetVersions.all()).toHaveLength(1);
  });

  test('hebdomadaire : une échéance par semaine du mois', async () => {
    const { store, repos, regler } = await installe();
    regler(2026, 11, 3);
    await store
      .getState()
      .ajouterCharge({ label: 'Panier', amount: euros(10), frequency: 'weekly', day: 5 });
    // Vendredis 6, 13, 20 et 27 novembre.
    expect((await repos.budgetVersions.all())[1].fixed_costs).toBe(euros(1140));
  });
});
