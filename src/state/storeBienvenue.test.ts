// Fin de la bienvenue (E1, #101) avec le vrai store, une base en mémoire et un service de
// notifications simulé : première version du budget, charge « Charges fixes », réglages du
// rappel, demande d'autorisation (un refus n'empêche rien), et E1 qui ne revient plus.
import catalogueJson from '../content/catalogue.json';
import { migrate } from '../data/migrations';
import { createRepositories } from '../data/repositories';
import { createTestDb } from '../data/testDb';
import type { Catalog } from '../domain/objets';
import { fr } from '../i18n/fr';
import { apercuBudget, bienvenueAAfficher as aAfficher } from './bienvenue';
import { createClock } from './clock';
import type { RappelPlanifie, ServiceRappels } from './rappel';
import { enveloppeSemaine } from './selecteurs';
import { type DependancesStore, createKakeiboStore } from './store';

const catalogue = catalogueJson as Catalog;
const euros = (n: number): number => Math.round(n * 100);
const BUDGET = { income: euros(2000), fixedCosts: euros(1100), savingsGoal: euros(300) };

function serviceSimule(accorde: boolean) {
  let autorise = false;
  const s = {
    demandes: 0,
    planifies: [] as RappelPlanifie[],
    service: {
      autorise: async () => autorise,
      demanderAutorisation: async () => {
        s.demandes += 1;
        autorise = accorde;
        return autorise;
      },
      remplacer: async (rappels) => {
        s.planifies = [...rappels];
      },
    } satisfies ServiceRappels,
  };
  return s;
}

async function monter(options: { accorde?: boolean; horlogeActive?: boolean } = {}) {
  const db = createTestDb();
  await migrate(db);
  const repos = createRepositories(db);
  const reel = new Date(2026, 10, 4, 9, 0);
  const horloge = createClock({ actif: options.horlogeActive ?? true, reel: () => reel });
  const rappel = serviceSimule(options.accorde ?? true);
  let n = 0;
  const deps: DependancesStore = {
    depots: async () => repos,
    catalogue,
    horloge,
    nouvelId: () => `id-${++n}`,
    rappels: rappel.service,
  };
  const store = createKakeiboStore(deps);
  const rouvrir = async () => {
    const autre = createKakeiboStore(deps);
    await autre.getState().ouvrir();
    return autre;
  };
  return { store, repos, rappel, rouvrir };
}

const bienvenueAAfficher = (store: ReturnType<typeof createKakeiboStore>): boolean =>
  aAfficher(store.getState());

describe('bienvenue (E1) dans le store', () => {
  test('à la première ouverture, la bienvenue est à faire', async () => {
    const { store, repos } = await monter();
    await store.getState().ouvrir();
    expect(bienvenueAAfficher(store)).toBe(true);
    expect((await repos.settings.get())?.install_day).toBe('2026-11-04');
  });

  test('terminer pose le budget, la charge « Charges fixes », le rappel, puis demande l’autorisation', async () => {
    const { store, repos, rappel } = await monter();
    await store.getState().ouvrir();
    const refus = await store
      .getState()
      .terminerBienvenue({ budget: BUDGET, heureRappel: '20:30' });
    expect(refus).toBeNull();

    const [version] = await repos.budgetVersions.all();
    expect(version).toMatchObject({
      month: '2026-11',
      income: euros(2000),
      fixed_costs: euros(1100),
      savings_goal: euros(300),
      effective_from: '2026-11-02',
    });
    const charges = await repos.recurringCharges.all();
    expect(charges).toHaveLength(1);
    expect(charges[0]).toMatchObject({
      label: fr.budget.chargesFixes,
      amount: euros(1100),
      frequency: 'monthly',
    });
    const settings = await repos.settings.get();
    expect(settings).toMatchObject({ reminder_time: '20:30', reminder_enabled: 1 });
    expect(store.getState().reglagesRappel).toEqual({
      reminderTime: '20:30',
      reminderEnabled: true,
    });
    expect(rappel.demandes).toBe(1);
    // Autorisation accordée : le rappel du soir est planifié à l'heure choisie.
    expect(rappel.planifies[0]?.quand.getHours()).toBe(20);
    expect(rappel.planifies[0]?.quand.getMinutes()).toBe(30);
    expect(bienvenueAAfficher(store)).toBe(false);
  });

  test('l’enveloppe de l’accueil est celle que l’étape « Mon mois » annonçait', async () => {
    const { store } = await monter();
    await store.getState().ouvrir();
    const annonce = apercuBudget(BUDGET, '2026-11-04', '2026-11-04');
    await store.getState().terminerBienvenue({ budget: BUDGET, heureRappel: '21:00' });
    const s = store.getState();
    expect(enveloppeSemaine(s.etat!, s.maintenant!).enveloppe).toBe(annonce.enveloppeSemaine);
    expect(annonce.enveloppeSemaine).toBe(euros(100));
  });

  test('un refus des notifications n’empêche rien : budget posé, aucun rappel planifié', async () => {
    const { store, repos, rappel } = await monter({ accorde: false });
    await store.getState().ouvrir();
    const refus = await store
      .getState()
      .terminerBienvenue({ budget: BUDGET, heureRappel: '21:00' });
    expect(refus).toBeNull();
    expect(rappel.demandes).toBe(1);
    expect(rappel.planifies).toEqual([]);
    expect(await repos.budgetVersions.all()).toHaveLength(1);
    expect(bienvenueAAfficher(store)).toBe(false);
  });

  test('un budget nul est refusé : rien n’est posé, pas de demande d’autorisation', async () => {
    const { store, repos, rappel } = await monter();
    await store.getState().ouvrir();
    const refus = await store.getState().terminerBienvenue({
      budget: { income: euros(1000), fixedCosts: euros(700), savingsGoal: euros(300) },
      heureRappel: '21:00',
    });
    expect(refus).toBe('invalid_budget');
    expect(await repos.budgetVersions.all()).toEqual([]);
    expect(await repos.recurringCharges.all()).toEqual([]);
    expect(rappel.demandes).toBe(0);
    expect(bienvenueAAfficher(store)).toBe(true);
  });

  test('une heure de rappel illisible est refusée avant toute écriture', async () => {
    const { store, repos } = await monter();
    await store.getState().ouvrir();
    const refus = await store
      .getState()
      .terminerBienvenue({ budget: BUDGET, heureRappel: '25:00' });
    expect(refus).toBe('invalid_reminder_time');
    expect(await repos.budgetVersions.all()).toEqual([]);
  });

  test('E1 ne s’affiche qu’à la première ouverture : après redémarrage, plus de bienvenue', async () => {
    const { store, rouvrir } = await monter();
    await store.getState().ouvrir();
    await store.getState().terminerBienvenue({ budget: BUDGET, heureRappel: '21:00' });
    const autre = await rouvrir();
    expect(bienvenueAAfficher(autre)).toBe(false);
    expect(autre.getState().reglagesRappel?.reminderTime).toBe('21:00');
  });

  test('quittée avant la fin, la bienvenue reprend à la prochaine ouverture', async () => {
    const { store, rouvrir } = await monter();
    await store.getState().ouvrir();
    const autre = await rouvrir();
    expect(bienvenueAAfficher(autre)).toBe(true);
  });

  test('le budget de démonstration reste disponible et vaut la bienvenue faite', async () => {
    const { store } = await monter();
    await store.getState().ouvrir();
    expect(await store.getState().poserBudgetDemo()).toBe(true);
    expect(bienvenueAAfficher(store)).toBe(false);
  });

  test('« Passer la bienvenue » des builds de développement : l’accueil, sans budget', async () => {
    const { store, repos } = await monter();
    await store.getState().ouvrir();
    expect(store.getState().passerBienvenue()).toBe(true);
    expect(bienvenueAAfficher(store)).toBe(false);
    expect(await repos.budgetVersions.all()).toEqual([]);
  });

  test('« Passer la bienvenue » n’existe pas sans l’horloge de test', async () => {
    const { store } = await monter({ horlogeActive: false });
    await store.getState().ouvrir();
    expect(store.getState().passerBienvenue()).toBe(false);
    expect(bienvenueAAfficher(store)).toBe(true);
  });
});
