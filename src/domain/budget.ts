// Budget, enveloppe et dépenses récurrentes (J1.2).
// Pur : montants en centimes, aucune horloge.
import {
  type DayKey,
  type MonthKey,
  type WeekId,
  countedDays,
  dayOfWeek,
  weekDays,
} from './calendrier';

export type Cents = number;

export interface BudgetVersion {
  id: string;
  month: MonthKey;
  income: Cents;
  /** Somme des échéances des dépenses récurrentes du mois. */
  fixedCosts: Cents;
  savingsGoal: Cents;
  /** Premier jour où cette version s'applique. */
  effectiveFrom: DayKey;
}

export interface RecurringCharge {
  id: string;
  label: string;
  amount: Cents;
  frequency: 'weekly' | 'monthly';
  /** Jour de la semaine (1 à 7) ou du mois (1 à 31, ramené au dernier jour des mois courts). */
  day: number;
  startsOn: DayKey;
  /** Dernier jour d'application, inclus ; null tant que la charge court. */
  endsOn: DayKey | null;
}

export interface Expense {
  id: string;
  day: DayKey;
  amount: Cents;
}

/** Budget du mois = revenus − charges fixes − épargne visée. */
export function budgetOf(version: BudgetVersion): Cents {
  return version.income - version.fixedCosts - version.savingsGoal;
}

function daysInMonth(month: MonthKey): number {
  const [annee, mois] = month.split('-').map(Number);
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate();
}

/** Échéances d'une charge dans un mois, bornées par starts_on et ends_on. */
export function chargeDueDays(month: MonthKey, charge: RecurringCharge): DayKey[] {
  const nbJours = daysInMonth(month);
  const jours: DayKey[] = [];
  if (charge.frequency === 'monthly') {
    jours.push(`${month}-${String(Math.min(charge.day, nbJours)).padStart(2, '0')}`);
  } else {
    for (let n = 1; n <= nbJours; n++) {
      const jour = `${month}-${String(n).padStart(2, '0')}`;
      if (dayOfWeek(jour) === charge.day) jours.push(jour);
    }
  }
  return jours.filter(
    (j) => j >= charge.startsOn && (charge.endsOn === null || j <= charge.endsOn),
  );
}

/** Charges fixes d'un mois : somme des échéances de ses dépenses récurrentes. */
export function monthFixedCosts(month: MonthKey, charges: RecurringCharge[]): Cents {
  return charges.reduce((total, c) => total + c.amount * chargeDueDays(month, c).length, 0);
}

/** Nouvelle version du budget (on n'écrase jamais) : charges fixes recalculées depuis les récurrentes. */
export function reviseBudget(
  previous: BudgetVersion,
  charges: RecurringCharge[],
  effectiveFrom: DayKey,
  id: string,
): BudgetVersion {
  return { ...previous, id, fixedCosts: monthFixedCosts(previous.month, charges), effectiveFrom };
}

/**
 * Version en vigueur pour un mois au jour donné : la plus récente des versions de ce mois
 * déjà effective. Sans version du mois, reconduction : la plus récente version déjà effective,
 * tous mois confondus. Null seulement si aucune version n'est effective.
 */
function versionInForce(
  month: MonthKey,
  versions: BudgetVersion[],
  asOf: DayKey,
): BudgetVersion | null {
  const parDate = (a: BudgetVersion, b: BudgetVersion): number =>
    a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : 0;
  const effectives = versions.filter((v) => v.effectiveFrom <= asOf).sort(parDate);
  const duMois = effectives.filter((v) => v.month === month);
  const retenues = duMois.length > 0 ? duMois : effectives;
  return retenues.length > 0 ? retenues[retenues.length - 1] : null;
}

// Plus petit commun multiple de 28, 29, 30 et 31 : permet un calcul exact en entiers.
const DENOMINATEUR = 377_580;

/**
 * Enveloppe d'une semaine : pour chaque jour décompté, budget du mois de ce jour divisé par le
 * nombre de jours du mois, avec la version en vigueur le lundi 00:00 de la semaine.
 * Calcul exact, arrondi au centime le plus proche une seule fois, à la fin.
 */
export function weekEnvelope(week: WeekId, budgets: BudgetVersion[], installDay: DayKey): Cents {
  const lundi = weekDays(week)[0];
  let numerateur = 0; // en centimes × DENOMINATEUR
  for (const jour of countedDays(week, installDay)) {
    const mois = jour.slice(0, 7);
    const version = versionInForce(mois, budgets, lundi);
    if (version === null) continue;
    numerateur += budgetOf(version) * (DENOMINATEUR / daysInMonth(mois));
  }
  return Math.floor((2 * numerateur + DENOMINATEUR) / (2 * DENOMINATEUR));
}

/** Dépensé de la semaine : dépenses datées de ses jours. Les échéances récurrentes n'en font pas partie. */
export function weekSpent(week: WeekId, expenses: Expense[]): Cents {
  const jours = new Set(weekDays(week));
  return expenses.filter((e) => jours.has(e.day)).reduce((total, e) => total + e.amount, 0);
}

/** Dans le budget : dépensé ≤ enveloppe. */
export function isInBudget(spent: Cents, envelope: Cents): boolean {
  return spent <= envelope;
}
