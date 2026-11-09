// Sélecteurs de l'accueil (E2). Purs : l'état et l'heure leur sont passés.
import type { ExpenseRow } from '../data/repositories';
import { type Cents, weekEnvelope, weekSpent } from '../domain/budget';
import { addDays, weekDays, weekOf } from '../domain/calendrier';
import { expenseDays } from '../domain/depense';
import {
  type ClosureContext,
  type DayKey,
  type LocalDateTime,
  type WeekId,
  canAddExpense,
  canCloseDay,
} from '../domain/scellement';
import type { MonthReview } from '../domain/bilanMois';
import type { MonthKey } from '../domain/calendrier';
import type { Catalog } from '../domain/objets';
import { type AppState, type WeekReviewScreen, weekReviewScreen } from '../domain/traitement';

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

const contexte = (etat: AppState): ClosureContext => ({
  installDay: etat.installDay,
  closedDays: etat.closedDays,
  sealedWeeks: etat.results.map((r) => r.week),
});

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
 * Jour rattrapable (E5) : jour passé, décompté, non clôturé, d'une semaine encore ouverte (la
 * semaine en cours, ou la précédente jusqu'au lundi 12:00 qui la suit).
 */
export function estRattrapable(etat: AppState, jour: DayKey, now: LocalDateTime): boolean {
  return jour < now.day && canCloseDay(jour, now, contexte(etat)).ok;
}

/**
 * Jour à rattraper le plus ancien : jour passé, décompté, non clôturé, d'une semaine encore
 * ouverte (la semaine en cours, ou la précédente jusqu'au lundi 12:00). Null s'il n'y en a pas.
 */
export function jourARattraper(etat: AppState, now: LocalDateTime): DayKey | null {
  const lundiPrecedent = addDays(weekDays(weekOf(now.day))[0], -7);
  for (let jour = lundiPrecedent; jour < now.day; jour = addDays(jour, 1)) {
    if (estRattrapable(etat, jour, now)) return jour;
  }
  return null;
}

/** Jours proposés pour dater une nouvelle dépense (E3), du plus récent au plus ancien. */
export function joursDepense(etat: AppState, now: LocalDateTime): DayKey[] {
  return expenseDays(now, contexte(etat)).reverse();
}

/** Bilans que process a préparés (étape 5 de l'ordre de traitement) et pas encore faits. */
export interface BilansAAfficher {
  /** Semaines scellées pas encore vues : écran « une semaine » ou « récapitulatif » (E6). */
  semaines: WeekReviewScreen | null;
  /** Mois terminé dont le bilan (E7) attend, avec ses chiffres (Q1 à Q3). */
  mois: MonthKey | null;
  chiffresMois: MonthReview | null;
}

export function bilansAAfficher(etat: AppState): BilansAAfficher {
  return {
    semaines: weekReviewScreen(etat),
    mois: etat.monthToReview,
    chiffresMois: etat.monthReview,
  };
}

/** Mois civil précédent : '2026-12' -> '2026-11', '2027-01' -> '2026-12'. */
function moisPrecedent(mois: MonthKey): MonthKey {
  const [a, m] = mois.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * Résolution du mois en cours : la Q4 du bilan du mois précédent, affichée tout le mois (E7).
 * Null si ce bilan n'est pas fait ou si sa Q4 est restée vide.
 */
export function resolutionDuMois(
  etat: AppState,
  now: LocalDateTime,
): { mois: MonthKey; resolution: string } | null {
  const mois = now.day.slice(0, 7);
  const bilan = etat.reviews.find((r) => r.month === moisPrecedent(mois));
  const resolution = bilan?.resolution.trim() ?? '';
  return resolution === '' ? null : { mois, resolution };
}

/** Bandeau unique de l'accueil (E2). */
export type BandeauAccueil =
  | { type: 'bilan_semaine'; ecran: WeekReviewScreen }
  | { type: 'bilan_mois'; mois: MonthKey }
  | { type: 'jour_a_rattraper'; jour: DayKey }
  | { type: 'resolution'; mois: MonthKey; resolution: string };

/**
 * Un seul bandeau à la fois, par ordre de priorité : bilan de la semaine prêt, bilan du mois
 * prêt, jour à rattraper, résolution du mois.
 */
export function bandeauAccueil(etat: AppState, now: LocalDateTime): BandeauAccueil | null {
  const bilans = bilansAAfficher(etat);
  if (bilans.semaines !== null) return { type: 'bilan_semaine', ecran: bilans.semaines };
  if (bilans.mois !== null) return { type: 'bilan_mois', mois: bilans.mois };
  const jour = jourARattraper(etat, now);
  if (jour !== null) return { type: 'jour_a_rattraper', jour };
  const resolution = resolutionDuMois(etat, now);
  return resolution === null ? null : { type: 'resolution', ...resolution };
}

/** Tout ce que l'accueil (E2) affiche, hors maison. */
export interface VueAccueil {
  jour: DayKey;
  enveloppe: EnveloppeSemaine;
  cases: CaseTampon[];
  aujourdhuiCloture: boolean;
  bandeau: BandeauAccueil | null;
}

export function vueAccueil(etat: AppState, now: LocalDateTime): VueAccueil {
  return {
    jour: now.day,
    enveloppe: enveloppeSemaine(etat, now),
    cases: casesSemaine(etat, now),
    aujourdhuiCloture: etat.closedDays.includes(now.day),
    bandeau: bandeauAccueil(etat, now),
  };
}

type Categorie = ExpenseRow['category'];
const CATEGORIES: Categorie[] = ['essentiel', 'envies', 'culture', 'imprevus'];

/** Total des catégories qui ont au moins une dépense, dans l'ordre des catégories. */
function totauxParCategorie(lignes: ExpenseRow[]): { categorie: Categorie; total: Cents }[] {
  return CATEGORIES.map((categorie) => ({
    categorie,
    total: lignes.filter((d) => d.category === categorie).reduce((t, d) => t + d.amount, 0),
  })).filter((t) => t.total > 0);
}

/** Ce que le bilan du mois (E7) affiche avant la validation. */
export interface VueBilanMois {
  mois: MonthKey;
  /** Q1 à Q3, épargne réelle et objectif, tels que le domaine les calcule ; null sans budget. */
  chiffres: MonthReview | null;
  /** Détail de Q3 : dépenses datées du mois, par catégorie. */
  parCategorie: { categorie: Categorie; total: Cents }[];
}

/** Bilan du mois proposé par process ; null s'il n'y en a pas à faire. */
export function vueBilanMois(etat: AppState, lignes: ExpenseRow[]): VueBilanMois | null {
  const mois = etat.monthToReview;
  if (mois === null) return null;
  return {
    mois,
    chiffres: etat.monthReview,
    parCategorie: totauxParCategorie(lignes.filter((d) => d.day.slice(0, 7) === mois)),
  };
}

/**
 * Pièces ouvertes par la validation du bilan de ce mois (celle du mois suivant et celles des
 * mois sautés), dans l'ordre des mois, avec la fête de leur mois. Vide en décembre.
 */
export function piecesOuvertesParBilan(
  etat: AppState,
  mois: MonthKey,
  catalogue: Catalog,
): { mois: MonthKey; fete: string }[] {
  const bilan = etat.reviews.find((r) => r.month === mois);
  if (bilan === undefined) return [];
  const annee = Number(mois.slice(0, 4));
  return catalogue.rooms
    .filter((salle) =>
      etat.house.unlocked.some(
        (u) => u.year === annee && u.room === salle.id && u.unlockedAt === bilan.validatedAt,
      ),
    )
    .sort((a, b) => a.month - b.month)
    .map((salle) => ({
      mois: `${mois.slice(0, 4)}-${String(salle.month).padStart(2, '0')}`,
      fete: salle.feast,
    }));
}

/** Ce que l'écran « Clôturer ma journée » (E4) affiche pour un jour. */
export interface VueCloture {
  jour: DayKey;
  /** Jour passé : l'écran devient « Rattraper mercredi 4 novembre » (E5). */
  rattrapage: boolean;
  /** Dépenses du jour, dans l'ordre où elles ont été notées. */
  depenses: ExpenseRow[];
  /** Total des catégories qui ont au moins une dépense, dans l'ordre des catégories. */
  totaux: { categorie: Categorie; total: Cents }[];
  total: Cents;
  /** Libellé du bouton : « J'ai tout noté » ou « Rien dépensé aujourd'hui ». */
  validation: 'tout_note' | 'rien_depense';
  cloture: boolean;
  peutCloturer: boolean;
  /** « Ajouter une dépense oubliée » : tant que la semaine du jour est ouverte. */
  peutAjouter: boolean;
}

export function vueCloture(
  etat: AppState,
  lignes: ExpenseRow[],
  jour: DayKey,
  now: LocalDateTime,
): VueCloture {
  const depenses = lignes.filter((d) => d.day === jour);
  const totaux = totauxParCategorie(depenses);
  const ctx = contexte(etat);
  return {
    jour,
    rattrapage: jour < now.day,
    depenses,
    totaux,
    total: totaux.reduce((t, x) => t + x.total, 0),
    validation: depenses.length > 0 ? 'tout_note' : 'rien_depense',
    cloture: etat.closedDays.includes(jour),
    peutCloturer: canCloseDay(jour, now, ctx).ok,
    peutAjouter: canAddExpense(jour, now, ctx).ok,
  };
}
