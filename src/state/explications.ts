// Cartes de première fois (E12, Messages d'explication) : chacune s'affiche une seule fois, au
// moment indiqué. Celles de J2 : première dépense, premier tampon, premier jour à rattraper ; leur
// moment se lit dans l'état. Celles de J3 (#66) naissent d'un écran (bilan, clôture qui répare) :
// c'est l'écran qui dit si leur moment est venu. Celles de J5 (#107) : les trois de la bienvenue
// naissent de l'étape de E1 ; « Nouvelle année » se lit dans l'état, dès le lundi de la semaine 1.
// Les cartes déjà vues sont gardées dans settings.seen_explanations (tableau JSON d'identifiants).
// Purs : l'état, l'heure et les cartes vues leur sont passés.
import { houseYear } from '../domain/objets';
import type { LocalDateTime } from '../domain/scellement';
import type { AppState } from '../domain/traitement';
import { jourARattraper } from './selecteurs';

/** Identifiants techniques des cartes de J2, dans l'ordre où elles passent si plusieurs attendent. */
export const EXPLICATIONS_J2 = ['first_expense', 'first_stamp', 'first_catch_up'] as const;

/** Cartes de J3, dans l'ordre où elles passent si plusieurs attendent sur un même écran. */
export const EXPLICATIONS_J3 = [
  'first_capsule',
  'first_dust',
  'first_crack',
  'first_repair',
  'first_month_review',
  'new_room',
] as const;

/** Cartes de la bienvenue (E1), une par étape : c'est l'étape qui dit si leur moment est venu. */
export const EXPLICATIONS_BIENVENUE = [
  'welcome_method',
  'welcome_categories',
  'welcome_month',
] as const;

/** Cartes de l'accueil : « Nouvelle année » passe avant celles de J2. */
export const EXPLICATIONS_ACCUEIL = ['new_year', ...EXPLICATIONS_J2] as const;

export type IdExplication =
  | (typeof EXPLICATIONS_BIENVENUE)[number]
  | (typeof EXPLICATIONS_ACCUEIL)[number]
  | (typeof EXPLICATIONS_J3)[number];

/** Les 13 cartes de la spec (E12, Messages d'explication), dans leur ordre. */
export const TOUTES_LES_EXPLICATIONS = [
  ...EXPLICATIONS_BIENVENUE,
  'first_expense',
  'first_stamp',
  'first_capsule',
  'first_catch_up',
  'first_dust',
  'first_crack',
  'first_repair',
  'first_month_review',
  'new_room',
  'new_year',
] as const satisfies readonly IdExplication[];

/** Moments que l'écran constate : vrai si la carte a sa place maintenant. */
export type MomentsEcran = Partial<Record<IdExplication, boolean>>;

const MOMENTS: Partial<Record<IdExplication, (etat: AppState, now: LocalDateTime) => boolean>> = {
  first_expense: (etat) => etat.expenses.length > 0,
  first_stamp: (etat) => etat.closedDays.length > 0,
  first_catch_up: (etat, now) => jourARattraper(etat, now) !== null,
  // Une nouvelle année a commencé depuis l'installation : la semaine 1 (ISO 8601) est arrivée.
  new_year: (etat, now) => houseYear(now.day) > houseYear(etat.installDay),
};

/**
 * Carte à afficher maintenant : la première, parmi `proposees`, dont le moment est venu (dit par
 * l'écran, sinon lu dans l'état) et qui n'a jamais été vue. Null s'il n'y en a pas.
 */
export function explicationAAfficher(
  etat: AppState,
  now: LocalDateTime,
  vues: readonly string[],
  proposees: readonly IdExplication[] = EXPLICATIONS_J2,
  moments: MomentsEcran = {},
): IdExplication | null {
  const venu = (id: IdExplication): boolean => moments[id] ?? MOMENTS[id]?.(etat, now) ?? false;
  return proposees.find((id) => !vues.includes(id) && venu(id)) ?? null;
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
