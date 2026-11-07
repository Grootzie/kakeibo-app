// Noter une dépense (E3, J2.3) : bornes du montant, note et jours proposés.
// Pur : l'heure courante est passée en paramètre.
import type { Cents } from './budget';
import { addDays, weekDays, weekOf } from './calendrier';
import { type ClosureContext, type DayKey, type LocalDateTime, canAddExpense } from './scellement';

/** 0,01 €. */
export const MIN_AMOUNT: Cents = 1;
/** 99 999,99 €. */
export const MAX_AMOUNT: Cents = 9_999_999;
export const NOTE_MAX_LENGTH = 80;

/** Montant accepté : un nombre entier de centimes, de 0,01 € à 99 999,99 €. */
export function isValidAmount(amount: Cents): boolean {
  return Number.isInteger(amount) && amount >= MIN_AMOUNT && amount <= MAX_AMOUNT;
}

/** Note facultative de 80 caractères au plus (caractères, pas unités de code UTF-16). */
export function isValidNote(note: string): boolean {
  return Array.from(note).length <= NOTE_MAX_LENGTH;
}

/**
 * Jours où l'on peut dater une nouvelle dépense, du plus ancien à aujourd'hui : jours décomptés,
 * pas dans le futur, des semaines encore ouvertes (la semaine en cours, et la précédente jusqu'au
 * lundi 12:00 tant qu'elle n'est pas scellée). Un jour clôturé reste proposé.
 */
export function expenseDays(now: LocalDateTime, ctx: ClosureContext): DayKey[] {
  const jours: DayKey[] = [];
  const lundiPrecedent = addDays(weekDays(weekOf(now.day))[0], -7);
  for (let jour = lundiPrecedent; jour <= now.day; jour = addDays(jour, 1)) {
    if (canAddExpense(jour, now, ctx).ok) jours.push(jour);
  }
  return jours;
}
