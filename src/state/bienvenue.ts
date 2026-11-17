// Bienvenue (E1) : quand elle s'affiche, l'aperçu de l'étape « Mon mois » (budget du mois et
// enveloppe de la semaine) et l'heure de l'étape « Mon rappel du soir ». Purs : l'état, le jour
// d'installation et le jour courant leur sont passés.
import { type Cents, budgetOf, weekEnvelope } from '../domain/budget';
import { weekDays, weekOf } from '../domain/calendrier';
import type { DayKey } from '../domain/scellement';
import type { AppState } from '../domain/traitement';

/**
 * E1 s'affiche tant qu'aucune version du budget n'existe : à la première ouverture, et de
 * nouveau si l'appli a été quittée avant la fin. Une fois le budget posé, plus jamais.
 */
export function bienvenueAFaire(etat: AppState | null): boolean {
  return etat !== null && etat.budgets.length === 0;
}

/** E1 à afficher : à faire, et pas passée par le réglage caché des builds de développement. */
export function bienvenueAAfficher(s: {
  etat: AppState | null;
  bienvenuePassee: boolean;
}): boolean {
  return !s.bienvenuePassee && bienvenueAFaire(s.etat);
}

/** Montants saisis à l'étape « Mon mois » ; null pour un champ vide ou illisible. */
export interface SaisieBudget {
  income: Cents | null;
  fixedCosts: Cents | null;
  savingsGoal: Cents | null;
}

export interface ApercuBudget {
  /** Revenus − charges fixes − épargne visée ; null tant qu'un champ manque. */
  budgetMois: Cents | null;
  /** Enveloppe de la semaine en cours avec ce budget ; null si le budget n'est pas positif. */
  enveloppeSemaine: Cents | null;
  /** On ne continue que si le budget du mois est supérieur à zéro. */
  peutContinuer: boolean;
}

const montantValide = (n: Cents | null): n is Cents =>
  n !== null && Number.isSafeInteger(n) && n >= 0;

/**
 * Ce que l'étape « Mon mois » affiche. L'enveloppe est calculée comme l'accueil la calculera :
 * la version du mois d'installation, en vigueur dès le lundi de la semaine d'installation
 * (comme `poserBudgetInitial`), reconduite aux mois suivants.
 */
export function apercuBudget(
  saisie: SaisieBudget,
  installDay: DayKey,
  today: DayKey,
): ApercuBudget {
  const { income, fixedCosts, savingsGoal } = saisie;
  if (!montantValide(income) || !montantValide(fixedCosts) || !montantValide(savingsGoal)) {
    return { budgetMois: null, enveloppeSemaine: null, peutContinuer: false };
  }
  const version = {
    id: 'apercu',
    month: installDay.slice(0, 7),
    income,
    fixedCosts,
    savingsGoal,
    effectiveFrom: weekDays(weekOf(installDay))[0],
  };
  const budgetMois = budgetOf(version);
  if (budgetMois <= 0) return { budgetMois, enveloppeSemaine: null, peutContinuer: false };
  return {
    budgetMois,
    enveloppeSemaine: weekEnvelope(weekOf(today), [version], installDay),
    peutContinuer: true,
  };
}

/** Pas du réglage de l'heure du rappel, en minutes. */
export const PAS_RAPPEL_MINUTES = 15;

const HEURE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Heure HH:MM de 00:00 à 23:59. */
export function heureValide(heure: string): boolean {
  return HEURE.test(heure);
}

/** Avance (ou recule) une heure HH:MM, en restant dans la journée : 23:45 + 15 min = 00:00. */
export function decalerHeure(heure: string, minutes: number): string {
  const m = HEURE.exec(heure);
  const total = m === null ? 21 * 60 : Number(m[1]) * 60 + Number(m[2]);
  const jour = 24 * 60;
  const n = (((total + minutes) % jour) + jour) % jour;
  const hh = String(Math.floor(n / 60)).padStart(2, '0');
  const mm = String(n % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}
