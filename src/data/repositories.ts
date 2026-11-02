import type { Db } from './db';

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

function tableRepository<T>(db: Db, table: string) {
  return {
    all: (): Promise<T[]> => db.getAllAsync<T>(`SELECT * FROM ${table}`),
  };
}

/** Dépôts de départ : lecture seule pour l'instant, les écritures arrivent avec les règles qui en ont besoin. */
export function createRepositories(db: Db) {
  return {
    settings: {
      get: (): Promise<SettingsRow | null> =>
        db.getFirstAsync<SettingsRow>('SELECT * FROM settings WHERE id = 1'),
    },
    budgetVersions: tableRepository<BudgetVersionRow>(db, 'budget_version'),
    expenses: tableRepository<ExpenseRow>(db, 'expense'),
    dayClosures: tableRepository<DayClosureRow>(db, 'day_closure'),
    weekResults: tableRepository<WeekResultRow>(db, 'week_result'),
    ownedItems: tableRepository<OwnedItemRow>(db, 'owned_item'),
    unlockedRooms: tableRepository<UnlockedRoomRow>(db, 'unlocked_room'),
    monthReviews: tableRepository<MonthReviewRow>(db, 'month_review'),
    recurringCharges: tableRepository<RecurringChargeRow>(db, 'recurring_charge'),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
