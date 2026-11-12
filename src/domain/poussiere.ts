// Poussière de la maison (J1.5).
// Pur : le jour courant est toujours passé en paramètre ; aucun hasard.
import { type DayKey, type WeekId, addDays } from './calendrier';

export type DustLevel = 0 | 1 | 2;

/** Ce que la poussière retient du résultat d'une semaine scellée. */
export interface DustWeek {
  week: WeekId;
  /** Tous les jours décomptés de la semaine ont été clôturés. */
  complete: boolean;
}

const MS_PAR_JOUR = 86_400_000;

function utc(day: DayKey): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * J : nombre de jours entre le dernier jour clôturé et hier (0 si le dernier jour clôturé est hier
 * ou aujourd'hui). Sans aucune clôture, on part de la veille du jour d'installation.
 */
export function dustDays(today: DayKey, closures: DayKey[], installDay: DayKey): number {
  const dernier = closures.reduce<DayKey>(
    (max, jour) => (jour > max ? jour : max),
    addDays(installDay, -1),
  );
  const hier = addDays(today, -1);
  return Math.max(0, Math.round((utc(hier) - utc(dernier)) / MS_PAR_JOUR));
}

function levelOf(days: number): DustLevel {
  if (days >= 4) return 2;
  if (days >= 2) return 1;
  return 0;
}

/** La dernière semaine scellée (par numéro ISO) est incomplète : plancher de niveau 1. */
export function dustFloor(weeks: DustWeek[]): boolean {
  const derniere = weeks.reduce<DustWeek | null>(
    (max, w) => (max === null || w.week > max.week ? w : max),
    null,
  );
  return derniere !== null && !derniere.complete;
}

/**
 * Niveau de poussière d'un jour donné. Après une semaine incomplète, la maison garde au moins le
 * niveau 1 jusqu'à la prochaine semaine complète, même si les jours suivants sont clôturés.
 */
export function dustLevel(
  today: DayKey,
  closures: DayKey[],
  weeks: DustWeek[],
  installDay: DayKey,
): DustLevel {
  const niveau = levelOf(dustDays(today, closures, installDay));
  return dustFloor(weeks) && niveau < 1 ? 1 : niveau;
}
