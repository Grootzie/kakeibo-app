// Réglages (E10, J5.6) dans le store, avec une base en mémoire et l'horloge de test : changer ses
// revenus et son épargne ajoute une version du budget (enveloppe changée la semaine suivante),
// l'autorisation des notifications se lit sans être demandée, et « Tout effacer » vide la base
// puis ramène à la bienvenue (E1).
import catalogueJson from '../content/catalogue.json';
import { migrate } from '../data/migrations';
import { createRepositories } from '../data/repositories';
import { createTestDb } from '../data/testDb';
import type { Catalog } from '../domain/objets';
import { bienvenueAAfficher } from './bienvenue';
import { createClock } from './clock';
import type { RappelPlanifie, ServiceRappels } from './rappel';
import { enveloppeSemaine } from './selecteurs';
import { type DependancesStore, createKakeiboStore } from './store';

const catalogue = catalogueJson as Catalog;
const euros = (n: number): number => Math.round(n * 100);

function serviceSimule(autorise: boolean) {
  const s = {
    planifies: [] as RappelPlanifie[],
    remplacements: 0,
    service: {
      autorise: async () => autorise,
      demanderAutorisation: async () => autorise,
      remplacer: async (rappels) => {
        s.remplacements += 1;
        s.planifies = [...rappels];
      },
    } satisfies ServiceRappels,
  };
  return s;
}

/** Installation le lundi 2 novembre 2026 à 8:00, budget de la bienvenue : 2 000, 1 100, 300 €. */
async function installe(options: { rappels?: ServiceRappels } = {}) {
  const db = createTestDb();
  await migrate(db);
  const repos = createRepositories(db);
  let reel = new Date(2026, 10, 2, 8, 0);
  const horloge = createClock({ actif: true, reel: () => reel });
  let n = 0;
  const deps: DependancesStore = {
    depots: async () => repos,
    catalogue,
    horloge,
    nouvelId: () => `id-${++n}`,
    rappels: options.rappels,
  };
  const store = createKakeiboStore(deps);
  await store.getState().ouvrir();
  expect(
    await store.getState().terminerBienvenue({
      budget: { income: euros(2000), fixedCosts: euros(1100), savingsGoal: euros(300) },
      heureRappel: '20:30',
    }),
  ).toBeNull();
  const regler = (annee: number, mois: number, jour: number, h = 12, m = 0) => {
    horloge.reinitialiser();
    reel = new Date(annee, mois - 1, jour, h, m);
  };
  const rouvrir = async () => {
    const autre = createKakeiboStore(deps);
    await autre.getState().ouvrir();
    return autre;
  };
  return { store, repos, db, regler, rouvrir };
}

const enveloppe = (s: ReturnType<typeof createKakeiboStore>) =>
  enveloppeSemaine(s.getState().etat!, s.getState().maintenant!).enveloppe;

describe('revenus et épargne (E10)', () => {
  test('une nouvelle version : l’enveloppe change la semaine suivante, et survit au redémarrage', async () => {
    const { store, repos, regler, rouvrir } = await installe();
    regler(2026, 11, 4);
    expect(
      await store.getState().reviserBudget({ income: euros(2100), savingsGoal: euros(200) }),
    ).toBeNull();
    const versions = await repos.budgetVersions.all();
    expect(versions).toHaveLength(2);
    expect(versions[1]).toEqual({
      id: expect.any(String),
      month: '2026-11',
      income: euros(2100),
      fixed_costs: euros(1100),
      savings_goal: euros(200),
      effective_from: '2026-11-05',
    });
    expect(enveloppe(store)).toBe(euros(140));
    regler(2026, 11, 9);
    const apres = await rouvrir();
    expect(enveloppe(apres)).toBe(18667);
  });

  test('les charges fixes viennent des dépenses récurrentes en cours', async () => {
    const { store, repos, regler } = await installe();
    regler(2026, 11, 3);
    const { refusal } = await store
      .getState()
      .ajouterCharge({ label: 'Abonnement', amount: euros(12), frequency: 'monthly', day: 15 });
    expect(refusal).toBeNull();
    regler(2026, 11, 4);
    expect(
      await store.getState().reviserBudget({ income: euros(2100), savingsGoal: euros(300) }),
    ).toBeNull();
    const versions = await repos.budgetVersions.all();
    expect(versions[versions.length - 1]).toMatchObject({
      income: euros(2100),
      fixed_costs: euros(1112),
      savings_goal: euros(300),
    });
  });

  test('un budget nul ou un montant invalide est refusé, et rien ne s’écrit', async () => {
    const { store, repos } = await installe();
    expect(
      await store.getState().reviserBudget({ income: euros(1400), savingsGoal: euros(300) }),
    ).toBe('invalid_budget');
    expect(await store.getState().reviserBudget({ income: -1, savingsGoal: 0 })).toBe(
      'invalid_budget',
    );
    expect(await repos.budgetVersions.all()).toHaveLength(1);
  });
});

describe('autorisation du rappel (E10)', () => {
  test('se lit sans être demandée', async () => {
    const refuse = await installe({ rappels: serviceSimule(false).service });
    expect(await refuse.store.getState().autorisationRappel()).toBe(false);
    const accorde = await installe({ rappels: serviceSimule(true).service });
    expect(await accorde.store.getState().autorisationRappel()).toBe(true);
  });

  test('sans service de notifications (web), elle n’est pas accordée', async () => {
    const { store } = await installe();
    expect(await store.getState().autorisationRappel()).toBe(false);
  });
});

describe('tout effacer (E10)', () => {
  test('vide la base, puis l’appli repart à la bienvenue, installée le jour même', async () => {
    const rappel = serviceSimule(true);
    const { store, repos, db, regler, rouvrir } = await installe({ rappels: rappel.service });
    await store
      .getState()
      .noterDepense({ day: '2026-11-02', amount: euros(12), category: 'envies', note: '' });
    expect(await store.getState().cloturerJour('2026-11-02')).toBeNull();
    await store.getState().marquerExplicationVue('first_expense');
    regler(2026, 11, 10, 9, 0);
    await store.getState().ouvrir();
    expect(store.getState().etat?.results).toHaveLength(1);

    await store.getState().toutEffacer();

    for (const table of ['expense', 'day_closure', 'week_result', 'month_review']) {
      const n = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
      expect({ table, n: n?.n }).toEqual({ table, n: 0 });
    }
    expect(await repos.budgetVersions.all()).toEqual([]);
    expect(await repos.recurringCharges.all()).toEqual([]);
    expect(await repos.settings.get()).toMatchObject({
      install_day: '2026-11-10',
      reminder_time: '21:00',
      reminder_enabled: 1,
      seen_explanations: '[]',
    });
    const s = store.getState();
    expect(bienvenueAAfficher(s)).toBe(true);
    expect(s.etat?.installDay).toBe('2026-11-10');
    expect(s.etat?.results).toEqual([]);
    expect(s.depenses).toEqual([]);
    expect(s.clotures).toEqual([]);
    expect(s.charges).toEqual([]);
    expect(s.explicationsVues).toEqual([]);
    expect(s.reglagesRappel).toEqual({ reminderTime: '21:00', reminderEnabled: true });
    // Les rappels sont replanifiés depuis la nouvelle installation, à l'heure par défaut.
    expect(rappel.planifies[0]).toMatchObject({
      jour: '2026-11-10',
      quand: new Date(2026, 10, 10, 21, 0),
    });
    // Et rien ne revient au redémarrage.
    const apres = await rouvrir();
    expect(bienvenueAAfficher(apres.getState())).toBe(true);
    expect(apres.getState().depenses).toEqual([]);
  });

  test('la bienvenue passée par le réglage caché est oubliée : elle s’affiche de nouveau', async () => {
    const { store } = await installe();
    expect(store.getState().passerBienvenue()).toBe(true);
    await store.getState().toutEffacer();
    expect(store.getState().bienvenuePassee).toBe(false);
    expect(bienvenueAAfficher(store.getState())).toBe(true);
  });

  test('après l’effacement, la bienvenue pose un nouveau budget', async () => {
    const { store, repos } = await installe();
    await store.getState().toutEffacer();
    expect(
      await store.getState().terminerBienvenue({
        budget: { income: euros(1500), fixedCosts: euros(800), savingsGoal: 0 },
        heureRappel: '21:00',
      }),
    ).toBeNull();
    expect(await repos.budgetVersions.all()).toHaveLength(1);
    expect(bienvenueAAfficher(store.getState())).toBe(false);
  });
});
