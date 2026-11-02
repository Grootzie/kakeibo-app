import { openDatabaseAsync } from 'expo-sqlite';

import type { Db } from './db';

export const DATABASE_NAME = 'kakeibo.db';

/** Ouvre la base sur le téléphone et la ramène à l'interface `Db`. */
export async function openDb(): Promise<Db> {
  const raw = await openDatabaseAsync(DATABASE_NAME);
  return {
    execAsync: (sql) => raw.execAsync(sql),
    getFirstAsync: (sql, params = []) => raw.getFirstAsync(sql, [...params]),
    getAllAsync: (sql, params = []) => raw.getAllAsync(sql, [...params]),
    runAsync: async (sql, params = []) => {
      await raw.runAsync(sql, [...params]);
    },
  };
}
