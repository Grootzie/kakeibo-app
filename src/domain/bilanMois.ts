// Bilan du mois : les quatre questions (J1.7).
// Pur : montants en centimes, jour courant passé en paramètre, aucune horloge.
import { type BudgetVersion, type Cents, type Expense } from './budget';
import type { DayKey, MonthKey } from './calendrier';

export interface MonthReview {
  month: MonthKey;
  /** Q1 : ce que j'avais = revenus − charges fixes. */
  q1: Cents;
  /** Q2 : ce que je voulais mettre de côté = épargne visée. */
  q2: Cents;
  /** Q3 : ce que j'ai dépensé, dépenses datées du mois (hors échéances récurrentes). */
  q3: Cents;
  /** Épargne réelle = Q1 − Q3, négative si le mois dépasse. */
  realSavings: Cents;
  /** Épargne réelle ≥ Q2. */
  goalReached: boolean;
}

/**
 * Les trois premières questions d'un mois. `expenses` ne contient que des dépenses saisies :
 * les échéances récurrentes sont déjà dans les charges fixes, donc dans Q1.
 * `budget` peut venir d'un autre mois quand il est reconduit (voir `latestBudgetOfMonth`).
 */
export function monthReview(
  month: MonthKey,
  budget: BudgetVersion,
  expenses: Expense[],
): MonthReview {
  const q1 = budget.income - budget.fixedCosts;
  const q2 = budget.savingsGoal;
  const q3 = expenses
    .filter((e) => e.day.slice(0, 7) === month)
    .reduce((total, e) => total + e.amount, 0);
  const realSavings = q1 - q3;
  return { month, q1, q2, q3, realSavings, goalReached: realSavings >= q2 };
}

/** Q4 : texte libre de 0 à 140 caractères. */
export const RESOLUTION_MAX_LENGTH = 140;

/** Un caractère compte pour un, y compris hors du plan de base (emoji). */
export function isValidResolution(text: string): boolean {
  return Array.from(text).length <= RESOLUTION_MAX_LENGTH;
}

function lastDayOfMonth(month: MonthKey): DayKey {
  const [annee, mois] = month.split('-').map(Number);
  const nbJours = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  return `${month}-${String(nbJours).padStart(2, '0')}`;
}

/**
 * Version du budget utilisée par le bilan : la dernière version du mois ou, si le mois n'en a
 * aucune, reconduction de la version en vigueur la plus récente, tous mois confondus, parmi
 * celles entrées en vigueur au plus tard le dernier jour du mois. Null si aucune ne l'est.
 */
export function latestBudgetOfMonth(
  month: MonthKey,
  versions: BudgetVersion[],
): BudgetVersion | null {
  const plusRecente = (candidates: BudgetVersion[]): BudgetVersion | null =>
    candidates.reduce<BudgetVersion | null>(
      (derniere, v) =>
        derniere === null || v.effectiveFrom >= derniere.effectiveFrom ? v : derniere,
      null,
    );
  const duMois = plusRecente(versions.filter((v) => v.month === month));
  if (duMois !== null) return duMois;
  const fin = lastDayOfMonth(month);
  return plusRecente(versions.filter((v) => v.effectiveFrom <= fin));
}

/** Chiffres du bilan d'un mois avec la version reconduite au besoin ; null sans aucune version. */
export function monthReviewOf(
  month: MonthKey,
  versions: BudgetVersion[],
  expenses: Expense[],
): MonthReview | null {
  const version = latestBudgetOfMonth(month, versions);
  return version === null ? null : monthReview(month, version, expenses);
}

function previousMonth(month: MonthKey): MonthKey {
  const [annee, mois] = month.split('-').map(Number);
  return mois === 1 ? `${annee - 1}-12` : `${annee}-${String(mois - 1).padStart(2, '0')}`;
}

/**
 * Mois à proposer au bilan : le dernier mois terminé (celui qui précède le mois de `today`),
 * à partir du 1er du mois suivant. Les mois plus anciens non validés ne sont pas proposés.
 * Rien si ce mois précède l'installation ou s'il est déjà validé.
 */
export function monthToReview(
  today: DayKey,
  installDay: DayKey,
  lastValidated: MonthKey | null,
): MonthKey | null {
  const mois = previousMonth(today.slice(0, 7));
  if (mois < installDay.slice(0, 7)) return null;
  if (lastValidated !== null && mois <= lastValidated) return null;
  return mois;
}
