// Animations de la maison (J4.4, Fiche des visuels) : déduites de deux scènes successives, sans
// rien demander d'autre au domaine. Un objet nouveau apparaît, un objet intact devenu fêlé se
// fêle, un objet fêlé devenu réparé se répare à l'or. Changer de pièce ou d'année n'anime rien.
import type { HouseScene } from '../../domain/maison';
import type { ItemId } from '../../domain/objets';

export type TypeAnimation = 'apparition' | 'felure' | 'reparation';

/** Apparition d'un objet (0,3 s), fêlure (0,2 s, avec vibration), réparation à l'or (1 s). */
export const DUREES_MS: Readonly<Record<TypeAnimation, number>> = {
  apparition: 300,
  felure: 200,
  reparation: 1000,
};

export interface Changement {
  itemId: ItemId;
  type: TypeAnimation;
}

/** Avancement d'une animation, de 0 (début) à 1 (fin, l'objet tel que la scène le décrit). */
export interface Progression {
  type: TypeAnimation;
  t: number;
}

export function changementsDeScene(avant: HouseScene | null, apres: HouseScene): Changement[] {
  if (avant === null || avant.year !== apres.year || avant.room !== apres.room) return [];
  const etats = new Map(avant.items.map((i) => [i.itemId, i.state]));
  const changements: Changement[] = [];
  for (const item of apres.items) {
    const etat = etats.get(item.itemId);
    if (etat === undefined) changements.push({ itemId: item.itemId, type: 'apparition' });
    else if (etat !== 'repaired' && item.state === 'repaired')
      changements.push({ itemId: item.itemId, type: 'reparation' });
    else if (etat === 'intact' && item.state === 'cracked')
      changements.push({ itemId: item.itemId, type: 'felure' });
  }
  return changements;
}

/** Avancement de chaque animation après `ecouleMs` millisecondes. */
export function progressions(
  changements: readonly Changement[],
  ecouleMs: number,
): Map<ItemId, Progression> {
  return new Map(
    changements.map((c) => [
      c.itemId,
      { type: c.type, t: Math.min(1, Math.max(0, ecouleMs / DUREES_MS[c.type])) },
    ]),
  );
}

/** Vrai tant qu'une des animations n'est pas finie. */
export function enCours(changements: readonly Changement[], ecouleMs: number): boolean {
  return changements.some((c) => ecouleMs < DUREES_MS[c.type]);
}
