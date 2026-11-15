// Sélecteurs de la maison (J4.1) : la scène que le rendu dessine, sa description pour le lecteur
// d'écran, les pièces de l'année et les années de l'album. Purs : l'état et l'heure leur sont passés.
import { type WeekId, weekMonth, weekOf } from '../domain/calendrier';
import { type HouseScene, houseRooms, houseScene } from '../domain/maison';
import {
  type Catalog,
  type ItemId,
  type RoomId,
  albumYears,
  houseYear,
  roomOfMonth,
} from '../domain/objets';
import { dustDays, dustFloor } from '../domain/poussiere';
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

/** La maison de l'accueil (E2, #84) : les pièces débloquées de l'année et celle à montrer. */
export interface VueMaisonAccueil {
  /** Pièces débloquées de l'année en cours, dans l'ordre des mois : le glissement. */
  pieces: VueMaison[];
  /** Pièce affichée d'abord : celle du mois en cours, ou la dernière débloquée avant elle. */
  courante: number;
  /** Pourquoi la poussière est là (Textes et ton) ; rien de vrai quand la maison est propre. */
  poussiere: { joursSansCloture: boolean; semaineIncomplete: boolean };
}

/**
 * Maison de l'accueil. Le mois en cours est celui de la semaine en cours (le mois de son jeudi,
 * comme pour les objets) : la pièce s'accorde à l'année de la maison, même autour du Nouvel An.
 * Tant que le bilan du mois précédent n'est pas validé, la pièce du mois attend : on montre la
 * dernière pièce débloquée avant elle. Null sans aucune pièce débloquée.
 */
export function maisonAccueil(
  etat: AppState,
  catalogue: Catalog,
  now: LocalDateTime,
): VueMaisonAccueil | null {
  const annee = houseYear(now.day);
  const pieces = piecesDeLAnnee(etat, catalogue, annee).flatMap((piece) => {
    const vue = vueMaison(etat, catalogue, annee, piece, now);
    return vue === null ? [] : [vue];
  });
  if (pieces.length === 0) return null;
  const mois = weekMonth(weekOf(now.day));
  const duMois = pieces.findIndex((p) => p.scene.room === roomOfMonth(mois));
  const avant = pieces.filter((p) => p.scene.month <= mois).length - 1;
  const courante = duMois >= 0 ? duMois : Math.max(0, avant);
  const sale = (pieces[courante]?.scene.dust ?? 0) > 0;
  return {
    pieces,
    courante,
    poussiere: {
      joursSansCloture: sale && dustDays(now.day, etat.closedDays, etat.installDay) >= 2,
      semaineIncomplete: sale && dustFloor(etat.results),
    },
  };
}

/**
 * Une pièce touchée par le bilan d'une semaine (E6, #84), en trois moments : avant le bilan,
 * après la fêlure (capsule encore fermée), puis avec l'objet de la capsule à son emplacement.
 * Le rendu anime le passage de l'un à l'autre (apparition, fêlure).
 */
export interface PieceDuBilan {
  piece: RoomId;
  /** Sans l'objet de la capsule, l'objet fêlé encore intact. */
  avant: VueMaison;
  /** L'objet fêlé l'est déjà ; l'objet de la capsule n'est pas encore là. */
  avantCapsule: VueMaison;
  /** La pièce telle qu'elle est. */
  apres: VueMaison;
  /** L'objet de la capsule entre dans cette pièce. */
  objet: boolean;
  /** L'objet fêlé de la semaine est dans cette pièce. */
  fele: boolean;
}

function sansObjet(scene: HouseScene, itemId: ItemId): HouseScene {
  const objet = scene.items.find((i) => i.itemId === itemId);
  if (objet === undefined) return scene;
  return {
    ...scene,
    items: scene.items.filter((i) => i.itemId !== itemId),
    freeSlots:
      objet.source === 'weekly'
        ? [...scene.freeSlots, { rank: objet.rank, itemId }].sort((a, b) => a.rank - b.rank)
        : scene.freeSlots,
  };
}

function intact(scene: HouseScene, itemId: ItemId): HouseScene {
  return {
    ...scene,
    items: scene.items.map((i) =>
      i.itemId === itemId ? { ...i, state: 'intact', repairDays: null } : i,
    ),
  };
}

/**
 * Pièces où le bilan d'une semaine fait entrer l'objet de la capsule ou fêle un objet : celle de
 * l'objet gagné d'abord, puis celle de l'objet fêlé si elle est autre. Un objet en attente de sa
 * pièce n'a pas de pièce : le bilan garde son message.
 */
export function piecesDuBilan(
  etat: AppState,
  catalogue: Catalog,
  semaine: WeekId,
  now: LocalDateTime,
): PieceDuBilan[] {
  const resultat = etat.results.find((r) => r.week === semaine);
  if (resultat === undefined) return [];
  const annee = Number(semaine.slice(0, 4));
  const place = (itemId: ItemId | null, week: WeekId | null) =>
    itemId === null
      ? undefined
      : etat.house.owned.find(
          (o) =>
            o.itemId === itemId &&
            o.year === annee &&
            o.placedAt !== null &&
            (week === null || o.week === week),
        );
  const gagne = place(resultat.gashaponItem, semaine);
  const fele = place(resultat.crackedItem, null);

  const pieces: RoomId[] = [];
  for (const o of [gagne, fele])
    if (o !== undefined && !pieces.includes(o.room)) pieces.push(o.room);

  return pieces.flatMap((piece) => {
    const apres = vueMaison(etat, catalogue, annee, piece, now);
    if (apres === null) return [];
    const objet = gagne?.room === piece;
    const estFele = fele?.room === piece;
    const capsuleFermee =
      objet && gagne !== undefined ? sansObjet(apres.scene, gagne.itemId) : apres.scene;
    const depart =
      estFele && fele !== undefined ? intact(capsuleFermee, fele.itemId) : capsuleFermee;
    const vue = (scene: HouseScene): VueMaison => ({
      scene,
      description: decrire(scene, catalogue),
    });
    return [
      {
        piece,
        avant: vue(depart),
        avantCapsule: vue(capsuleFermee),
        apres,
        objet,
        fele: estFele,
      },
    ];
  });
}
