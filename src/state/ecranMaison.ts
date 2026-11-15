// La maison (E8, J4.6, #85) : ce que l'écran affiche, pièce par pièce. Pur : l'état, le catalogue
// et l'heure lui sont passés. La réparation en cours vient du modèle de scène (J4.1) : l'écran ne
// recalcule aucune règle.
import { type MonthKey, previousMonth } from '../domain/calendrier';
import { type Catalog, type ItemId, type OwnedItem, houseYear } from '../domain/objets';
import type { LocalDateTime } from '../domain/scellement';
import type { AppState } from '../domain/traitement';
import type { NomObjet } from '../i18n/fr';
import { type VueMaison, piecesDeLAnnee, vueMaison } from './maison';

/**
 * Réparation d'un objet fêlé : en cours pour l'objet en tête de la file (« Réparation : 4 jours
 * sur 7 »), en attente de son tour pour les suivants ; null pour un objet intact ou réparé.
 */
export type Reparation = { type: 'enCours'; jours: number } | { type: 'enAttente' } | null;

/** Un objet posé dans sa pièce, tel que la liste de l'écran le montre. */
export interface ObjetDeLaMaison {
  itemId: ItemId;
  nom: NomObjet;
  etat: OwnedItem['state'];
  reparation: Reparation;
}

export interface PieceDeLaMaison {
  /** Scène dessinée par le composant de rendu, et sa description. */
  vue: VueMaison;
  /** Objets de base puis objets gagnés, dans l'ordre de leurs emplacements. */
  objets: ObjetDeLaMaison[];
  /** Emplacements d'objets à gagner encore vides. */
  libres: number;
}

/** Objet gagné dont la pièce n'est pas encore débloquée (Objets et pièces). */
export interface ObjetEnAttente {
  itemId: ItemId;
  nom: NomObjet;
  /** Mois de la pièce qui l'accueillera, et bilan du mois qui l'ouvrira. */
  moisPiece: MonthKey;
  moisBilan: MonthKey;
}

export interface VueEcranMaison {
  annee: number;
  /** Pièces débloquées de l'année en cours, dans l'ordre des mois. */
  pieces: PieceDeLaMaison[];
  enAttente: ObjetEnAttente[];
}

function nomObjet(catalogue: Catalog, id: ItemId): NomObjet | null {
  const item = catalogue.items.find((i) => i.id === id);
  return item === undefined ? null : { nom: item.name, article: item.article, genre: item.gender };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** E8 : la maison de l'année en cours, pièce par pièce, et les objets qui attendent leur pièce. */
export function vueEcranMaison(
  etat: AppState,
  catalogue: Catalog,
  now: LocalDateTime,
): VueEcranMaison {
  const annee = houseYear(now.day);
  const pieces = piecesDeLAnnee(etat, catalogue, annee).flatMap((piece): PieceDeLaMaison[] => {
    const vue = vueMaison(etat, catalogue, annee, piece, now);
    if (vue === null) return [];
    const objets = vue.scene.items.flatMap((item): ObjetDeLaMaison[] => {
      const nom = nomObjet(catalogue, item.itemId);
      if (nom === null) return [];
      const reparation: Reparation =
        item.state !== 'cracked'
          ? null
          : item.repairDays === null
            ? { type: 'enAttente' }
            : { type: 'enCours', jours: item.repairDays };
      return [{ itemId: item.itemId, nom, etat: item.state, reparation }];
    });
    return [{ vue, objets, libres: vue.scene.freeSlots.length }];
  });

  const enAttente = etat.house.owned
    .filter((o) => o.year === annee && o.placedAt === null)
    .flatMap((o): ObjetEnAttente[] => {
      const nom = nomObjet(catalogue, o.itemId);
      const mois = catalogue.rooms.find((r) => r.id === o.room)?.month;
      if (nom === null || mois === undefined) return [];
      const moisPiece = `${annee}-${pad(mois)}`;
      return [{ itemId: o.itemId, nom, moisPiece, moisBilan: previousMonth(moisPiece) }];
    });

  return { annee, pieces, enAttente };
}
