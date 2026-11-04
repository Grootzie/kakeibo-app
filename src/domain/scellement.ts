// Clôture des jours, scellement et résultat d'une semaine (J1.3).
// Pur : l'heure courante est toujours passée en paramètre ; aucun hasard.
import {
  type BudgetVersion,
  type Cents,
  type Expense,
  isInBudget,
  weekEnvelope,
  weekSpent,
} from './budget';
import { type DayKey, type WeekId, addDays, countedDays, weekDays, weekOf } from './calendrier';

export type { DayKey, WeekId };
export type ItemId = string;

/** Instant local du téléphone : jour AAAA-MM-JJ et heure HH:MM. */
export interface LocalDateTime {
  day: DayKey;
  time: string;
}

/** Heure à laquelle une semaine non terminée est scellée, le lundi suivant. */
export const SEAL_TIME = '12:00';

export type RefusalReason = 'before_install' | 'future_day' | 'already_closed' | 'week_sealed';
export type CloseCheck = { ok: true } | { ok: false; reason: RefusalReason };

export interface ClosureContext {
  installDay: DayKey;
  /** Jours déjà clôturés. */
  closedDays: DayKey[];
  /** Semaines déjà scellées, enregistrées. */
  sealedWeeks: WeekId[];
}

const stamp = (t: LocalDateTime): string => `${t.day}T${t.time}`;

/** Dernier instant de la semaine ouverte : le lundi suivant à 12:00, qui scelle la semaine. */
export function sealDeadline(week: WeekId): LocalDateTime {
  return { day: addDays(weekDays(week)[6], 1), time: SEAL_TIME };
}

/** Semaine ouverte : délai de grâce non écoulé et pas scellée. */
function isWeekOpen(week: WeekId, now: LocalDateTime, sealedWeeks: WeekId[]): boolean {
  return !sealedWeeks.includes(week) && stamp(now) < stamp(sealDeadline(week));
}

function checkDay(day: DayKey, now: LocalDateTime, ctx: ClosureContext): CloseCheck {
  if (day < ctx.installDay) return { ok: false, reason: 'before_install' };
  if (day > now.day) return { ok: false, reason: 'future_day' };
  if (!isWeekOpen(weekOf(day), now, ctx.sealedWeeks)) return { ok: false, reason: 'week_sealed' };
  return { ok: true };
}

/** Clôture possible : jour décompté, pas dans le futur, d'une semaine ouverte, pas déjà clôturé. */
export function canCloseDay(day: DayKey, now: LocalDateTime, ctx: ClosureContext): CloseCheck {
  const jour = checkDay(day, now, ctx);
  if (!jour.ok) return jour;
  return ctx.closedDays.includes(day) ? { ok: false, reason: 'already_closed' } : jour;
}

/** Dépense acceptée : mêmes conditions que la clôture, sauf qu'on peut en ajouter à un jour clôturé. */
export function canAddExpense(day: DayKey, now: LocalDateTime, ctx: ClosureContext): CloseCheck {
  return checkDay(day, now, ctx);
}

export type SealTrigger = 'all_closed' | 'deadline';

/**
 * Premier des deux moments de scellement atteint à cet instant, ou null si la semaine reste ouverte :
 * tous les jours décomptés clôturés, ou le lundi suivant à 12:00.
 */
export function sealingTrigger(
  week: WeekId,
  installDay: DayKey,
  closedDays: DayKey[],
  now: LocalDateTime,
): SealTrigger | null {
  const jours = countedDays(week, installDay);
  if (jours.length > 0 && jours.every((j) => closedDays.includes(j))) return 'all_closed';
  return stamp(now) >= stamp(sealDeadline(week)) ? 'deadline' : null;
}

export interface WeekResult {
  week: WeekId;
  sealedAt: LocalDateTime;
  countedDays: number;
  stamps: number;
  envelope: Cents;
  spent: Cents;
  inBudget: boolean;
  /** Tous les jours décomptés clôturés. */
  complete: boolean;
  gashaponItem: ItemId | null;
  crackedItem: ItemId | null;
}

export interface SealInput {
  week: WeekId;
  installDay: DayKey;
  sealedAt: LocalDateTime;
  closedDays: DayKey[];
  expenses: Expense[];
  budgets: BudgetVersion[];
  /** Prochain objet non obtenu de la pièce du mois (catalogue, J1.4) ; null s'il n'y en a pas. */
  nextItem: ItemId | null;
  /** Objet qui se fêlerait si la semaine est hors budget (J1.6) ; null s'il n'y en a aucun. */
  crackTarget: ItemId | null;
}

/**
 * Résultat d'une semaine, sans hasard : semaine complète, une capsule ; hors budget, une fêlure.
 * La poussière d'une semaine incomplète se lit dans `complete` (J1.5).
 */
export function sealWeek(input: SealInput): WeekResult {
  const jours = countedDays(input.week, input.installDay);
  const stamps = jours.filter((j) => input.closedDays.includes(j)).length;
  const envelope = weekEnvelope(input.week, input.budgets, input.installDay);
  const spent = weekSpent(input.week, input.expenses);
  const complete = jours.length > 0 && stamps === jours.length;
  const inBudget = isInBudget(spent, envelope);
  return {
    week: input.week,
    sealedAt: input.sealedAt,
    countedDays: jours.length,
    stamps,
    envelope,
    spent,
    inBudget,
    complete,
    gashaponItem: complete ? input.nextItem : null,
    crackedItem: inBudget ? null : input.crackTarget,
  };
}

export interface PendingSeal {
  week: WeekId;
  trigger: SealTrigger;
  /** Instant de scellement : le lundi 12:00 pour le délai, sinon l'instant donné. */
  sealedAt: LocalDateTime;
}

/**
 * Semaines à sceller à cet instant, de la plus ancienne à la plus récente. Une semaine déjà
 * scellée n'y figure jamais : son résultat reste figé, même si ses dépenses sont modifiées.
 */
export function weeksToSeal(input: {
  now: LocalDateTime;
  installDay: DayKey;
  closedDays: DayKey[];
  results: WeekResult[];
}): PendingSeal[] {
  const scellees = new Set(input.results.map((r) => r.week));
  const aSceller: PendingSeal[] = [];
  const derniere = weekOf(input.now.day);
  for (let w = weekOf(input.installDay); w <= derniere; w = weekOf(addDays(weekDays(w)[0], 7))) {
    if (scellees.has(w)) continue;
    const trigger = sealingTrigger(w, input.installDay, input.closedDays, input.now);
    if (trigger === null) continue;
    aSceller.push({
      week: w,
      trigger,
      sealedAt: trigger === 'deadline' ? sealDeadline(w) : input.now,
    });
  }
  return aSceller;
}
