// Plan de dessin de la maison (J4.4) : la scène de J4.1 traduite en calques, du fond vers
// l'avant. Le composant de rendu (Maison.tsx) ne fait que dessiner ce plan ; changer de style
// graphique touche ce dossier et les visuels, jamais le domaine ni les écrans (Rendu de la maison).
import type { HouseScene } from '../../domain/maison';
import type { ItemId, OwnedItem } from '../../domain/objets';
import type { ContentCatalog, ItemVisuals } from '../../content/catalogue';
import type { Progression } from './animations';
import { CADRE_OBJET, SCENE, cadreDansLaScene, emplacement } from './emplacements';

export interface Cadre {
  gauche: number;
  haut: number;
  largeur: number;
  hauteur: number;
}

/** Image plein cadre : vue, fond de la pièce, voile, toile d'araignée. */
export interface CalqueImage {
  type: 'image';
  cle: 'vue' | 'fond' | 'voile' | 'toile';
  visuel: string;
  cadre: Cadre;
  opacite: number;
}

/** Un objet : son image de base, puis la fêlure ou les veines d'or, dans le même cadre. */
export interface CalqueObjet {
  type: 'objet';
  cle: ItemId;
  cadre: Cadre;
  /** Point d'ancrage dans la scène, en bas au milieu : centre de l'apparition. */
  ancrage: { x: number; y: number };
  opacite: number;
  echelle: number;
  /** Vibration de la fêlure, en points. */
  decalageX: number;
  calques: { visuel: string; opacite: number }[];
}

/** Emplacement libre : une ombre discrète au sol, en pointillés. */
export interface CalqueEmplacementLibre {
  type: 'emplacementLibre';
  cle: string;
  x: number;
  y: number;
  rayonX: number;
  rayonY: number;
  opacite: number;
}

/** Lumière baissée de la poussière de niveau 2 : un noir à 15 % sur toute la scène. */
export interface CalqueAssombrissement {
  type: 'assombrissement';
  cle: 'assombrissement';
  opacite: number;
}

export type Calque = CalqueImage | CalqueObjet | CalqueEmplacementLibre | CalqueAssombrissement;

/** Assombrissement de la poussière de niveau 2 (Fiche des visuels). */
export const ASSOMBRISSEMENT = 0.15;
/** Opacité des emplacements libres : visibles sans attirer l'œil. */
export const OPACITE_LIBRE = 0.35;
/** Taille de départ d'un objet qui apparaît. */
const ECHELLE_DEPART = 0.6;
/** Amplitude et nombre d'allers-retours de la vibration de la fêlure. */
const VIBRATION = { amplitude: 3, allersRetours: 3 } as const;

const PLEIN_CADRE: Cadre = { gauche: 0, haut: 0, largeur: SCENE.largeur, hauteur: SCENE.hauteur };
const image = (cle: CalqueImage['cle'], visuel: string): CalqueImage => ({
  type: 'image',
  cle,
  visuel,
  cadre: PLEIN_CADRE,
  opacite: 1,
});

/**
 * Calques d'un objet seul dans son état, du fond vers l'avant (fiche d'objet) : la base, puis la
 * fêlure ou les veines d'or, comme dans la maison.
 */
export function calquesDeLObjet(visuels: ItemVisuals, etat: OwnedItem['state']): string[] {
  if (etat === 'cracked') return [visuels.base, visuels.crack];
  if (etat === 'repaired') return [visuels.base, visuels.gold];
  return [visuels.base];
}

const sortie = (t: number) => 1 - (1 - t) * (1 - t);

function calqueObjet(
  catalogue: ContentCatalog,
  item: HouseScene['items'][number],
  anim: Progression | undefined,
): CalqueObjet {
  const e = emplacement(item.source, item.rank);
  const visuels = catalogue.items.find((i) => i.id === item.itemId)?.visuals ?? {
    base: `items/${item.itemId}/base`,
    crack: `items/${item.itemId}/crack`,
    gold: `items/${item.itemId}/gold`,
  };
  const t = anim?.t ?? 1;
  const calques = [{ visuel: visuels.base, opacite: 1 }];
  if (anim?.type === 'reparation' && t < 1)
    calques.push({ visuel: visuels.crack, opacite: 1 - t }, { visuel: visuels.gold, opacite: t });
  else if (item.state === 'cracked')
    calques.push({ visuel: visuels.crack, opacite: anim?.type === 'felure' ? t : 1 });
  else if (item.state === 'repaired') calques.push({ visuel: visuels.gold, opacite: 1 });

  const apparition = anim?.type === 'apparition' ? t : 1;
  const vibration =
    anim?.type === 'felure' && t < 1
      ? VIBRATION.amplitude * (1 - t) * Math.sin(t * VIBRATION.allersRetours * 2 * Math.PI)
      : 0;
  return {
    type: 'objet',
    cle: item.itemId,
    cadre: cadreDansLaScene(e),
    ancrage: { x: e.x, y: e.y },
    opacite: apparition,
    echelle: apparition === 1 ? 1 : ECHELLE_DEPART + (1 - ECHELLE_DEPART) * sortie(apparition),
    decalageX: vibration === 0 ? 0 : vibration,
    calques,
  };
}

/**
 * Calques d'une scène, du fond vers l'avant : vue, fond, emplacements libres, objets (dans
 * l'ordre d'affichage de leurs emplacements), puis la poussière par-dessus tout.
 */
export function planDeScene(
  scene: HouseScene,
  catalogue: ContentCatalog,
  animations: ReadonlyMap<ItemId, Progression> = new Map(),
): Calque[] {
  const plan: Calque[] = [
    image('vue', `rooms/${scene.room}/view`),
    image('fond', `rooms/${scene.room}/background`),
  ];
  for (const libre of scene.freeSlots) {
    const e = emplacement('weekly', libre.rank);
    plan.push({
      type: 'emplacementLibre',
      cle: `libre-${libre.rank}`,
      x: e.x,
      y: e.y,
      rayonX: CADRE_OBJET.largeur * 0.35,
      rayonY: CADRE_OBJET.hauteur * 0.08,
      opacite: OPACITE_LIBRE,
    });
  }
  const objets = scene.items
    .map((item) => ({ item, e: emplacement(item.source, item.rank) }))
    .sort((a, b) => a.e.ordre - b.e.ordre || a.e.x - b.e.x)
    .map(({ item }) => calqueObjet(catalogue, item, animations.get(item.itemId)));
  plan.push(...objets);
  if (scene.dust === 2)
    plan.push({ type: 'assombrissement', cle: 'assombrissement', opacite: ASSOMBRISSEMENT });
  if (scene.dust >= 1) plan.push(image('voile', 'dust/veil'));
  if (scene.dust === 2) plan.push(image('toile', 'dust/cobweb'));
  return plan;
}
