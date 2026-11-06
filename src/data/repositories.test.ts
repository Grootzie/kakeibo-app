import type { Db } from './db';
import { migrate } from './migrations';
import {
  type BudgetVersionRow,
  type DayClosureRow,
  type ExpenseRow,
  type OwnedItemRow,
  type SettingsRow,
  type WeekResultRow,
  createRepositories,
} from './repositories';
import { createTestDb } from './testDb';

async function depots() {
  const db = createTestDb();
  await migrate(db);
  return { db, repos: createRepositories(db) };
}

/** Enregistre chaque instruction SQL passée à la base. */
function espionne(db: Db): { db: Db; sql: string[] } {
  const sql: string[] = [];
  return {
    sql,
    db: {
      execAsync: (q) => {
        sql.push(q);
        return db.execAsync(q);
      },
      getFirstAsync: (q, p) => db.getFirstAsync(q, p),
      getAllAsync: (q, p) => db.getAllAsync(q, p),
      runAsync: (q, p) => {
        sql.push(q);
        return db.runAsync(q, p);
      },
    },
  };
}

const settings: SettingsRow = {
  id: 1,
  install_id: 'inst-1',
  install_day: '2026-11-02',
  reminder_time: '21:00',
  reminder_enabled: 1,
  trial_start: null,
  plan: 'trial',
  seen_explanations: '[]',
  schema_version: 2,
};

const budget: BudgetVersionRow = {
  id: 'b-1',
  month: '2026-11',
  income: 200000,
  fixed_costs: 110000,
  savings_goal: 30000,
  effective_from: '2026-11-02',
};

const depense = (id: string, day: string, amount = 1250): ExpenseRow => ({
  id,
  day,
  amount,
  category: 'essentiel',
  note: '',
  created_at: `${day}T12:00:00+01:00`,
  updated_at: `${day}T12:00:00+01:00`,
});

const cloture: DayClosureRow = {
  day: '2026-11-02',
  closed_at: '2026-11-02T21:00:00+01:00',
  kind: 'complete',
};

const resultat: WeekResultRow = {
  week: '2026-W45',
  sealed_at: '2026-11-08T21:00',
  counted_days: 7,
  stamps: 7,
  envelope: 14000,
  spent: 12000,
  in_budget: 1,
  complete: 1,
  gashapon_item: 'room-11-w1',
  cracked_item: null,
  ceremony_seen: 0,
};

const objet: OwnedItemRow = {
  year: 2026,
  item_id: 'room-11-b1',
  acquired_at: '2026-11-02T08:00',
  week: null,
  source: 'base',
  placed_at: '2026-11-02T08:00',
  state: 'intact',
  cracked_at: null,
  cracked_week: null,
  repaired_at: null,
};

describe('dépôts', () => {
  it('sont vides sur une base neuve', async () => {
    const { repos } = await depots();
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

  describe('settings', () => {
    it('écrit puis relit l’unique ligne, et la met à jour', async () => {
      const { repos } = await depots();
      await repos.settings.save(settings);
      expect(await repos.settings.get()).toEqual(settings);
      await repos.settings.save({ ...settings, reminder_time: '20:30' });
      expect(await repos.settings.get()).toEqual({ ...settings, reminder_time: '20:30' });
    });
  });

  describe('expense', () => {
    it('ajoute, modifie et supprime une dépense', async () => {
      const { repos } = await depots();
      await repos.expenses.save(depense('a', '2026-11-03'));
      await repos.expenses.save(depense('b', '2026-11-04'));
      await repos.expenses.save({ ...depense('a', '2026-11-03', 990), note: 'pain' });
      expect(await repos.expenses.all()).toEqual([
        { ...depense('a', '2026-11-03', 990), note: 'pain' },
        depense('b', '2026-11-04'),
      ]);
      await repos.expenses.remove('a');
      expect(await repos.expenses.all()).toEqual([depense('b', '2026-11-04')]);
    });

    it('lit les dépenses d’une période, jours inclus, dans l’ordre des jours', async () => {
      const { repos } = await depots();
      for (const [id, day] of [
        ['c', '2026-11-09'],
        ['a', '2026-11-02'],
        ['b', '2026-11-08'],
        ['z', '2026-11-01'],
      ]) {
        await repos.expenses.save(depense(id, day));
      }
      const semaine = await repos.expenses.between('2026-11-02', '2026-11-08');
      expect(semaine.map((e) => e.id)).toEqual(['a', 'b']);
    });
  });

  describe('day_closure', () => {
    it('ajoute et relit une clôture', async () => {
      const { repos } = await depots();
      await repos.dayClosures.add(cloture);
      expect(await repos.dayClosures.all()).toEqual([cloture]);
    });

    it('ne se supprime jamais et ne se modifie jamais, même en SQL direct', async () => {
      const { db, repos } = await depots();
      await repos.dayClosures.add(cloture);
      expect('remove' in repos.dayClosures).toBe(false);
      await expect(db.runAsync('DELETE FROM day_closure')).rejects.toThrow();
      await expect(db.runAsync("UPDATE day_closure SET kind = 'no_spend'")).rejects.toThrow();
      await expect(repos.dayClosures.add({ ...cloture, kind: 'no_spend' })).rejects.toThrow();
      expect(await repos.dayClosures.all()).toEqual([cloture]);
    });
  });

  describe('budget_version', () => {
    it('ajoute une version sans écraser la précédente', async () => {
      const { repos } = await depots();
      await repos.budgetVersions.add(budget);
      const v2 = { ...budget, id: 'b-2', fixed_costs: 111200, effective_from: '2026-11-03' };
      await repos.budgetVersions.add(v2);
      expect(await repos.budgetVersions.all()).toEqual([budget, v2]);
    });

    it('ne s’écrase jamais : ni même identifiant, ni modification, ni suppression', async () => {
      const { db, repos } = await depots();
      await repos.budgetVersions.add(budget);
      expect('save' in repos.budgetVersions).toBe(false);
      await expect(repos.budgetVersions.add({ ...budget, income: 1 })).rejects.toThrow();
      await expect(db.runAsync('UPDATE budget_version SET income = 1')).rejects.toThrow();
      await expect(db.runAsync('DELETE FROM budget_version')).rejects.toThrow();
      expect(await repos.budgetVersions.all()).toEqual([budget]);
    });
  });

  describe('résultats, objets, pièces et bilans', () => {
    it('écrivent et relisent un résultat de semaine, puis marquent son bilan vu', async () => {
      const { repos } = await depots();
      await repos.weekResults.add(resultat);
      await repos.weekResults.markCeremonySeen(['2026-W45']);
      expect(await repos.weekResults.all()).toEqual([{ ...resultat, ceremony_seen: 1 }]);
      await expect(repos.weekResults.add(resultat)).rejects.toThrow();
    });

    it('enregistrent un objet puis son changement d’état, sans perdre sa réparation', async () => {
      const { repos } = await depots();
      await repos.ownedItems.save(objet);
      const repare = { ...objet, state: 'repaired' as const, repaired_at: '2026-11-15' };
      await repos.ownedItems.save(repare);
      await repos.ownedItems.save({ ...repare, repaired_at: null });
      expect(await repos.ownedItems.all()).toEqual([repare]);
    });

    it('enregistrent une pièce débloquée et un bilan du mois', async () => {
      const { repos } = await depots();
      const piece = { year: 2026, room_id: 'room-11', unlocked_at: '2026-11-02T08:00' };
      await repos.unlockedRooms.add(piece);
      const bilan = {
        month: '2026-11',
        completed_at: '2026-12-01T09:00',
        q1: '90000',
        q2: '30000',
        q3: '52000',
        real_savings: 38000,
        resolution: 'Moins de cafés',
      };
      await repos.monthReviews.add(bilan);
      expect(await repos.unlockedRooms.all()).toEqual([piece]);
      expect(await repos.monthReviews.all()).toEqual([bilan]);
    });
  });

  describe('transactions', () => {
    it('chaque écriture passe dans une transaction', async () => {
      const base = createTestDb();
      await migrate(base);
      const { db, sql } = espionne(base);
      const repos = createRepositories(db);
      const ecritures: [string, () => Promise<void>][] = [
        ['settings', () => repos.settings.save(settings)],
        ['expense', () => repos.expenses.save(depense('a', '2026-11-03'))],
        ['expense', () => repos.expenses.remove('a')],
        ['day_closure', () => repos.dayClosures.add(cloture)],
        ['budget_version', () => repos.budgetVersions.add(budget)],
        ['week_result', () => repos.weekResults.add(resultat)],
        ['week_result', () => repos.weekResults.markCeremonySeen(['2026-W45'])],
        ['owned_item', () => repos.ownedItems.save(objet)],
      ];
      for (const [table, ecrire] of ecritures) {
        sql.length = 0;
        await ecrire();
        expect({ table, debut: sql[0] }).toEqual({
          table,
          debut: expect.stringMatching(/^SAVEPOINT/),
        });
        expect({ table, fin: sql[sql.length - 1] }).toEqual({
          table,
          fin: expect.stringMatching(/^RELEASE/),
        });
      }
    });

    it('annulent tout ce qui a été écrit si une écriture échoue', async () => {
      const { repos } = await depots();
      await expect(
        repos.transaction(async () => {
          await repos.expenses.save(depense('a', '2026-11-03'));
          await repos.dayClosures.add(cloture);
          await repos.dayClosures.add(cloture); // déjà clôturé : échoue
        }),
      ).rejects.toThrow();
      expect(await repos.expenses.all()).toEqual([]);
      expect(await repos.dayClosures.all()).toEqual([]);
    });

    it('valident tout ensemble quand tout réussit', async () => {
      const { repos } = await depots();
      await repos.transaction(async () => {
        await repos.expenses.save(depense('a', '2026-11-03'));
        await repos.dayClosures.add(cloture);
      });
      expect(await repos.expenses.all()).toHaveLength(1);
      expect(await repos.dayClosures.all()).toHaveLength(1);
    });
  });
});
