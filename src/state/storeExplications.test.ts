// Cartes de première fois (#48) dans le store : settings.seen_explanations se charge, une carte
// marquée vue s'enregistre, et reste vue après redémarrage.
import catalogueJson from '../content/catalogue.json';
import { migrate } from '../data/migrations';
import { createRepositories } from '../data/repositories';
import { createTestDb } from '../data/testDb';
import type { Catalog } from '../domain/objets';
import { createClock } from './clock';
import { explicationAAfficher } from './explications';
import { type DependancesStore, createKakeiboStore } from './store';

async function monter() {
  const db = createTestDb();
  await migrate(db);
  const repos = createRepositories(db);
  const reel = new Date(2026, 10, 2, 12, 0);
  let n = 0;
  const deps: DependancesStore = {
    depots: async () => repos,
    catalogue: catalogueJson as Catalog,
    horloge: createClock({ actif: true, reel: () => reel }),
    nouvelId: () => `id-${++n}`,
  };
  const rouvrir = async () => {
    const autre = createKakeiboStore(deps);
    await autre.getState().ouvrir();
    return autre;
  };
  return { repos, rouvrir };
}

describe('cartes vues, dans le store', () => {
  test('aucune carte vue à l’installation', async () => {
    const { repos, rouvrir } = await monter();
    const store = await rouvrir();
    expect(store.getState().explicationsVues).toEqual([]);
    expect((await repos.settings.get())?.seen_explanations).toBe('[]');
  });

  test('une carte marquée vue s’enregistre, une seule fois', async () => {
    const { repos, rouvrir } = await monter();
    const store = await rouvrir();
    await store.getState().marquerExplicationVue('first_expense');
    await store.getState().marquerExplicationVue('first_expense');
    await store.getState().marquerExplicationVue('first_stamp');
    expect(store.getState().explicationsVues).toEqual(['first_expense', 'first_stamp']);
    expect((await repos.settings.get())?.seen_explanations).toBe('["first_expense","first_stamp"]');
  });

  test('après redémarrage, une carte vue ne revient jamais', async () => {
    const { rouvrir } = await monter();
    const store = await rouvrir();
    await store
      .getState()
      .noterDepense({ day: '2026-11-02', amount: 500, category: 'envies', note: '' });
    const { etat, maintenant } = store.getState();
    expect(explicationAAfficher(etat!, maintenant!, store.getState().explicationsVues)).toBe(
      'first_expense',
    );
    await store.getState().marquerExplicationVue('first_expense');

    const apres = await rouvrir();
    const s = apres.getState();
    expect(s.explicationsVues).toEqual(['first_expense']);
    expect(explicationAAfficher(s.etat!, s.maintenant!, s.explicationsVues)).toBeNull();
  });

  test('marquer une carte ne change ni les autres réglages ni l’état', async () => {
    const { repos, rouvrir } = await monter();
    const store = await rouvrir();
    const avant = await repos.settings.get();
    const etat = store.getState().etat;
    await store.getState().marquerExplicationVue('first_catch_up');
    expect(await repos.settings.get()).toEqual({
      ...avant,
      seen_explanations: '["first_catch_up"]',
    });
    expect(store.getState().etat).toBe(etat);
  });
});
