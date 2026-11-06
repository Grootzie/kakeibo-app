import type { Db, SqlParam } from './db';

export interface SettingsRow {
  id: number;
  install_id: string;
  install_day: string;
  reminder_time: string | null;
  reminder_enabled: number;
  trial_start: string | null;
  plan: 'trial' | 'free' | 'subscribed' | 'lifetime';
  seen_explanations: string;
  schema_version: number;
}

export interface BudgetVersionRow {
  id: string;
  month: string;
  income: number;
  fixed_costs: number;
  savings_goal: number;
  effective_from: string;
}

export interface ExpenseRow {
  id: string;
  day: string;
  amount: number;
  category: 'essentiel' | 'envies' | 'culture' | 'imprevus';
  note: string;
  created_at: string;
  updated_at: string;
}

export interface DayClosureRow {
  day: string;
  closed_at: string;
  kind: 'complete' | 'no_spend';
}

export interface WeekResultRow {
  week: string;
  sealed_at: string;
  counted_days: number;
  stamps: number;
  envelope: number;
  spent: number;
  in_budget: number;
  complete: number;
  gashapon_item: string | null;
  cracked_item: string | null;
  ceremony_seen: number;
}

export interface OwnedItemRow {
  year: number;
  item_id: string;
  acquired_at: string;
  week: string | null;
  source: 'base' | 'weekly';
  placed_at: string | null;
  state: 'intact' | 'cracked' | 'repaired';
  cracked_at: string | null;
  cracked_week: string | null;
  repaired_at: string | null;
}

export interface UnlockedRoomRow {
  year: number;
  room_id: string;
  unlocked_at: string;
}

export interface MonthReviewRow {
  month: string;
  completed_at: string;
  q1: string | null;
  q2: string | null;
  q3: string | null;
  real_savings: number | null;
  resolution: string | null;
}

export interface RecurringChargeRow {
  id: string;
  label: string;
  amount: number;
  frequency: 'weekly' | 'monthly';
  day: number;
  starts_on: string;
  ends_on: string | null;
}

let compteurPoints = 0;

/**
 * Exécute `f` dans une transaction. Les points de sauvegarde s'imbriquent : une écriture d'un
 * dépôt reste transactionnelle seule, et plusieurs écritures groupées sont validées ou annulées
 * ensemble.
 */
export async function inTransaction<T>(db: Db, f: () => Promise<T>): Promise<T> {
  compteurPoints += 1;
  const point = `ecriture_${compteurPoints}`;
  await db.execAsync(`SAVEPOINT ${point}`);
  try {
    const resultat = await f();
    await db.execAsync(`RELEASE ${point}`);
    return resultat;
  } catch (erreur) {
    await db.execAsync(`ROLLBACK TO ${point}`);
    await db.execAsync(`RELEASE ${point}`);
    throw erreur;
  }
}

type Row = Record<string, SqlParam>;

/** INSERT d'une ligne, colonnes dans l'ordre de l'objet. */
function insertSql(table: string, row: Row, suffixe = ''): [string, SqlParam[]] {
  const colonnes = Object.keys(row);
  const marques = colonnes.map(() => '?').join(', ');
  return [
    `INSERT INTO ${table} (${colonnes.join(', ')}) VALUES (${marques})${suffixe}`,
    colonnes.map((c) => row[c]),
  ];
}

/** INSERT qui met à jour la ligne existante de même clé. */
function upsertSql(
  table: string,
  row: Row,
  cle: string[],
  miseAJour?: string,
): [string, SqlParam[]] {
  const autres = Object.keys(row).filter((c) => !cle.includes(c));
  const set = miseAJour ?? autres.map((c) => `${c} = excluded.${c}`).join(', ');
  return insertSql(table, row, ` ON CONFLICT (${cle.join(', ')}) DO UPDATE SET ${set}`);
}

/**
 * Dépôts : seule porte d'accès à la base, utilisée par l'état (src/state), jamais par les écrans.
 * Chaque écriture passe dans une transaction. Une version du budget et une clôture ne s'ajoutent
 * que : aucune méthode ne les modifie ni ne les supprime, et la base le refuse (migration 2).
 */
export function createRepositories(db: Db) {
  const ecrire = (sql: string, params: SqlParam[]) =>
    inTransaction(db, () => db.runAsync(sql, params));
  const ajouter =
    <T extends object>(table: string) =>
    (row: T) =>
      ecrire(...insertSql(table, row as Row));

  return {
    /** Plusieurs écritures validées ou annulées ensemble. */
    transaction: <T>(f: () => Promise<T>): Promise<T> => inTransaction(db, f),

    settings: {
      get: (): Promise<SettingsRow | null> =>
        db.getFirstAsync<SettingsRow>('SELECT * FROM settings WHERE id = 1'),
      save: (row: SettingsRow) => ecrire(...upsertSql('settings', { ...row }, ['id'])),
    },

    budgetVersions: {
      all: (): Promise<BudgetVersionRow[]> =>
        db.getAllAsync<BudgetVersionRow>(
          'SELECT * FROM budget_version ORDER BY effective_from, rowid',
        ),
      /** Ajoute une version ; une version existante n'est jamais écrasée. */
      add: ajouter<BudgetVersionRow>('budget_version'),
    },

    expenses: {
      all: (): Promise<ExpenseRow[]> =>
        db.getAllAsync<ExpenseRow>('SELECT * FROM expense ORDER BY day, created_at, id'),
      /** Dépenses des jours `from` à `to`, inclus. */
      between: (from: string, to: string): Promise<ExpenseRow[]> =>
        db.getAllAsync<ExpenseRow>(
          'SELECT * FROM expense WHERE day BETWEEN ? AND ? ORDER BY day, created_at, id',
          [from, to],
        ),
      /** Ajout, ou modification si l'identifiant existe déjà. */
      save: (row: ExpenseRow) => ecrire(...upsertSql('expense', { ...row }, ['id'])),
      remove: (id: string) => ecrire('DELETE FROM expense WHERE id = ?', [id]),
    },

    dayClosures: {
      all: (): Promise<DayClosureRow[]> =>
        db.getAllAsync<DayClosureRow>('SELECT * FROM day_closure ORDER BY day'),
      /** Une clôture est définitive : elle ne se modifie ni ne se supprime. */
      add: ajouter<DayClosureRow>('day_closure'),
    },

    weekResults: {
      all: (): Promise<WeekResultRow[]> =>
        db.getAllAsync<WeekResultRow>('SELECT * FROM week_result ORDER BY week'),
      /** Écrit une fois, au scellement. */
      add: ajouter<WeekResultRow>('week_result'),
      markCeremonySeen: (weeks: string[]) =>
        inTransaction(db, async () => {
          for (const week of weeks) {
            await db.runAsync('UPDATE week_result SET ceremony_seen = 1 WHERE week = ?', [week]);
          }
        }),
    },

    ownedItems: {
      all: (): Promise<OwnedItemRow[]> =>
        db.getAllAsync<OwnedItemRow>(
          'SELECT * FROM owned_item ORDER BY year, acquired_at, item_id',
        ),
      /** Ajout ou changement d'état ; un jour de réparation déjà connu n'est jamais effacé. */
      save: (row: OwnedItemRow) =>
        ecrire(
          ...upsertSql(
            'owned_item',
            { ...row },
            ['year', 'item_id'],
            [
              'placed_at = excluded.placed_at',
              'state = excluded.state',
              'cracked_at = COALESCE(excluded.cracked_at, owned_item.cracked_at)',
              'cracked_week = COALESCE(excluded.cracked_week, owned_item.cracked_week)',
              'repaired_at = COALESCE(excluded.repaired_at, owned_item.repaired_at)',
            ].join(', '),
          ),
        ),
    },

    unlockedRooms: {
      all: (): Promise<UnlockedRoomRow[]> =>
        db.getAllAsync<UnlockedRoomRow>('SELECT * FROM unlocked_room ORDER BY year, unlocked_at'),
      add: ajouter<UnlockedRoomRow>('unlocked_room'),
    },

    monthReviews: {
      all: (): Promise<MonthReviewRow[]> =>
        db.getAllAsync<MonthReviewRow>('SELECT * FROM month_review ORDER BY month'),
      add: ajouter<MonthReviewRow>('month_review'),
    },

    recurringCharges: {
      all: (): Promise<RecurringChargeRow[]> =>
        db.getAllAsync<RecurringChargeRow>('SELECT * FROM recurring_charge ORDER BY starts_on'),
    },
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
