// Sélecteurs de l'accueil (E2). Purs : l'état et l'heure leur sont passés.
import { type Cents, weekEnvelope, weekSpent } from '../domain/budget';
import { addDays, weekDays, weekOf } from '../domain/calendrier';
import { type DayKey, type LocalDateTime, type WeekId, canCloseDay } from '../domain/scellement';
import type { AppState } from '../domain/traitement';

export interface EnveloppeSemaine {
  semaine: WeekId;
  enveloppe: Cents;
  depense: Cents;
  /** Enveloppe − dépensé ; négatif en cas de dépassement. */
  reste: Cents;
  dansLeBudget: boolean;
}

/** Enveloppe et dépensé de la semaine en cours. */
export function enveloppeSemaine(etat: AppState, now: LocalDateTime): EnveloppeSemaine {
  const semaine = weekOf(now.day);
  const enveloppe = weekEnvelope(semaine, etat.budgets, etat.installDay);
  const depense = weekSpent(semaine, etat.expenses);
  return {
    semaine,
    enveloppe,
    depense,
    reste: enveloppe - depense,
    dansLeBudget: depense <= enveloppe,
  };
}

/** Les cinq états d'une case de la carte de tampons (E2). */
export type StatutCase = 'cloturee' | 'a_cloturer' | 'rattrapable' | 'hors_decompte' | 'a_venir';

export interface CaseTampon {
  jour: DayKey;
  statut: StatutCase;
}

function statut(jour: DayKey, etat: AppState, now: LocalDateTime): StatutCase {
  if (etat.closedDays.includes(jour)) return 'cloturee';
  if (jour < etat.installDay) return 'hors_decompte';
  if (jour > now.day) return 'a_venir';
  // Un jour passé non clôturé de la semaine en cours reste rattrapable : la semaine en cours
  // n'est scellée avant son terme que si tous ses jours décomptés sont clôturés.
  return jour === now.day ? 'a_cloturer' : 'rattrapable';
}

/** Les 7 cases de la semaine en cours, du lundi au dimanche. */
export function casesSemaine(etat: AppState, now: LocalDateTime): CaseTampon[] {
  return weekDays(weekOf(now.day)).map((jour) => ({ jour, statut: statut(jour, etat, now) }));
}

/**
 * Jour à rattraper le plus ancien : jour passé, décompté, non clôturé, d'une semaine encore
 * ouverte (la semaine en cours, ou la précédente jusqu'au lundi 12:00). Null s'il n'y en a pas.
 */
export function jourARattraper(etat: AppState, now: LocalDateTime): DayKey | null {
  const ctx = {
    installDay: etat.installDay,
    closedDays: etat.closedDays,
    sealedWeeks: etat.results.map((r) => r.week),
  };
  const lundiPrecedent = addDays(weekDays(weekOf(now.day))[0], -7);
  for (let jour = lundiPrecedent; jour < now.day; jour = addDays(jour, 1)) {
    if (canCloseDay(jour, now, ctx).ok) return jour;
  }
  return null;
}

/** Bandeau unique de l'accueil. En J2, seulement le jour à rattraper (J3 et J5 ajouteront les autres). */
export type BandeauAccueil = { type: 'jour_a_rattraper'; jour: DayKey };

/** Tout ce que l'accueil (E2) affiche, hors maison. */
export interface VueAccueil {
  jour: DayKey;
  enveloppe: EnveloppeSemaine;
  cases: CaseTampon[];
  aujourdhuiCloture: boolean;
  bandeau: BandeauAccueil | null;
}

export function vueAccueil(etat: AppState, now: LocalDateTime): VueAccueil {
  const rattraper = jourARattraper(etat, now);
  return {
    jour: now.day,
    enveloppe: enveloppeSemaine(etat, now),
    cases: casesSemaine(etat, now),
    aujourdhuiCloture: etat.closedDays.includes(now.day),
    bandeau: rattraper === null ? null : { type: 'jour_a_rattraper', jour: rattraper },
  };
}
