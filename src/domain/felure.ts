// Fêlure, file de réparation et réparation à l'or (J1.6).
// Pur : ni horloge ni hasard ; les clôtures et les résultats de semaine sont passés en paramètre.
import { type DayKey, type WeekId, addDays, weekDays } from './calendrier';
import { type Catalog, type HouseState, type ItemId, type OwnedItem } from './objets';
import { type WeekResult } from './scellement';

/** Jours consécutifs, clôturés, qui réparent un objet à l'or. */
export const REPAIR_DAYS = 7;

/** Rang de l'objet dans l'ordre du catalogue (pièce, puis base avant objets à gagner, puis rang). */
function catalogIndex(catalog: Catalog, itemId: ItemId): number {
  const i = catalog.items.findIndex((it) => it.id === itemId);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

/**
 * Objet qui se fêle quand la semaine est hors budget : l'objet intact obtenu le plus récemment dans
 * l'année, hors objet gagné au même bilan ; à date égale, le dernier dans l'ordre du catalogue.
 * null s'il n'y en a aucun.
 */
export function crackTarget(
  catalog: Catalog,
  owned: OwnedItem[],
  year: number,
  excludedItem: ItemId | null,
): ItemId | null {
  const candidats = owned.filter(
    (o) => o.year === year && o.state === 'intact' && o.itemId !== excludedItem,
  );
  let meilleur: OwnedItem | null = null;
  for (const o of candidats) {
    if (meilleur === null) {
      meilleur = o;
      continue;
    }
    const t = Date.parse(o.acquiredAt);
    const tm = Date.parse(meilleur.acquiredAt);
    if (
      t > tm ||
      (t === tm && catalogIndex(catalog, o.itemId) > catalogIndex(catalog, meilleur.itemId))
    ) {
      meilleur = o;
    }
  }
  return meilleur ? meilleur.itemId : null;
}

const withState = (
  house: HouseState,
  itemId: ItemId,
  from: OwnedItem['state'],
  to: OwnedItem['state'],
): HouseState => {
  let touche = false;
  const owned = house.owned.map((o) => {
    if (o.itemId === itemId && o.state === from && !touche) {
      touche = true;
      return { ...o, state: to };
    }
    return o;
  });
  return touche ? { ...house, owned } : house;
};

/** Fêle un objet intact. Un objet déjà fêlé ou réparé ne change pas : un objet réparé ne se fêle plus. */
export function applyCrack(house: HouseState, itemId: ItemId): HouseState {
  return withState(house, itemId, 'intact', 'cracked');
}

/** Un objet fêlé et sa semaine fautive, dans l'ordre où les objets se sont fêlés. */
export interface Crack {
  itemId: ItemId;
  week: WeekId;
}

export interface RepairEvent {
  itemId: ItemId;
  week: WeekId;
  /** Premier jour qui compte pour la réparation. */
  startDay: DayKey;
  /** Dernier jour de la série de 7 jours : jour de la réparation, ou null si pas encore réparé. */
  repairedOn: DayKey | null;
  /** Longueur de la série affichée « Réparation : x jours sur 7 » (7 une fois réparé). */
  progress: number;
}

/** Fêlures d'une année, tirées des résultats de semaine scellés, de la plus ancienne à la plus récente. */
export function cracksOfYear(results: WeekResult[], year: number): Crack[] {
  return results
    .filter((r) => r.crackedItem !== null && Number(r.week.slice(0, 4)) === year)
    .sort((a, b) => (a.week < b.week ? -1 : a.week > b.week ? 1 : 0))
    .map((r) => ({ itemId: r.crackedItem as ItemId, week: r.week }));
}

/** Lundi qui suit la semaine fautive. */
const mondayAfter = (week: WeekId): DayKey => addDays(weekDays(week)[6], 1);

/** Longueur de la série de jours clôturés qui se termine au dernier jour clôturé, sans remonter avant startDay. */
export function repairProgress(startDay: DayKey, closedDays: DayKey[]): number {
  const jours = new Set(closedDays.filter((d) => d >= startDay));
  if (jours.size === 0) return 0;
  const dernier = [...jours].sort().pop() as DayKey;
  let n = 0;
  for (let j = dernier; jours.has(j); j = addDays(j, -1)) n++;
  return n;
}

/** Premier jour où 7 jours consécutifs, tous ≥ startDay, sont clôturés ; null sinon. */
function completionDay(startDay: DayKey, closedDays: DayKey[]): DayKey | null {
  const jours = [...new Set(closedDays.filter((d) => d >= startDay))].sort();
  let serie = 0;
  let precedent: DayKey | null = null;
  for (const j of jours) {
    serie = precedent !== null && addDays(precedent, 1) === j ? serie + 1 : 1;
    if (serie === REPAIR_DAYS) return j;
    precedent = j;
  }
  return null;
}

/**
 * File de réparation : les objets sont réparés un par un, dans l'ordre où ils se sont fêlés.
 * Départ du premier : le lundi qui suit sa semaine fautive ; des suivants : le lendemain de la
 * réparation précédente, ou le lundi qui suit leur propre semaine si ce lundi est plus tardif.
 * Un objet dont la réparation précédente n'est pas finie n'avance pas.
 */
export function repairs(cracks: Crack[], closedDays: DayKey[]): RepairEvent[] {
  const file = cracks
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (a.c.week < b.c.week ? -1 : a.c.week > b.c.week ? 1 : a.i - b.i))
    .map((x) => x.c);
  const events: RepairEvent[] = [];
  let precedent: RepairEvent | null = null;
  for (const crack of file) {
    const propre = mondayAfter(crack.week);
    let startDay = propre;
    if (precedent !== null) {
      const lendemain = precedent.repairedOn === null ? null : addDays(precedent.repairedOn, 1);
      // Tant que le précédent n'est pas réparé, le suivant n'a pas commencé.
      startDay = lendemain === null ? '9999-12-31' : lendemain > propre ? lendemain : propre;
    }
    const repairedOn = startDay === '9999-12-31' ? null : completionDay(startDay, closedDays);
    const progress =
      startDay === '9999-12-31'
        ? 0
        : repairedOn !== null
          ? REPAIR_DAYS
          : repairProgress(startDay, closedDays);
    const event: RepairEvent = {
      itemId: crack.itemId,
      week: crack.week,
      startDay,
      repairedOn,
      progress,
    };
    events.push(event);
    precedent = event;
  }
  return events;
}

/** Passe à l'or les objets dont la réparation est terminée. */
export function applyRepairs(house: HouseState, events: RepairEvent[]): HouseState {
  return events
    .filter((e) => e.repairedOn !== null)
    .reduce((h, e) => withState(h, e.itemId, 'cracked', 'repaired'), house);
}
