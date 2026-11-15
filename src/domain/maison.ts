// Modèle de scène de la maison (J4.1) : tout ce que le rendu de la maison sait de l'état.
// Pur : le jour courant et le catalogue sont passés en paramètre ; l'état reçu n'est jamais modifié.
import { type DayKey, type MonthKey } from './calendrier';
import { slotsInMonth } from './calendrier';
import { cracksOfYear, repairs } from './felure';
import { type Catalog, type ItemId, type OwnedItem, type RoomId, houseYear } from './objets';
import { type DustLevel, dustLevel } from './poussiere';
import { type AppState } from './traitement';

/** Un objet posé dans sa pièce. */
export interface SceneItem {
  itemId: ItemId;
  /** Base (emplacements 1 à 3) ou objet à gagner (emplacements 1 à 5). */
  source: OwnedItem['source'];
  /** Rang du catalogue : il fixe l'emplacement. */
  rank: number;
  state: OwnedItem['state'];
  /**
   * « Réparation : x jours sur 7 » : seulement pour l'objet en tête de la file de réparation de
   * l'année en cours ; null pour les autres, y compris les fêlés qui attendent leur tour.
   */
  repairDays: number | null;
}

/** Emplacement d'objet à gagner encore vide, avec l'objet du catalogue qui l'occupera. */
export interface FreeSlot {
  rank: number;
  itemId: ItemId;
}

export interface HouseScene {
  year: number;
  month: MonthKey;
  room: RoomId;
  /** Objets de base puis objets gagnés, chacun dans l'ordre de ses emplacements. */
  items: SceneItem[];
  /** Emplacements libres : 4 ou 5 selon les semaines du mois, moins les objets déjà gagnés. */
  freeSlots: FreeSlot[];
  /** Toujours 0 pour une année passée : l'album garde objets, fêlures et réparations. */
  dust: DustLevel;
}

const monthKey = (year: number, month: number): MonthKey =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;

const roomMonth = (catalog: Catalog, room: RoomId): number =>
  catalog.rooms.find((r) => r.id === room)?.month ?? Number(room.slice(5, 7));

/** Pièces débloquées d'une année, dans l'ordre des mois (glissement de l'accueil, album). */
export function houseRooms(state: AppState, catalog: Catalog, year: number): RoomId[] {
  return state.house.unlocked
    .filter((u) => u.year === year)
    .map((u) => u.room)
    .sort((a, b) => roomMonth(catalog, a) - roomMonth(catalog, b));
}

/**
 * Scène d'une pièce débloquée pour une année : objets placés (les objets en attente n'y sont pas),
 * emplacements libres, poussière et réparation en cours. null si la pièce n'est pas débloquée.
 */
export function houseScene(
  state: AppState,
  catalog: Catalog,
  year: number,
  room: RoomId,
  today: DayKey,
): HouseScene | null {
  if (!state.house.unlocked.some((u) => u.year === year && u.room === room)) return null;
  const currentYear = houseYear(today);
  const month = monthKey(year, roomMonth(catalog, room));

  // La file de réparation repart à zéro chaque année : seule l'année en cours progresse.
  const file =
    year === currentYear ? repairs(cracksOfYear(state.results, year), state.closedDays) : [];
  const tete = file.find((e) => e.repairedOn === null) ?? null;

  const rang = new Map(catalog.items.map((i) => [i.id, i.rank]));
  const placed = state.house.owned.filter(
    (o) => o.year === year && o.room === room && o.placedAt !== null,
  );
  const items: SceneItem[] = placed
    .map((o) => ({
      itemId: o.itemId,
      source: o.source,
      rank: rang.get(o.itemId) ?? 0,
      state: o.state,
      repairDays:
        tete !== null && o.state === 'cracked' && o.itemId === tete.itemId ? tete.progress : null,
    }))
    .sort((a, b) => (a.source === b.source ? a.rank - b.rank : a.source === 'base' ? -1 : 1));

  const obtenus = new Set(
    state.house.owned.filter((o) => o.year === year && o.room === room).map((o) => o.itemId),
  );
  const freeSlots = catalog.items
    .filter((i) => i.room === room && i.source === 'weekly')
    .sort((a, b) => a.rank - b.rank)
    .slice(0, slotsInMonth(month))
    .filter((i) => !obtenus.has(i.id))
    .map((i) => ({ rank: i.rank, itemId: i.id }));

  const dust =
    year === currentYear
      ? dustLevel(today, state.closedDays, state.results, state.installDay)
      : (0 as DustLevel);

  return { year, month, room, items, freeSlots, dust };
}
