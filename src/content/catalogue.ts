// Catalogue livré avec l'appli (Modèle de données › Catalogue, J4.2) : le domaine n'en lit que
// les champs de `Catalog` ; la fiche d'objet et la carte « Nouvelle pièce » lisent le reste.
import catalogueJson from './catalogue.json';
import type { CatalogItem, CatalogRoom } from '../domain/objets';

/** Nom japonais d'un objet : écriture japonaise (kanji, avec kana au besoin) et transcription. */
export interface JapaneseName {
  kanji: string;
  /** Transcription Hepburn, voyelles longues marquées d'un macron : « shōji », « teru teru bōzu ». */
  romaji: string;
}

/** Identifiants des trois visuels d'un objet (Fiche des visuels) : l'image et ses deux calques. */
export interface ItemVisuals {
  /** Objet intact. */
  base: string;
  /** Calque de la fêlure, superposé à la base. */
  crack: string;
  /** Calque des veines d'or, superposé à la base. */
  gold: string;
}

export interface ContentRoom extends CatalogRoom {
  /** Explication de la pièce, deux phrases au plus (carte « Nouvelle pièce »). */
  explanation: string;
}

export interface ContentItem extends CatalogItem {
  japanese: JapaneseName;
  /** Explication culturelle, deux phrases au plus (fiche d'objet). */
  explanation: string;
  visuals: ItemVisuals;
}

export interface ContentCatalog {
  rooms: ContentRoom[];
  items: ContentItem[];
}

export const catalogue: ContentCatalog = catalogueJson as ContentCatalog;

/** Identifiant d'un visuel d'objet : « items/daruma/crack ». */
export const itemVisualId = (itemId: string, layer: keyof ItemVisuals): string =>
  `items/${itemId}/${layer}`;
