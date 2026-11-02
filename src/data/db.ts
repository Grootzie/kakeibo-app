/** Sous-ensemble de l'API expo-sqlite utilisé par les dépôts et les migrations. */
export type SqlParam = string | number | null;

export interface Db {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string, params?: readonly SqlParam[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: readonly SqlParam[]): Promise<T[]>;
  runAsync(sql: string, params?: readonly SqlParam[]): Promise<void>;
}
