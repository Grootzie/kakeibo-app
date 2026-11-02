import { migrate } from './migrations';
import { createRepositories } from './repositories';
import { createTestDb } from './testDb';

describe('dépôts', () => {
  it('sont vides sur une base neuve', async () => {
    const db = createTestDb();
    await migrate(db);
    const repos = createRepositories(db);
    expect(await repos.expenses.all()).toEqual([]);
    expect(await repos.dayClosures.all()).toEqual([]);
    expect(await repos.budgetVersions.all()).toEqual([]);
    expect(await repos.weekResults.all()).toEqual([]);
    expect(await repos.ownedItems.all()).toEqual([]);
    expect(await repos.unlockedRooms.all()).toEqual([]);
    expect(await repos.monthReviews.all()).toEqual([]);
    expect(await repos.recurringCharges.all()).toEqual([]);
    expect(await repos.settings.get()).toBeNull();
  });
});
