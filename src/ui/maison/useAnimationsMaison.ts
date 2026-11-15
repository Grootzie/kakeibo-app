// Animations de la maison au fil des scènes (J4.4) : quand la scène reçue change (un objet entre,
// se fêle ou se répare), l'animation se joue à la durée de la fiche des visuels. Avec « Réduire
// les animations », la scène s'affiche d'emblée dans son nouvel état ; la fêlure vibre toujours.
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';

import type { HouseScene } from '../../domain/maison';
import type { ItemId } from '../../domain/objets';
import {
  type Changement,
  type Progression,
  changementsDeScene,
  enCours,
  progressions,
} from './animations';

interface Suivi {
  scene: HouseScene;
  liste: Changement[];
  /** Change à chaque nouvelle série d'animations : relance l'horloge des images. */
  generation: number;
  /** Change à chaque nouvelle fêlure : déclenche la vibration. */
  felures: number;
}

const AUCUNE = new Map<ItemId, Progression>();

/**
 * `depuis` : scène d'où partent les animations au montage (le bilan montre l'objet qui entre et
 * la fêlure qui se fait) ; sans elle, la première scène s'affiche telle quelle.
 */
export function useAnimationsMaison(
  scene: HouseScene,
  reduit: boolean,
  depuis?: HouseScene,
): ReadonlyMap<ItemId, Progression> {
  const [suivi, setSuivi] = useState<Suivi>(() => ({
    scene: depuis ?? scene,
    liste: [],
    generation: 0,
    felures: 0,
  }));
  const [ecoule, setEcoule] = useState(0);

  // État dérivé de la scène reçue, calculé pendant le rendu : l'objet nouveau ne s'affiche
  // jamais une image dans son état final avant que son animation commence.
  if (suivi.scene !== scene) {
    const nouveaux = changementsDeScene(suivi.scene, scene);
    const felure = nouveaux.some((c) => c.type === 'felure');
    if (nouveaux.length === 0) setSuivi({ ...suivi, scene });
    else {
      setSuivi({
        scene,
        liste: reduit ? [] : nouveaux,
        generation: suivi.generation + 1,
        felures: suivi.felures + (felure ? 1 : 0),
      });
      setEcoule(0);
    }
  }

  useEffect(() => {
    if (suivi.felures === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
  }, [suivi.felures]);

  const { liste, generation } = suivi;
  useEffect(() => {
    if (liste.length === 0) return;
    let debut: number | null = null;
    let image = 0;
    const pas = (instant: number) => {
      debut ??= instant;
      const e = instant - debut;
      setEcoule(e);
      if (enCours(liste, e)) image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
    // Une seule boucle par série d'animations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation]);

  return reduit || !enCours(liste, ecoule) ? AUCUNE : progressions(liste, ecoule);
}
