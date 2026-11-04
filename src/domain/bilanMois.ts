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
 */
export function monthReview(
  month: MonthKey,
  budget: BudgetVersion,
  expenses: Expense[],
): MonthReview {
  if (budget.month !== month) {
    throw new Error(`Version de budget de ${budget.month} fournie pour le bilan de ${month}`);
  }
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

/** Le bilan utilise la dernière version du budget du mois ; null si le mois n'en a aucune. */
export function latestBudgetOfMonth(
  month: MonthKey,
  versions: BudgetVersion[],
): BudgetVersion | null {
  let derniere: BudgetVersion | null = null;
  for (const v of versions) {
    if (v.month === month && (derniere === null || v.effectiveFrom >= derniere.effectiveFrom)) {
      derniere = v;
    }
  }
  return derniere;
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
