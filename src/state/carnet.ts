// Carnet (E9, J5.3, #102) : les dépenses passées par semaine, groupées par jour, avec les totaux
// par catégorie, un filtre par mois et le résultat figé des semaines scellées. Sélecteur pur :
// les dépenses, les résultats et l'heure lui sont passés.
import type { ExpenseRow } from '../data/repositories';
import type { Cents } from '../domain/budget';
import {
  type DayKey,
  type MonthKey,
  type WeekId,
  weekDays,
  weekMonth,
  weekOf,
  weeksOfMonth,
} from '../domain/calendrier';
import type { LocalDateTime, WeekResult } from '../domain/scellement';

export type CategorieCarnet = ExpenseRow['category'];

/** Ordre fixe des catégories, celui de la feuille « Noter une dépense » (E3). */
export const CATEGORIES_CARNET: readonly CategorieCarnet[] = [
  'essentiel',
  'envies',
  'culture',
  'imprevus',
];

export interface DepenseCarnet {
  id: string;
  montant: Cents;
  categorie: CategorieCarnet;
  note: string;
}

export interface JourCarnet {
  jour: DayKey;
  /** Dans l'ordre où elles ont été notées. */
  depenses: DepenseCarnet[];
  total: Cents;
}

export interface TotalCategorie {
  categorie: CategorieCarnet;
  total: Cents;
}

/** Résultat figé au scellement (week_result) : il ne bouge plus, même si une dépense change. */
export interface ResultatCarnet {
  tampons: number;
  joursDecomptes: number;
  enveloppe: Cents;
  depense: Cents;
  dansLeBudget: boolean;
}

export interface SemaineCarnet {
  semaine: WeekId;
  lundi: DayKey;
  dimanche: DayKey;
  /** Jours qui ont au moins une dépense, du plus récent au plus ancien. */
  jours: JourCarnet[];
  /** Les quatre catégories, dans l'ordre fixe, avec les montants actuels des dépenses. */
  totaux: TotalCategorie[];
  total: Cents;
  /** Null tant que la semaine n'est pas scellée. */
  resultat: ResultatCarnet | null;
}

export interface VueCarnet {
  mois: MonthKey;
  /** Mois proposés par le filtre, du plus ancien au plus récent. */
  moisDisponibles: MonthKey[];
  /** Semaines du mois, de la plus récente à la plus ancienne. */
  semaines: SemaineCarnet[];
}

/**
 * Mois du filtre : de celui de la semaine d'installation à celui de la semaine en cours. Une
 * semaine appartient au mois qui contient son jeudi (Objets et pièces).
 */
export function moisDuCarnet(installDay: DayKey, today: DayKey): MonthKey[] {
  const premier = weekMonth(weekOf(installDay));
  const dernier = weekMonth(weekOf(today));
  const mois: MonthKey[] = [];
  for (let m = premier; m <= dernier; m = moisSuivant(m)) mois.push(m);
  return mois;
}

function moisSuivant(mois: MonthKey): MonthKey {
  const [annee, numero] = mois.split('-').map(Number);
  return numero === 12
    ? `${String(annee + 1).padStart(4, '0')}-01`
    : `${String(annee).padStart(4, '0')}-${String(numero + 1).padStart(2, '0')}`;
}

/** Mois affiché par défaut : celui de la semaine en cours. */
export function moisCourantDuCarnet(today: DayKey): MonthKey {
  return weekMonth(weekOf(today));
}

/** Première dépense du jour `jour` ou après, dans des dépenses triées par jour. */
function premierIndex(depenses: readonly ExpenseRow[], jour: DayKey): number {
  let bas = 0;
  let haut = depenses.length;
  while (bas < haut) {
    const milieu = (bas + haut) >> 1;
    if (depenses[milieu].day < jour) bas = milieu + 1;
    else haut = milieu;
  }
  return bas;
}

function semaineDuCarnet(
  semaine: WeekId,
  depenses: readonly ExpenseRow[],
  resultat: WeekResult | undefined,
): SemaineCarnet {
  const jours = weekDays(semaine);
  const lundi = jours[0];
  const dimanche = jours[6];
  const parCategorie = new Map<CategorieCarnet, Cents>(CATEGORIES_CARNET.map((c) => [c, 0]));
  const parJour: JourCarnet[] = [];
  for (let i = premierIndex(depenses, lundi); i < depenses.length; i++) {
    const d = depenses[i];
    if (d.day > dimanche) break;
    let jour = parJour[parJour.length - 1];
    if (jour === undefined || jour.jour !== d.day) {
      jour = { jour: d.day, depenses: [], total: 0 };
      parJour.push(jour);
    }
    jour.depenses.push({ id: d.id, montant: d.amount, categorie: d.category, note: d.note });
    jour.total += d.amount;
    parCategorie.set(d.category, (parCategorie.get(d.category) ?? 0) + d.amount);
  }
  const totaux = CATEGORIES_CARNET.map((categorie) => ({
    categorie,
    total: parCategorie.get(categorie) ?? 0,
  }));
  return {
    semaine,
    lundi,
    dimanche,
    jours: parJour.reverse(),
    totaux,
    total: totaux.reduce((somme, t) => somme + t.total, 0),
    resultat:
      resultat === undefined
        ? null
        : {
            tampons: resultat.stamps,
            joursDecomptes: resultat.countedDays,
            enveloppe: resultat.envelope,
            depense: resultat.spent,
            dansLeBudget: resultat.inBudget,
          },
  };
}

/**
 * Le carnet d'un mois : ses semaines (celles dont le jeudi tombe dans le mois), de la semaine
 * d'installation à la semaine en cours, chacune entière. Les dépenses doivent être triées par
 * jour, comme le store les garde ; les montants affichés sont les montants actuels, et le
 * résultat des semaines scellées reste celui du scellement (scénario 15).
 */
export function vueCarnet(
  depenses: readonly ExpenseRow[],
  resultats: readonly WeekResult[],
  installDay: DayKey,
  now: LocalDateTime,
  mois: MonthKey,
): VueCarnet {
  const moisDisponibles = moisDuCarnet(installDay, now.day);
  const premiere = weekOf(installDay);
  const derniere = weekOf(now.day);
  const parSemaine = new Map(resultats.map((r) => [r.week, r]));
  const semaines = weeksOfMonth(mois)
    .filter((s) => s >= premiere && s <= derniere)
    .reverse()
    .map((s) => semaineDuCarnet(s, depenses, parSemaine.get(s)));
  return { mois, moisDisponibles, semaines };
}
