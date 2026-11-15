// Couche de style de la maison (J4.3) : cadre de la scène, cadre des objets et positions
// provisoires des emplacements. Le domaine ne connaît que le rang d'un objet ; où il se pose, à
// quelle taille et dans quel ordre il se dessine est une affaire de style (Rendu de la maison).
// Les visuels provisoires (tools/visuels) et le futur lot définitif suivent ces cadres.
import type { OwnedItem } from '../../domain/objets';

/** Cadre de la scène d'une pièce, en points (1x) : fond, vue et poussière ont cette taille. */
export const SCENE = { largeur: 360, hauteur: 270 } as const;

/**
 * Cadre commun des trois calques d'un objet (base, fêlure, veines d'or), en points (1x). Le point
 * d'ancrage, en bas au milieu, se pose sur l'emplacement.
 */
export const CADRE_OBJET = { largeur: 64, hauteur: 64, ancrage: { x: 32, y: 64 } } as const;

/** Emplacement : point d'ancrage dans la scène, et ordre d'affichage (le plus grand devant). */
export interface Emplacement {
  readonly x: number;
  readonly y: number;
  readonly ordre: number;
}

/**
 * Positions provisoires : les objets de base au fond, contre le mur ; les objets à gagner devant,
 * sur une rangée de cinq (le 5e seulement les mois de 5 semaines).
 */
export const EMPLACEMENTS: {
  readonly base: readonly Emplacement[];
  readonly weekly: readonly Emplacement[];
} = {
  base: [
    { x: 60, y: 200, ordre: 1 },
    { x: 180, y: 200, ordre: 1 },
    { x: 300, y: 200, ordre: 1 },
  ],
  weekly: [
    { x: 40, y: 262, ordre: 2 },
    { x: 110, y: 262, ordre: 2 },
    { x: 180, y: 262, ordre: 2 },
    { x: 250, y: 262, ordre: 2 },
    { x: 320, y: 262, ordre: 2 },
  ],
};

/** Emplacement d'un objet, d'après sa source et son rang dans le catalogue. */
export function emplacement(source: OwnedItem['source'], rang: number): Emplacement {
  const e = EMPLACEMENTS[source][rang - 1];
  if (!Number.isInteger(rang) || e === undefined)
    throw new Error(`Aucun emplacement ${source} de rang ${rang}`);
  return e;
}

/** Cadre de l'objet posé sur un emplacement, en points dans la scène. */
export function cadreDansLaScene(e: Emplacement): {
  gauche: number;
  haut: number;
  largeur: number;
  hauteur: number;
} {
  return {
    gauche: e.x - CADRE_OBJET.ancrage.x,
    haut: e.y - CADRE_OBJET.ancrage.y,
    largeur: CADRE_OBJET.largeur,
    hauteur: CADRE_OBJET.hauteur,
  };
}
