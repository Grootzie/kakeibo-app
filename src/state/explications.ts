// Cartes de première fois (E12, Messages d'explication) : chacune s'affiche une seule fois, au
// moment indiqué. Celles de J2 : première dépense, premier tampon, premier jour à rattraper.
// Les cartes déjà vues sont gardées dans settings.seen_explanations (tableau JSON d'identifiants).
// Purs : l'état, l'heure et les cartes vues leur sont passés.
import type { LocalDateTime } from '../domain/scellement';
import type { AppState } from '../domain/traitement';
import { jourARattraper } from './selecteurs';

/** Identifiants techniques des cartes de J2, dans l'ordre où elles passent si plusieurs attendent. */
export const EXPLICATIONS_J2 = ['first_expense', 'first_stamp', 'first_catch_up'] as const;

export type IdExplication = (typeof EXPLICATIONS_J2)[number];

const MOMENTS: Record<IdExplication, (etat: AppState, now: LocalDateTime) => boolean> = {
  first_expense: (etat) => etat.expenses.length > 0,
  first_stamp: (etat) => etat.closedDays.length > 0,
  first_catch_up: (etat, now) => jourARattraper(etat, now) !== null,
};

/**
 * Carte à afficher maintenant : la première, parmi `proposees`, dont le moment est venu et qui
 * n'a jamais été vue. Null s'il n'y en a pas.
 */
export function explicationAAfficher(
  etat: AppState,
  now: LocalDateTime,
  vues: readonly string[],
  proposees: readonly IdExplication[] = EXPLICATIONS_J2,
): IdExplication | null {
  return proposees.find((id) => !vues.includes(id) && MOMENTS[id](etat, now)) ?? null;
}

/** settings.seen_explanations -> identifiants ; une valeur illisible compte comme vide. */
export function lireExplicationsVues(json: string): string[] {
  try {
    const valeur: unknown = JSON.parse(json);
    return Array.isArray(valeur) ? valeur.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function ecrireExplicationsVues(vues: readonly string[]): string {
  return JSON.stringify(vues);
}
