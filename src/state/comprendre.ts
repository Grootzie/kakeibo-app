// Comprendre (E12, J5.7, #106) : tout ce qui a été expliqué une fois reste consultable. Les fiches
// reprennent les textes de « Messages d'explication » ; les fêtes viennent du catalogue ; les
// objets obtenus renvoient à leur fiche (J4.7). Purs : l'état, le catalogue et l'heure leur sont
// passés.
import type { ContentCatalog } from '../content/catalogue';
import { type ItemId, type OwnedItem, type RoomId, houseYear } from '../domain/objets';
import type { LocalDateTime } from '../domain/scellement';
import type { AppState } from '../domain/traitement';
import { type NomObjet, fr } from '../i18n/fr';
import type { IdExplication } from './explications';

/** Les fiches de Comprendre, dans l'ordre de E12. */
export const FICHES_COMPRENDRE = [
  'methode',
  'categories',
  'questions',
  'maison',
  'kintsugi',
  'gashapon',
  'fetes',
  'objets',
] as const;

export type FicheComprendre = (typeof FICHES_COMPRENDRE)[number];

/** La fiche que « En savoir plus » ouvre, carte par carte : celle qui reprend son texte. */
export const FICHE_DE_CARTE: Record<IdExplication, FicheComprendre> = {
  welcome_method: 'methode',
  welcome_categories: 'categories',
  welcome_month: 'methode',
  first_expense: 'methode',
  first_stamp: 'maison',
  first_catch_up: 'maison',
  first_capsule: 'gashapon',
  first_dust: 'maison',
  first_crack: 'kintsugi',
  first_repair: 'kintsugi',
  first_month_review: 'questions',
  new_room: 'fetes',
  new_year: 'maison',
};

const e = fr.explications;

/** Textes de la spec repris par chaque fiche, dans l'ordre où elle les montre. */
const PARAGRAPHES: Record<FicheComprendre, readonly string[]> = {
  methode: [e.bienvenueMethode, e.premiereDepense, e.bienvenueMois],
  categories: [e.bienvenueCategories],
  questions: [e.premierBilanDuMois],
  maison: [e.premierTampon, e.premierJourARattraper, e.premierePoussiere, e.nouvelleAnnee],
  kintsugi: [e.premiereFelure, e.premiereReparation],
  gashapon: [e.premiereCapsule],
  fetes: [e.nouvellePiece],
  objets: [],
};

export function paragraphesDeFiche(fiche: FicheComprendre): readonly string[] {
  return PARAGRAPHES[fiche];
}

/** Paramètre `?fiche=` du lien : la fiche à ouvrir, ou null pour la liste. */
export function lireFicheComprendre(valeur: unknown): FicheComprendre | null {
  return typeof valeur === 'string' && (FICHES_COMPRENDRE as readonly string[]).includes(valeur)
    ? (valeur as FicheComprendre)
    : null;
}

export interface FeteDuMois {
  /** 1 pour janvier. */
  mois: number;
  piece: string;
  fete: string;
  explication: string;
}

/** Les douze pièces du catalogue, de janvier à décembre, avec leur fête et leur explication. */
export function vueFetes(catalogue: ContentCatalog): FeteDuMois[] {
  return [...catalogue.rooms]
    .sort((a, b) => a.month - b.month)
    .map((r) => ({ mois: r.month, piece: r.name, fete: r.feast, explication: r.explanation }));
}

export interface ObjetObtenu {
  itemId: ItemId;
  nom: NomObjet;
  etat: OwnedItem['state'];
}

export interface PieceDesObjets {
  room: RoomId;
  mois: number;
  piece: string;
  objets: ObjetObtenu[];
}

/**
 * Les objets de la maison de l'année, pièce par pièce (dans l'ordre des mois) : ceux de base, puis
 * ceux gagnés, chacun dans l'ordre du catalogue. Ce sont ceux dont la fiche (J4.7) existe : un
 * objet qui attend sa pièce n'y est pas encore.
 */
export function vueObjetsObtenus(
  etat: AppState,
  catalogue: ContentCatalog,
  now: LocalDateTime,
): PieceDesObjets[] {
  const annee = houseYear(now.day);
  const places = etat.house.owned.filter((o) => o.year === annee && o.placedAt !== null);
  const pieces: PieceDesObjets[] = [];
  for (const room of [...catalogue.rooms].sort((a, b) => a.month - b.month)) {
    const objets = catalogue.items
      .filter((i) => i.room === room.id)
      .sort((a, b) => (a.source === b.source ? a.rank - b.rank : a.source === 'base' ? -1 : 1))
      .flatMap((item): ObjetObtenu[] => {
        const possede = places.find((o) => o.itemId === item.id);
        return possede === undefined
          ? []
          : [
              {
                itemId: item.id,
                nom: { nom: item.name, article: item.article, genre: item.gender },
                etat: possede.state,
              },
            ];
      });
    if (objets.length > 0) {
      pieces.push({ room: room.id, mois: room.month, piece: room.name, objets });
    }
  }
  return pieces;
}
