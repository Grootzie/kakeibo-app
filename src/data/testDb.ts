import { DatabaseSync } from 'node:sqlite';

import type { Db } from './db';

/** Base SQLite en mémoire pour les tests (Node), derrière la même interface que expo-sqlite. */
export function createTestDb(): Db {
  const raw = new DatabaseSync(':memory:');
  return {
    execAsync: async (sql) => {
      raw.exec(sql);
    },
    getFirstAsync: async <T>(sql: string, params: readonly (string | number)[] = []) =>
      (raw.prepare(sql).get(...params) as T | undefined) ?? null,
    getAllAsync: async <T>(sql: string, params: readonly (string | number)[] = []) =>
      raw.prepare(sql).all(...params) as T[],
    runAsync: async (sql, params = []) => {
      raw.prepare(sql).run(...params);
    },
  };
}
