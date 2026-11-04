// Calendrier : jours, semaines ISO 8601 et mois (J1.1).
// Pur : aucune horloge, calcul en UTC pour ne dépendre d'aucun fuseau.

export type DayKey = string; // 'AAAA-MM-JJ'
export type WeekId = string; // 'AAAA-Www'
export type MonthKey = string; // 'AAAA-MM'

const MS_PAR_JOUR = 86_400_000;

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

function toUtc(day: DayKey): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): DayKey {
  const date = new Date(ms);
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(day: DayKey, n: number): DayKey {
  return fromUtc(toUtc(day) + n * MS_PAR_JOUR);
}

/** 1 pour lundi, 7 pour dimanche. */
export function dayOfWeek(day: DayKey): number {
  const jour = new Date(toUtc(day)).getUTCDay();
  return jour === 0 ? 7 : jour;
}

/** Jeudi de la semaine du jour donné : il fixe l'année ISO et le mois. */
function thursdayOf(day: DayKey): DayKey {
  return addDays(day, 4 - dayOfWeek(day));
}

export function weekOf(day: DayKey): WeekId {
  const jeudi = thursdayOf(day);
  const annee = Number(jeudi.slice(0, 4));
  const rang = Math.floor((toUtc(jeudi) - Date.UTC(annee, 0, 1)) / MS_PAR_JOUR);
  return `${pad(annee, 4)}-W${pad(Math.floor(rang / 7) + 1)}`;
}

function mondayOf(week: WeekId): DayKey {
  const [annee, numero] = week.split('-W').map(Number);
  // Le 4 janvier est toujours dans la semaine 1.
  const lundiSemaine1 = addDays(`${pad(annee, 4)}-01-04`, 1 - dayOfWeek(`${pad(annee, 4)}-01-04`));
  return addDays(lundiSemaine1, (numero - 1) * 7);
}

/** Les sept jours de la semaine, du lundi au dimanche. */
export function weekDays(week: WeekId): DayKey[] {
  const lundi = mondayOf(week);
  return Array.from({ length: 7 }, (_, i) => addDays(lundi, i));
}

/** Jours postérieurs ou égaux au jour d'installation. */
export function countedDays(week: WeekId, installDay: DayKey): DayKey[] {
  return weekDays(week).filter((d) => d >= installDay);
}

/** Le mois qui contient le jeudi de la semaine. */
export function weekMonth(week: WeekId): MonthKey {
  return mondayOfThursday(week).slice(0, 7);
}

function mondayOfThursday(week: WeekId): DayKey {
  return addDays(mondayOf(week), 3);
}

/** Les semaines d'un mois, dans l'ordre. */
export function weeksOfMonth(month: MonthKey): WeekId[] {
  const semaines: WeekId[] = [];
  // Toute semaine du mois a son jeudi entre le 1er et le 31 : on balaie ces jours.
  for (let d = `${month}-01`; d.slice(0, 7) === month; d = addDays(d, 1)) {
    if (dayOfWeek(d) === 4) semaines.push(weekOf(d));
  }
  return semaines;
}

/** Nombre d'emplacements d'objets à gagner : 4 ou 5 selon les jeudis du mois. */
export function slotsInMonth(month: MonthKey): number {
  return weeksOfMonth(month).length;
}
