// Rappel du soir dans le store (#47), avec un service de notifications simulé : planification à
// l'ouverture, annulation à la clôture et replanification pour le lendemain, alternance des textes,
// refus de l'autorisation et rappel désactivé.
import catalogueJson from '../content/catalogue.json';
import { migrate } from '../data/migrations';
import { createRepositories } from '../data/repositories';
import { createTestDb } from '../data/testDb';
import type { Catalog } from '../domain/objets';
import { fr } from '../i18n/fr';
import { createClock } from './clock';
import { JOURS_PLANIFIES, type RappelPlanifie, type ServiceRappels } from './rappel';
import { createKakeiboStore } from './store';

const catalogue = catalogueJson as Catalog;

/** Service de notifications simulé : garde ce qui est planifié, comme le téléphone. */
function serviceSimule(options: { autorise?: boolean; accordeSiDemande?: boolean } = {}) {
  let autorise = options.autorise ?? true;
  const s = {
    planifies: [] as RappelPlanifie[],
    remplacements: 0,
    demandes: 0,
    panne: false,
    service: {
      autorise: async () => autorise,
      demanderAutorisation: async () => {
        s.demandes += 1;
        if (options.accordeSiDemande === true) autorise = true;
        return autorise;
      },
      remplacer: async (rappels) => {
        if (s.panne) throw new Error('service indisponible');
        s.remplacements += 1;
        s.planifies = [...rappels];
      },
    } satisfies ServiceRappels,
    retirer: () => {
      autorise = false;
    },
  };
  return s;
}

async function monter(
  options: { rappel?: ReturnType<typeof serviceSimule>; debut?: Date; decalageJours?: number } = {},
) {
  const db = createTestDb();
  await migrate(db);
  const repos = createRepositories(db);
  let reel = options.debut ?? new Date(2026, 10, 5, 9, 0);
  const horloge = createClock({ actif: true, reel: () => reel });
  if (options.decalageJours) horloge.avancerJours(options.decalageJours);
  const rappel = options.rappel ?? serviceSimule();
  let n = 0;
  const store = createKakeiboStore({
    depots: async () => repos,
    catalogue,
    horloge,
    nouvelId: () => `id-${++n}`,
    rappels: rappel.service,
  });
  return {
    store,
    repos,
    rappel,
    regler: (d: Date) => {
      reel = d;
    },
  };
}

const jours = (p: RappelPlanifie[]) => p.map((r) => r.jour);

describe('rappel du soir (#47)', () => {
  test('à l’installation : un rappel aujourd’hui à 21:00, puis un par jour', async () => {
    const { store, repos, rappel } = await monter();
    await store.getState().ouvrir();
    expect(await repos.settings.get()).toMatchObject({
      reminder_time: '21:00',
      reminder_enabled: 1,
    });
    expect(rappel.planifies).toHaveLength(JOURS_PLANIFIES);
    expect(rappel.planifies[0]).toEqual({
      jour: '2026-11-05',
      quand: new Date(2026, 10, 5, 21, 0),
      texte: expect.any(String),
    });
    expect(rappel.planifies[1].quand).toEqual(new Date(2026, 10, 6, 21, 0));
    expect(new Set(jours(rappel.planifies)).size).toBe(JOURS_PLANIFIES);
  });

  test('la clôture annule le rappel du jour et replanifie à partir du lendemain', async () => {
    const { store, rappel } = await monter();
    await store.getState().ouvrir();
    expect(jours(rappel.planifies)).toContain('2026-11-05');
    expect(await store.getState().cloturerJour('2026-11-05')).toBeNull();
    expect(jours(rappel.planifies)).not.toContain('2026-11-05');
    expect(rappel.planifies[0]).toMatchObject({
      jour: '2026-11-06',
      quand: new Date(2026, 10, 6, 21, 0),
    });
    expect(rappel.planifies).toHaveLength(JOURS_PLANIFIES);
  });

  test('ne replanifie pas quand rien ne change (une dépense notée)', async () => {
    const { store, rappel } = await monter();
    await store.getState().ouvrir();
    const avant = rappel.remplacements;
    await store
      .getState()
      .noterDepense({ day: '2026-11-05', amount: 450, category: 'essentiel', note: '' });
    await store.getState().ouvrir();
    expect(rappel.remplacements).toBe(avant);
  });

  test('après l’heure du rappel, la prochaine ouverture planifie à partir du lendemain', async () => {
    const { store, rappel, regler } = await monter();
    await store.getState().ouvrir();
    regler(new Date(2026, 10, 5, 22, 15));
    await store.getState().ouvrir();
    expect(rappel.planifies[0].jour).toBe('2026-11-06');
  });

  test('les trois textes de la spec en alternance, depuis fr.ts', async () => {
    const { store, rappel } = await monter();
    await store.getState().ouvrir();
    const textes = rappel.planifies.map((r) => r.texte);
    expect(new Set(textes)).toEqual(new Set(fr.rappels));
    for (let i = 1; i < textes.length; i++) expect(textes[i]).not.toBe(textes[i - 1]);
  });

  test('l’horloge de test décalée : le rappel tombe à 21:00 de l’heure de l’appli', async () => {
    const { store, rappel } = await monter({ decalageJours: 2 });
    await store.getState().ouvrir();
    // L'appli vit le samedi 7 ; le téléphone, lui, est le jeudi 5 : 21:00 du samedi pour l'appli.
    expect(rappel.planifies[0].jour).toBe('2026-11-07');
    expect(rappel.planifies[0].quand).toEqual(new Date(2026, 10, 5, 21, 0));
  });

  test('autorisation refusée : rien n’est planifié et l’appli fonctionne normalement', async () => {
    const rappel = serviceSimule({ autorise: false });
    const { store } = await monter({ rappel });
    await store.getState().ouvrir();
    expect(rappel.planifies).toEqual([]);
    expect(
      await store
        .getState()
        .noterDepense({ day: '2026-11-05', amount: 450, category: 'essentiel', note: '' }),
    ).toMatchObject({ refusal: null });
    expect(await store.getState().cloturerJour('2026-11-05')).toBeNull();
    expect(rappel.planifies).toEqual([]);
    expect(store.getState().etat?.closedDays).toContain('2026-11-05');
  });

  test('autorisation retirée dans les réglages du téléphone : tout est annulé', async () => {
    const { store, rappel } = await monter();
    await store.getState().ouvrir();
    expect(rappel.planifies).not.toEqual([]);
    rappel.retirer();
    await store.getState().ouvrir();
    expect(rappel.planifies).toEqual([]);
  });

  test('reminder_enabled faux : rien n’est planifié', async () => {
    const { store, repos, rappel } = await monter();
    await store.getState().ouvrir();
    const settings = await repos.settings.get();
    if (settings === null) throw new Error('installation attendue');
    await repos.settings.save({ ...settings, reminder_enabled: 0 });
    const autre = createKakeiboStore({
      depots: async () => repos,
      catalogue,
      horloge: createClock({ actif: true, reel: () => new Date(2026, 10, 5, 10, 0) }),
      nouvelId: () => 'x',
      rappels: rappel.service,
    });
    await autre.getState().ouvrir();
    expect(rappel.planifies).toEqual([]);
  });

  test('reminder_time : le rappel tombe à l’heure choisie', async () => {
    const { store, repos, rappel } = await monter();
    await store.getState().ouvrir();
    const settings = await repos.settings.get();
    if (settings === null) throw new Error('installation attendue');
    await repos.settings.save({ ...settings, reminder_time: '19:45' });
    const autre = createKakeiboStore({
      depots: async () => repos,
      catalogue,
      horloge: createClock({ actif: true, reel: () => new Date(2026, 10, 5, 10, 0) }),
      nouvelId: () => 'x',
      rappels: rappel.service,
    });
    await autre.getState().ouvrir();
    expect(rappel.planifies[0].quand).toEqual(new Date(2026, 10, 5, 19, 45));
  });

  test('demander l’autorisation : accordée, les rappels sont planifiés', async () => {
    const rappel = serviceSimule({ autorise: false, accordeSiDemande: true });
    const { store } = await monter({ rappel });
    await store.getState().ouvrir();
    expect(rappel.planifies).toEqual([]);
    expect(await store.getState().demanderAutorisationRappel()).toBe(true);
    expect(rappel.demandes).toBe(1);
    expect(rappel.planifies[0].jour).toBe('2026-11-05');
  });

  test('demander l’autorisation : refusée, rien n’est planifié', async () => {
    const rappel = serviceSimule({ autorise: false });
    const { store } = await monter({ rappel });
    expect(await store.getState().demanderAutorisationRappel()).toBe(false);
    expect(rappel.planifies).toEqual([]);
    expect(store.getState().pret).toBe(true);
  });

  test('un service de notifications en panne n’empêche ni l’ouverture ni la clôture', async () => {
    const avertir = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const rappel = serviceSimule();
    rappel.panne = true;
    const { store } = await monter({ rappel });
    await store.getState().ouvrir();
    expect(store.getState().pret).toBe(true);
    expect(await store.getState().cloturerJour('2026-11-05')).toBeNull();
    // Le service revenu, la prochaine ouverture replanifie.
    rappel.panne = false;
    await store.getState().ouvrir();
    expect(rappel.planifies[0].jour).toBe('2026-11-06');
    avertir.mockRestore();
  });

  test('sans service de notifications (tests, web) : rien ne change', async () => {
    const db = createTestDb();
    await migrate(db);
    const store = createKakeiboStore({
      depots: async () => createRepositories(db),
      catalogue,
      horloge: createClock({ actif: true, reel: () => new Date(2026, 10, 5, 9, 0) }),
      nouvelId: () => 'x',
    });
    await store.getState().ouvrir();
    expect(await store.getState().demanderAutorisationRappel()).toBe(false);
    expect(await store.getState().cloturerJour('2026-11-05')).toBeNull();
  });
});
