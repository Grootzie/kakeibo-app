// Modifier ou supprimer une dépense depuis le carnet (J5.4, #103) : le store passe par process,
// écrit dans une seule transaction, met à jour updated_at ; l'enveloppe de l'accueil et le carnet
// suivent, et le résultat d'une semaine scellée reste figé (scénario 15).
import catalogueJson from '../content/catalogue.json';
import { migrate } from '../data/migrations';
import { createRepositories } from '../data/repositories';
import { createTestDb } from '../data/testDb';
import { addDays } from '../domain/calendrier';
import type { Catalog } from '../domain/objets';
import { vueCarnet } from './carnet';
import { createClock } from './clock';
import { enveloppeSemaine, joursModification } from './selecteurs';
import { createKakeiboStore } from './store';

const catalogue = catalogueJson as Catalog;

async function monter() {
  const db = createTestDb();
  await migrate(db);
  const repos = createRepositories(db);
  let reel = new Date(2026, 10, 2, 8, 0);
  const horloge = createClock({ actif: true, reel: () => reel });
  const regler = (jour: string, h = 21, m = 0) => {
    const [a, mo, d] = jour.split('-').map(Number);
    horloge.reinitialiser();
    reel = new Date(a, mo - 1, d, h, m);
  };
  let n = 0;
  const deps = {
    depots: async () => repos,
    catalogue,
    horloge,
    nouvelId: () => `id-${++n}`,
  };
  const premier = createKakeiboStore(deps);
  await premier.getState().ouvrir();
  await repos.budgetVersions.add({
    id: 'b-nov',
    month: '2026-11',
    income: 200000,
    fixed_costs: 110000,
    savings_goal: 30000,
    effective_from: '2026-11-02',
  });
  const store = createKakeiboStore(deps);
  await store.getState().ouvrir();
  return { store, repos, regler };
}

/** Semaine 45 : 120 € le mercredi 4, puis 7 clôtures. Scellée dans le budget (scénario 1). */
async function semaineScellee() {
  const m = await monter();
  m.regler('2026-11-04', 12);
  const { id } = await m.store
    .getState()
    .noterDepense({ day: '2026-11-04', amount: 12000, category: 'essentiel', note: 'courses' });
  for (let j = '2026-11-02'; j <= '2026-11-08'; j = addDays(j, 1)) {
    m.regler(j);
    expect(await m.store.getState().cloturerJour(j)).toBeNull();
  }
  const [fige] = await m.repos.weekResults.all();
  expect(fige).toMatchObject({ week: '2026-W45', spent: 12000, in_budget: 1 });
  return { ...m, id, fige };
}

const carnet = (s: ReturnType<typeof createKakeiboStore>, mois = '2026-11') => {
  const { depenses, etat, maintenant } = s.getState();
  return vueCarnet(depenses, etat!.results, etat!.installDay, maintenant!, mois);
};

describe('modifier une dépense depuis le carnet (#103)', () => {
  test('semaine ouverte : updated_at change, created_at reste, l’enveloppe et le carnet suivent', async () => {
    const { store, repos, regler } = await monter();
    regler('2026-11-03', 12);
    const { id } = await store
      .getState()
      .noterDepense({ day: '2026-11-03', amount: 2000, category: 'envies', note: '' });
    const [avant] = await repos.expenses.all();

    regler('2026-11-04', 9);
    expect(
      await store.getState().enregistrerDepense({
        id,
        day: '2026-11-04',
        amount: 3500,
        category: 'culture',
        note: 'livre',
      }),
    ).toBeNull();
    const [apres] = await repos.expenses.all();
    expect(apres).toEqual({
      id,
      day: '2026-11-04',
      amount: 3500,
      category: 'culture',
      note: 'livre',
      created_at: avant.created_at,
      updated_at: expect.stringMatching(/^2026-11-04T09:00/),
    });
    expect(enveloppeSemaine(store.getState().etat!, store.getState().maintenant!)).toMatchObject({
      depense: 3500,
      reste: 10500,
    });
    const semaine = carnet(store).semaines.find((s) => s.semaine === '2026-W45')!;
    expect(semaine.jours.map((j) => j.jour)).toEqual(['2026-11-04']);
    expect(semaine.totaux.find((t) => t.categorie === 'culture')?.total).toBe(3500);
    expect(semaine.totaux.find((t) => t.categorie === 'envies')?.total).toBe(0);
  });

  test('semaine scellée (scénario 15) : le carnet affiche le nouveau montant, le résultat reste figé', async () => {
    const { store, repos, regler, id, fige } = await semaineScellee();
    regler('2026-11-10', 9);
    expect(
      await store.getState().enregistrerDepense({
        id,
        day: '2026-11-04',
        amount: 20000,
        category: 'essentiel',
        note: 'courses',
      }),
    ).toBeNull();
    expect(await repos.weekResults.all()).toEqual([fige]);
    const semaine = carnet(store).semaines.find((s) => s.semaine === '2026-W45')!;
    expect(semaine.total).toBe(20000);
    expect(semaine.resultat).toMatchObject({ depense: 12000, dansLeBudget: true });
    // Pas de fêlure à retardement.
    expect((await repos.ownedItems.all()).every((o) => o.state === 'intact')).toBe(true);
  });

  test('semaine scellée : la dépense passe dans la semaine ouverte, l’enveloppe en cours suit', async () => {
    const { store, repos, regler, id, fige } = await semaineScellee();
    regler('2026-11-10', 9);
    await store.getState().ouvrir();
    const etat = store.getState().etat!;
    expect(joursModification(etat, store.getState().maintenant!, '2026-11-04')).toEqual([
      '2026-11-10',
      '2026-11-09',
      '2026-11-04',
    ]);
    await store.getState().enregistrerDepense({
      id,
      day: '2026-11-09',
      amount: 12000,
      category: 'essentiel',
      note: 'courses',
    });
    expect(await repos.weekResults.all()).toEqual([fige]);
    expect(enveloppeSemaine(store.getState().etat!, store.getState().maintenant!)).toMatchObject({
      semaine: '2026-W46',
      depense: 12000,
    });
  });

  test('une dépense ne peut pas entrer dans une semaine scellée', async () => {
    const { store, repos, regler } = await semaineScellee();
    regler('2026-11-10', 9);
    const { id } = await store
      .getState()
      .noterDepense({ day: '2026-11-10', amount: 500, category: 'envies', note: '' });
    const avant = await repos.expenses.all();
    expect(
      await store
        .getState()
        .enregistrerDepense({ id, day: '2026-11-05', amount: 500, category: 'envies', note: '' }),
    ).toBe('week_sealed');
    expect(await repos.expenses.all()).toEqual(avant);
  });

  test('si l’écriture échoue, rien ne change, ni en base ni dans l’état', async () => {
    const { store, repos, regler } = await monter();
    regler('2026-11-03', 12);
    const { id } = await store
      .getState()
      .noterDepense({ day: '2026-11-03', amount: 2000, category: 'envies', note: '' });
    const avant = await repos.expenses.all();
    const etatAvant = store.getState().etat;
    const save = repos.expenses.save;
    repos.expenses.save = () => Promise.reject(new Error('disque plein'));
    await expect(
      store
        .getState()
        .enregistrerDepense({ id, day: '2026-11-03', amount: 9900, category: 'envies', note: '' }),
    ).rejects.toThrow('disque plein');
    repos.expenses.save = save;
    expect(await repos.expenses.all()).toEqual(avant);
    expect(store.getState().etat).toEqual(etatAvant);
    expect(store.getState().depenses).toEqual(avant);
  });
});

describe('supprimer une dépense depuis le carnet (#103)', () => {
  test('semaine ouverte : l’enveloppe et le carnet suivent', async () => {
    const { store, repos, regler } = await monter();
    regler('2026-11-03', 12);
    const { id } = await store
      .getState()
      .noterDepense({ day: '2026-11-03', amount: 2000, category: 'envies', note: '' });
    expect(await store.getState().supprimerDepense(id)).toBeNull();
    expect(await repos.expenses.all()).toEqual([]);
    expect(enveloppeSemaine(store.getState().etat!, store.getState().maintenant!)).toMatchObject({
      depense: 0,
      reste: 14000,
    });
    expect(carnet(store).semaines[0].jours).toEqual([]);
  });

  test('semaine scellée : la dépense disparaît du carnet, le résultat reste figé', async () => {
    const { store, repos, regler, id, fige } = await semaineScellee();
    regler('2026-11-10', 9);
    expect(await store.getState().supprimerDepense(id)).toBeNull();
    expect(await repos.expenses.all()).toEqual([]);
    expect(await repos.weekResults.all()).toEqual([fige]);
    const semaine = carnet(store).semaines.find((s) => s.semaine === '2026-W45')!;
    expect(semaine.jours).toEqual([]);
    expect(semaine.resultat).toMatchObject({ depense: 12000 });
  });

  test('si l’écriture échoue, la dépense reste', async () => {
    const { store, repos, regler } = await monter();
    regler('2026-11-03', 12);
    const { id } = await store
      .getState()
      .noterDepense({ day: '2026-11-03', amount: 2000, category: 'envies', note: '' });
    const avant = await repos.expenses.all();
    const remove = repos.expenses.remove;
    repos.expenses.remove = () => Promise.reject(new Error('disque plein'));
    await expect(store.getState().supprimerDepense(id)).rejects.toThrow('disque plein');
    repos.expenses.remove = remove;
    expect(await repos.expenses.all()).toEqual(avant);
    expect(store.getState().depenses).toEqual(avant);
  });
});
