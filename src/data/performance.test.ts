// « Requêtes en moins de 50 ms avec un an de données (environ 3 000 dépenses) » (spec, Performance).
import { migrate } from './migrations';
import { createRepositories } from './repositories';
import { createTestDb } from './testDb';

const LIMITE_MS = 50;

async function chrono(f: () => Promise<unknown>): Promise<number> {
  await f(); // première passe : préparation des requêtes
  const debut = performance.now();
  await f();
  return performance.now() - debut;
}

describe('performance des dépôts', () => {
  it('répondent en moins de 50 ms avec 3 000 dépenses et un an de clôtures', async () => {
    const db = createTestDb();
    await migrate(db);
    const repos = createRepositories(db);
    await repos.transaction(async () => {
      for (let i = 0; i < 3000; i++) {
        const jour = new Date(Date.UTC(2026, 0, 1 + (i % 365))).toISOString().slice(0, 10);
        await repos.expenses.save({
          id: `e-${i}`,
          day: jour,
          amount: 100 + i,
          category: 'envies',
          note: 'note de test',
          created_at: `${jour}T12:00:00+01:00`,
          updated_at: `${jour}T12:00:00+01:00`,
        });
      }
      for (let i = 0; i < 365; i++) {
        const jour = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
        await repos.dayClosures.add({ day: jour, closed_at: `${jour}T21:00`, kind: 'complete' });
      }
    });

    const mesures = {
      toutesLesDepenses: await chrono(() => repos.expenses.all()),
      depensesDeLaSemaine: await chrono(() => repos.expenses.between('2026-11-02', '2026-11-08')),
      clotures: await chrono(() => repos.dayClosures.all()),
      chargementComplet: await chrono(() =>
        Promise.all([
          repos.settings.get(),
          repos.budgetVersions.all(),
          repos.expenses.all(),
          repos.dayClosures.all(),
          repos.weekResults.all(),
          repos.ownedItems.all(),
          repos.unlockedRooms.all(),
          repos.monthReviews.all(),
        ]),
      ),
    };
    expect(await repos.expenses.all()).toHaveLength(3000);
    for (const [requete, ms] of Object.entries(mesures)) {
      expect({ requete, rapide: ms < LIMITE_MS }).toEqual({ requete, rapide: true });
    }
  });
});
