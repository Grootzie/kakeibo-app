// Réglages (E10, J5.6) : ce que l'écran montre du budget du mois et des dépenses récurrentes, et
// quand un changement s'applique à l'enveloppe. Purs : l'état et l'heure leur sont passés.
import type { RecurringChargeRow } from '../data/repositories';
import { type Cents, budgetInForce, budgetOf } from '../domain/budget';
import { addDays, weekDays, weekOf } from '../domain/calendrier';
import type { DayKey, LocalDateTime } from '../domain/scellement';
import type { AppState } from '../domain/traitement';

export interface VueBudgetReglages {
  income: Cents;
  fixedCosts: Cents;
  savingsGoal: Cents;
  /** Revenus − charges fixes − épargne visée. */
  budgetMois: Cents;
  /** Lundi à partir duquel un changement fait aujourd'hui s'applique à l'enveloppe. */
  changementLe: DayKey;
  /** Dépenses récurrentes en cours (pas arrêtées), dans l'ordre de leur début. */
  charges: RecurringChargeRow[];
}

/**
 * Un changement fait aujourd'hui ajoute une version en vigueur demain : l'enveloppe, qui retient
 * la version du lundi 00:00, change donc le lundi suivant.
 */
export function changementApplique(today: DayKey): DayKey {
  return weekDays(weekOf(addDays(today, 7)))[0];
}

/**
 * Budget du mois tel qu'il s'appliquera : la version en vigueur demain (celle sur laquelle un
 * changement s'appuie). Null tant que la bienvenue n'a pas posé de budget.
 */
export function vueBudgetReglages(
  etat: AppState,
  charges: readonly RecurringChargeRow[],
  maintenant: LocalDateTime,
): VueBudgetReglages | null {
  const demain = addDays(maintenant.day, 1);
  const v = budgetInForce(demain.slice(0, 7), etat.budgets, demain);
  if (v === null) return null;
  return {
    income: v.income,
    fixedCosts: v.fixedCosts,
    savingsGoal: v.savingsGoal,
    budgetMois: budgetOf(v),
    changementLe: changementApplique(maintenant.day),
    charges: charges.filter((c) => c.ends_on === null),
  };
}

export interface ApercuReglages {
  /** Null tant qu'un champ manque ou est illisible. */
  budgetMois: Cents | null;
  /** Un budget positif, et au moins un montant changé. */
  peutEnregistrer: boolean;
}

const montantValide = (n: Cents | null): n is Cents =>
  n !== null && Number.isSafeInteger(n) && n >= 0;

/** Budget du mois avec les revenus et l'épargne saisis, et les charges fixes actuelles. */
export function apercuReglages(
  saisie: { income: Cents | null; savingsGoal: Cents | null },
  base: { income: Cents; fixedCosts: Cents; savingsGoal: Cents },
): ApercuReglages {
  const { income, savingsGoal } = saisie;
  if (!montantValide(income) || !montantValide(savingsGoal)) {
    return { budgetMois: null, peutEnregistrer: false };
  }
  const budgetMois = income - base.fixedCosts - savingsGoal;
  const change = income !== base.income || savingsGoal !== base.savingsGoal;
  return { budgetMois, peutEnregistrer: budgetMois > 0 && change };
}

export interface SaisieCharge {
  label: string;
  amount: Cents | null;
  frequency: RecurringChargeRow['frequency'];
  day: number;
}

const JOUR_MAX = { monthly: 31, weekly: 7 } as const;

/** Libellé non vide, montant positif, jour dans les bornes de sa fréquence. */
export function chargeSaisieValide(s: SaisieCharge): boolean {
  return (
    s.label.trim() !== '' &&
    s.amount !== null &&
    Number.isSafeInteger(s.amount) &&
    s.amount > 0 &&
    Number.isInteger(s.day) &&
    s.day >= 1 &&
    s.day <= JOUR_MAX[s.frequency]
  );
}

/**
 * Jour suivant ou précédent d'une échéance, qui tourne dans ses bornes : 1 à 31 pour un mois,
 * 1 (lundi) à 7 (dimanche) pour une semaine. Un jour hors bornes y est d'abord ramené.
 */
export function decalerJourCharge(
  frequency: RecurringChargeRow['frequency'],
  day: number,
  delta: number,
): number {
  const max = JOUR_MAX[frequency];
  const borne = Math.min(Math.max(day, 1), max);
  return ((((borne - 1 + delta) % max) + max) % max) + 1;
}
