// Sélecteurs de la maison (J4.1) : la scène que le rendu dessine, sa description pour le lecteur
// d'écran, les pièces de l'année et les années de l'album. Purs : l'état et l'heure leur sont passés.
import { type HouseScene, houseRooms, houseScene } from '../domain/maison';
import { type Catalog, type RoomId, albumYears, houseYear } from '../domain/objets';
import type { LocalDateTime } from '../domain/scellement';
import type { AppState } from '../domain/traitement';
import { fr } from '../i18n/fr';

export interface VueMaison {
  scene: HouseScene;
  /** Pièce, objets et leur état, emplacements libres, poussière : lus d'un seul tenant. */
  description: string;
}

function decrire(scene: HouseScene, catalogue: Catalog): string {
  const piece = catalogue.rooms.find((r) => r.id === scene.room);
  const morceaux = [fr.maison.piece(piece?.name ?? scene.room, scene.month, scene.year)];
  for (const objet of scene.items) {
    const item = catalogue.items.find((i) => i.id === objet.itemId);
    if (item === undefined) continue;
    morceaux.push(
      fr.maison.objet(
        { nom: item.name, article: item.article, genre: item.gender },
        objet.state,
        objet.repairDays,
      ),
    );
  }
  if (scene.freeSlots.length > 0)
    morceaux.push(fr.maison.emplacementsLibres(scene.freeSlots.length));
  morceaux.push(fr.maison.poussiere[scene.dust]);
  return fr.maison.description(morceaux);
}

/** Scène d'une pièce débloquée et sa description ; null si la pièce n'est pas débloquée. */
export function vueMaison(
  etat: AppState,
  catalogue: Catalog,
  annee: number,
  piece: RoomId,
  now: LocalDateTime,
): VueMaison | null {
  const scene = houseScene(etat, catalogue, annee, piece, now.day);
  return scene === null ? null : { scene, description: decrire(scene, catalogue) };
}

/** Pièces débloquées de l'année, dans l'ordre des mois : le glissement de l'accueil. */
export function piecesDeLAnnee(etat: AppState, catalogue: Catalog, annee: number): RoomId[] {
  return houseRooms(etat, catalogue, annee);
}

/** Années de l'album : les maisons passées, de la plus ancienne à la plus récente. */
export function anneesAlbum(etat: AppState, now: LocalDateTime): number[] {
  return albumYears(etat.house, houseYear(now.day));
}

/** Une maison de l'album : son année et chacune de ses pièces, telle qu'elle était à la fin. */
export interface MaisonAlbum {
  annee: number;
  pieces: VueMaison[];
}

/**
 * Album (E8, #87) : une maison par année passée, de la plus ancienne à la plus récente, chacune
 * avec ses pièces débloquées dans l'ordre des mois. Les objets gardent leur état de fin d'année ;
 * ni poussière ni réparation en cours (la file de réparation repart à zéro chaque année).
 */
export function vueAlbum(etat: AppState, catalogue: Catalog, now: LocalDateTime): MaisonAlbum[] {
  return anneesAlbum(etat, now).map((annee) => ({
    annee,
    pieces: piecesDeLAnnee(etat, catalogue, annee).flatMap((piece) => {
      const vue = vueMaison(etat, catalogue, annee, piece, now);
      return vue === null ? [] : [vue];
    }),
  }));
}
