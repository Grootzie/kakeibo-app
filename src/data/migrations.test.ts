import type { Db } from './db';
import { MIGRATIONS, migrate, schemaVersion } from './migrations';
import { createTestDb } from './testDb';

const TABLES = [
  'settings',
  'budget_version',
  'expense',
  'day_closure',
  'week_result',
  'owned_item',
  'unlocked_room',
  'month_review',
  'recurring_charge',
];

async function tableNames(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return rows.map((r) => r.name);
}

describe('migrations', () => {
  it('ont des versions consécutives à partir de 1', () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual(MIGRATIONS.map((_, i) => i + 1));
  });

  it('créent toutes les tables du modèle de données sur une base vide', async () => {
    const db = createTestDb();
    expect(await schemaVersion(db)).toBe(0);
    await migrate(db);
    expect(await tableNames(db)).toEqual([...TABLES].sort());
    expect(await schemaVersion(db)).toBe(MIGRATIONS.length);
  });

  it('sont rejouables sans effet : une seconde passe ne change rien', async () => {
    const db = createTestDb();
    await migrate(db);
    await db.runAsync(
      "INSERT INTO day_closure (day, closed_at, kind) VALUES ('2026-11-02', '2026-11-02T20:00:00+01:00', 'complete')",
    );
    await migrate(db);
    const rows = await db.getAllAsync('SELECT * FROM day_closure');
    expect(rows).toHaveLength(1);
    expect(await schemaVersion(db)).toBe(MIGRATIONS.length);
  });

  it('ne rejouent que les migrations manquantes', async () => {
    const db = createTestDb();
    await migrate(db, MIGRATIONS.slice(0, 1));
    expect(await schemaVersion(db)).toBe(1);
    await migrate(db);
    expect(await schemaVersion(db)).toBe(MIGRATIONS.length);
  });

  it('refusent une base plus récente que l’appli', async () => {
    const db = createTestDb();
    await migrate(db);
    await db.execAsync(`PRAGMA user_version = ${MIGRATIONS.length + 1}`);
    await expect(migrate(db)).rejects.toThrow();
  });

  it('annulent une migration qui échoue, sans changer la version', async () => {
    const db = createTestDb();
    const cassee = [
      MIGRATIONS[0],
      { version: 2, sql: 'CREATE TABLE ok (a INTEGER); CREATE TABLE ok (a INTEGER);' },
    ];
    await expect(migrate(db, cassee)).rejects.toThrow();
    expect(await schemaVersion(db)).toBe(1);
    expect(await tableNames(db)).not.toContain('ok');
  });

  it('refusent un montant non entier ou un jour mal formé', async () => {
    const db = createTestDb();
    await migrate(db);
    await expect(
      db.runAsync(
        "INSERT INTO expense (id, day, amount, category, note, created_at, updated_at) VALUES ('a', '2026-11-02', 12.5, 'essentiel', '', 'x', 'x')",
      ),
    ).rejects.toThrow();
    await expect(
      db.runAsync(
        "INSERT INTO expense (id, day, amount, category, note, created_at, updated_at) VALUES ('b', '02/11/2026', 1250, 'essentiel', '', 'x', 'x')",
      ),
    ).rejects.toThrow();
    await expect(
      db.runAsync(
        "INSERT INTO expense (id, day, amount, category, note, created_at, updated_at) VALUES ('c', '2026-11-02', 1250, 'inconnue', '', 'x', 'x')",
      ),
    ).rejects.toThrow();
    await db.runAsync(
      "INSERT INTO expense (id, day, amount, category, note, created_at, updated_at) VALUES ('d', '2026-11-02', 1250, 'essentiel', 'pain', 'x', 'x')",
    );
  });
});
