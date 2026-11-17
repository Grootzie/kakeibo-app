// Carnet (E9, J5.3, #102) : les dépenses passées par semaine, groupées par jour, avec les totaux
// par catégorie, un filtre par mois et le résultat figé des semaines scellées. Sélecteur pur :
// les dépenses, les résultats et l'heure lui sont passés.
import type { ExpenseRow } from '../data/repositories';
import type { Cents } from '../domain/budget';
import {
  type DayKey,
  type MonthKey,
  type WeekId,
  addDays,
  weekDays,
  weekOf,
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
  /** Premier et dernier jours de la semaine qui tombent dans le mois affiché. */
  debut: DayKey;
  fin: DayKey;
  /** Vrai si la semaine déborde sur un autre mois : jours et totaux ne portent que sur debut..fin. */
  coupee: boolean;
  /** Jours qui ont au moins une dépense, du plus récent au plus ancien. */
  jours: JourCarnet[];
  /** Les quatre catégories, dans l'ordre fixe, avec les montants actuels des dépenses du mois. */
  totaux: TotalCategorie[];
  total: Cents;
  /** Null tant que la semaine n'est pas scellée. Porte sur la semaine entière, même coupée. */
  resultat: ResultatCarnet | null;
}

export interface VueCarnet {
  mois: MonthKey;
  /** Mois proposés par le filtre, du plus ancien au plus récent. */
  moisDisponibles: MonthKey[];
  /** Semaines qui ont au moins un jour dans le mois, de la plus récente à la plus ancienne. */
  semaines: SemaineCarnet[];
}

/** Mois du filtre : du mois du jour d'installation à celui d'aujourd'hui. */
export function moisDuCarnet(installDay: DayKey, today: DayKey): MonthKey[] {
  const premier = installDay.slice(0, 7);
  const dernier = today.slice(0, 7);
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

/** Mois affiché par défaut : celui d'aujourd'hui. */
export function moisCourantDuCarnet(today: DayKey): MonthKey {
  return today.slice(0, 7);
}

/** Dernier jour du mois. */
function finDuMois(mois: MonthKey): DayKey {
  return addDays(`${moisSuivant(mois)}-01`, -1);
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
  mois: MonthKey,
  depenses: readonly ExpenseRow[],
  resultat: WeekResult | undefined,
): SemaineCarnet {
  const jours = weekDays(semaine);
  const lundi = jours[0];
  const dimanche = jours[6];
  const premierDuMois = `${mois}-01`;
  const dernierDuMois = finDuMois(mois);
  const debut = lundi < premierDuMois ? premierDuMois : lundi;
  const fin = dimanche > dernierDuMois ? dernierDuMois : dimanche;
  const parCategorie = new Map<CategorieCarnet, Cents>(CATEGORIES_CARNET.map((c) => [c, 0]));
  const parJour: JourCarnet[] = [];
  for (let i = premierIndex(depenses, debut); i < depenses.length; i++) {
    const d = depenses[i];
    if (d.day > fin) break;
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
    debut,
    fin,
    coupee: debut !== lundi || fin !== dimanche,
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
 * Le carnet d'un mois : les semaines qui ont au moins un jour dans le mois, de la semaine
 * d'installation à la semaine en cours. Une semaine à cheval sur deux mois apparaît sous les
 * deux, coupée aux jours du mois ; son résultat figé, qui porte sur la semaine entière, s'affiche
 * sous les deux (#102). Les dépenses doivent être triées par
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
  const semaines: SemaineCarnet[] = [];
  const dernierDuMois = finDuMois(mois);
  for (let jour = `${mois}-01`; jour <= dernierDuMois; jour = addDays(jour, 7)) {
    const s = weekOf(jour);
    if (s >= premiere && s <= derniere)
      semaines.push(semaineDuCarnet(s, mois, depenses, parSemaine.get(s)));
  }
  // La dernière semaine du mois, si le pas de 7 jours l'a sautée.
  const s = weekOf(dernierDuMois);
  if (s >= premiere && s <= derniere && semaines.at(-1)?.semaine !== s)
    semaines.push(semaineDuCarnet(s, mois, depenses, parSemaine.get(s)));
  semaines.reverse();
  return { mois, moisDisponibles, semaines };
}
