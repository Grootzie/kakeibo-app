import type { Db } from './db';

export interface Migration {
  version: number;
  sql: string;
}

const DAY = "GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'";
const MONTH = "GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'";
const WEEK = "GLOB '[0-9][0-9][0-9][0-9]-W[0-9][0-9]'";

/**
 * Migrations versionnées, appliquées dans l'ordre. On n'en modifie jamais une
 * déjà livrée : on en ajoute une. Montants en centimes (entiers), jours AAAA-MM-JJ.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    sql: `
CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  install_id TEXT NOT NULL,
  install_day TEXT NOT NULL CHECK (install_day ${DAY}),
  reminder_time TEXT,
  reminder_enabled INTEGER NOT NULL DEFAULT 1 CHECK (reminder_enabled IN (0, 1)),
  trial_start TEXT,
  plan TEXT NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial', 'free', 'subscribed', 'lifetime')),
  seen_explanations TEXT NOT NULL DEFAULT '[]',
  schema_version INTEGER NOT NULL
);

CREATE TABLE budget_version (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL CHECK (month ${MONTH}),
  income INTEGER NOT NULL CHECK (typeof(income) = 'integer'),
  fixed_costs INTEGER NOT NULL CHECK (typeof(fixed_costs) = 'integer'),
  savings_goal INTEGER NOT NULL CHECK (typeof(savings_goal) = 'integer'),
  effective_from TEXT NOT NULL CHECK (effective_from ${DAY})
);
CREATE INDEX budget_version_month ON budget_version (month, effective_from);

CREATE TABLE expense (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL CHECK (day ${DAY}),
  amount INTEGER NOT NULL CHECK (typeof(amount) = 'integer'),
  category TEXT NOT NULL CHECK (category IN ('essentiel', 'envies', 'culture', 'imprevus')),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 80),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX expense_day ON expense (day);

CREATE TABLE day_closure (
  day TEXT PRIMARY KEY CHECK (day ${DAY}),
  closed_at TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('complete', 'no_spend'))
);

CREATE TABLE week_result (
  week TEXT PRIMARY KEY CHECK (week ${WEEK}),
  sealed_at TEXT NOT NULL,
  counted_days INTEGER NOT NULL,
  stamps INTEGER NOT NULL,
  envelope INTEGER NOT NULL CHECK (typeof(envelope) = 'integer'),
  spent INTEGER NOT NULL CHECK (typeof(spent) = 'integer'),
  in_budget INTEGER NOT NULL CHECK (in_budget IN (0, 1)),
  complete INTEGER NOT NULL CHECK (complete IN (0, 1)),
  gashapon_item TEXT,
  cracked_item TEXT,
  ceremony_seen INTEGER NOT NULL DEFAULT 0 CHECK (ceremony_seen IN (0, 1))
);

CREATE TABLE owned_item (
  year INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  acquired_at TEXT NOT NULL,
  week TEXT CHECK (week IS NULL OR week ${WEEK}),
  source TEXT NOT NULL CHECK (source IN ('base', 'weekly')),
  placed_at TEXT,
  state TEXT NOT NULL DEFAULT 'intact' CHECK (state IN ('intact', 'cracked', 'repaired')),
  cracked_at TEXT,
  cracked_week TEXT CHECK (cracked_week IS NULL OR cracked_week ${WEEK}),
  repaired_at TEXT,
  PRIMARY KEY (year, item_id)
);

CREATE TABLE unlocked_room (
  year INTEGER NOT NULL,
  room_id TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,
  PRIMARY KEY (year, room_id)
);

CREATE TABLE month_review (
  month TEXT PRIMARY KEY CHECK (month ${MONTH}),
  completed_at TEXT NOT NULL,
  q1 TEXT,
  q2 TEXT,
  q3 TEXT,
  real_savings INTEGER CHECK (real_savings IS NULL OR typeof(real_savings) = 'integer'),
  resolution TEXT
);

CREATE TABLE recurring_charge (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (typeof(amount) = 'integer'),
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
  day INTEGER NOT NULL CHECK (
    (frequency = 'weekly' AND day BETWEEN 1 AND 7) OR
    (frequency = 'monthly' AND day BETWEEN 1 AND 31)
  ),
  starts_on TEXT NOT NULL CHECK (starts_on ${DAY}),
  ends_on TEXT CHECK (ends_on IS NULL OR ends_on ${DAY})
);
`,
  },
  {
    // Une version du budget ne s'écrase jamais (on en ajoute une) ; une clôture ne se supprime
    // jamais (J2.1). La base le garantit, même pour une écriture qui ne passe pas par les dépôts.
    version: 2,
    sql: `
CREATE TRIGGER budget_version_sans_modification BEFORE UPDATE ON budget_version
BEGIN SELECT RAISE(ABORT, 'budget_version : on ajoute une version, on n''en modifie jamais'); END;
CREATE TRIGGER budget_version_sans_suppression BEFORE DELETE ON budget_version
BEGIN SELECT RAISE(ABORT, 'budget_version : une version ne se supprime jamais'); END;
CREATE TRIGGER day_closure_sans_modification BEFORE UPDATE ON day_closure
BEGIN SELECT RAISE(ABORT, 'day_closure : une clôture est définitive'); END;
CREATE TRIGGER day_closure_sans_suppression BEFORE DELETE ON day_closure
BEGIN SELECT RAISE(ABORT, 'day_closure : une clôture ne se supprime jamais'); END;
`,
  },
];

export async function schemaVersion(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/** Applique, dans l'ordre et chacune dans une transaction, les migrations pas encore passées. */
export async function migrate(
  db: Db,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<void> {
  const current = await schemaVersion(db);
  const latest = migrations.length > 0 ? migrations[migrations.length - 1].version : 0;
  if (current > latest) {
    throw new Error(`Base en version ${current}, plus récente que l'appli (version ${latest}).`);
  }
  for (const migration of migrations) {
    if (migration.version <= current) continue;
    await db.execAsync('BEGIN');
    try {
      await db.execAsync(migration.sql);
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
      await db.execAsync('COMMIT');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      throw error;
    }
  }
}
