// Objets et pièces : catalogue, objet suivant, déblocage, objet en attente, nouvelle année (J1.4).
// Pur : le catalogue et l'heure (instant ISO opaque) sont passés en paramètre.
import { type MonthKey, type WeekId, weekMonth, weekOf, slotsInMonth } from './calendrier';

export type RoomId = string; // 'room-01' à 'room-12'
export type ItemId = string;
export type Instant = string; // instant ISO 8601, jamais lu comme une horloge

export interface CatalogRoom {
  id: RoomId;
  /** 1 pour janvier, 12 pour décembre. */
  month: number;
  name: string;
  /** Fête ou saison du mois, telle que le tableau de la spec la nomme. */
  feast: string;
}

export interface CatalogItem {
  id: ItemId;
  room: RoomId;
  /** Fixe l'emplacement : 1 à 3 pour la base, 1 à 5 pour les objets à gagner. */
  rank: number;
  source: 'base' | 'weekly';
  name: string;
}

export interface Catalog {
  rooms: CatalogRoom[];
  items: CatalogItem[];
}

export interface OwnedItem {
  /** Année de la maison (année ISO). Les années passées forment l'album. */
  year: number;
  room: RoomId;
  itemId: ItemId;
  source: 'base' | 'weekly';
  week: WeekId | null;
  acquiredAt: Instant;
  /** Vide tant que l'objet attend sa pièce. */
  placedAt: Instant | null;
  state: 'intact' | 'cracked' | 'repaired';
}

export interface UnlockedRoom {
  year: number;
  room: RoomId;
  unlockedAt: Instant;
}

export interface HouseState {
  owned: OwnedItem[];
  unlocked: UnlockedRoom[];
}

export function roomOfMonth(month: MonthKey): RoomId {
  return `room-${month.slice(5, 7)}`;
}

/** Année de la maison : l'année ISO de la semaine du jour. */
export function houseYear(day: string): number {
  return Number(weekOf(day).slice(0, 4));
}

function itemsOf(catalog: Catalog, room: RoomId, source: 'base' | 'weekly'): CatalogItem[] {
  return catalog.items
    .filter((i) => i.room === room && i.source === source)
    .sort((a, b) => a.rank - b.rank);
}

function monthOfRoom(catalog: Catalog, room: RoomId, year: number): MonthKey {
  const salle = catalog.rooms.find((r) => r.id === room);
  const mois = salle ? salle.month : Number(room.slice(5, 7));
  return `${String(year).padStart(4, '0')}-${String(mois).padStart(2, '0')}`;
}

/**
 * Prochain objet à gagner de la pièce pour cette année : le premier non obtenu dans l'ordre du
 * catalogue, parmi les emplacements que le mois offre cette année-là (4 ou 5).
 */
export function nextItem(
  catalog: Catalog,
  room: RoomId,
  year: number,
  owned: OwnedItem[],
): ItemId | null {
  const emplacements = slotsInMonth(monthOfRoom(catalog, room, year));
  const obtenus = new Set(
    owned.filter((o) => o.year === year && o.room === room).map((o) => o.itemId),
  );
  const suivant = itemsOf(catalog, room, 'weekly')
    .slice(0, emplacements)
    .find((i) => !obtenus.has(i.id));
  return suivant ? suivant.id : null;
}

const isUnlocked = (state: HouseState, year: number, room: RoomId): boolean =>
  state.unlocked.some((u) => u.year === year && u.room === room);

/** Ouvre une pièce : ses 3 objets de base arrivent, les objets en attente y entrent. */
function openRoom(
  catalog: Catalog,
  state: HouseState,
  room: RoomId,
  year: number,
  at: Instant,
): HouseState {
  if (isUnlocked(state, year, room)) return state;
  const attente = state.owned.map((o) =>
    o.year === year && o.room === room && o.placedAt === null ? { ...o, placedAt: at } : o,
  );
  const base: OwnedItem[] = itemsOf(catalog, room, 'base').map((i) => ({
    year,
    room,
    itemId: i.id,
    source: 'base',
    week: null,
    acquiredAt: at,
    placedAt: at,
    state: 'intact',
  }));
  return {
    owned: [...attente, ...base],
    unlocked: [...state.unlocked, { year, room, unlockedAt: at }],
  };
}

/** À l'installation, la pièce du mois de la semaine en cours s'ouvre avec ses objets de base. */
export function installHouse(catalog: Catalog, installDay: string, at: Instant): HouseState {
  const month = weekMonth(weekOf(installDay));
  return openRoom(
    catalog,
    { owned: [], unlocked: [] },
    roomOfMonth(month),
    houseYear(installDay),
    at,
  );
}

export interface WeeklyAward {
  state: HouseState;
  itemId: ItemId | null;
  /** Vrai si la pièce n'est pas encore débloquée : l'objet attend. */
  pending: boolean;
}

/** Objet de la semaine : l'objet suivant de la pièce du mois du jeudi, sans hasard. */
export function awardWeeklyItem(
  catalog: Catalog,
  state: HouseState,
  week: WeekId,
  at: Instant,
): WeeklyAward {
  const month = weekMonth(week);
  const year = Number(month.slice(0, 4));
  const room = roomOfMonth(month);
  const itemId = nextItem(catalog, room, year, state.owned);
  if (itemId === null) return { state, itemId: null, pending: false };
  const pending = !isUnlocked(state, year, room);
  const objet: OwnedItem = {
    year,
    room,
    itemId,
    source: 'weekly',
    week,
    acquiredAt: at,
    placedAt: pending ? null : at,
    state: 'intact',
  };
  return { state: { ...state, owned: [...state.owned, objet] }, itemId, pending };
}

export interface MonthReviewValidation {
  /** Mois dont le bilan est validé. */
  month: MonthKey;
  /** Dernier bilan validé avant celui-ci, s'il existe. */
  previousReview: MonthKey | null;
  installDay: string;
  at: Instant;
}

/**
 * Valider un bilan débloque la pièce du mois suivant et celles des mois sautés depuis le bilan
 * précédent (ou depuis l'installation), dans la même année. En décembre, rien ne se débloque pour
 * l'année suivante : janvier s'ouvre avec la nouvelle année.
 */
export function validateMonthReview(
  catalog: Catalog,
  state: HouseState,
  review: MonthReviewValidation,
): HouseState {
  const annee = Number(review.month.slice(0, 4));
  const mois = Number(review.month.slice(5, 7));
  const depart = review.previousReview ?? weekMonth(weekOf(review.installDay));
  const moisDepart = Number(depart.slice(0, 4)) < annee ? 0 : Number(depart.slice(5, 7));
  const premier = moisDepart + 1;
  const dernier = Math.min(mois + 1, 12);
  let suite = state;
  for (let m = premier; m <= dernier; m++) {
    const cle = `${String(annee).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
    suite = openRoom(catalog, suite, roomOfMonth(cle), annee, review.at);
  }
  return suite;
}

/** Nouvelle année : janvier s'ouvre sans attendre le bilan de décembre ; l'année écoulée reste telle quelle. */
export function openNewYear(
  catalog: Catalog,
  state: HouseState,
  year: number,
  at: Instant,
): HouseState {
  return openRoom(catalog, state, roomOfMonth(`${String(year).padStart(4, '0')}-01`), year, at);
}

/** Les années passées de l'album, de la plus ancienne à la plus récente. */
export function albumYears(state: HouseState, currentYear: number): number[] {
  const annees = new Set(state.owned.map((o) => o.year).filter((a) => a < currentYear));
  return [...annees].sort((a, b) => a - b);
}
