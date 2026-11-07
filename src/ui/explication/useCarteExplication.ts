// Choisit la carte de première fois à montrer sur un écran. Dès qu'une carte s'affiche, elle est
// marquée vue (settings.seen_explanations) : elle reste à l'écran jusqu'à sa fermeture, puis ne
// revient plus, même si l'appli est fermée entre-temps.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';

import {
  EXPLICATIONS_J2,
  type IdExplication,
  explicationAAfficher,
} from '../../state/explications';
import type { KakeiboStore } from '../../state/store';

export function useCarteExplication(
  store: KakeiboStore,
  proposees: readonly IdExplication[] = EXPLICATIONS_J2,
  /** Faux tant que l'écran n'est pas visible (un autre écran par-dessus) : aucune carte ne s'ouvre. */
  actif = true,
): { carte: IdExplication | null; fermer: () => void } {
  const [carte, setCarte] = useState<IdExplication | null>(null);
  // Cartes déjà montrées par cet écran, avant même que le store les ait enregistrées.
  const montrees = useRef<string[]>([]);
  const etat = useStore(store, (s) => s.etat);
  const maintenant = useStore(store, (s) => s.maintenant);
  const vues = useStore(store, (s) => s.explicationsVues);
  const cle = proposees.join(',');

  useEffect(() => {
    if (!actif || carte !== null || etat === null || maintenant === null) return;
    const candidate = explicationAAfficher(
      etat,
      maintenant,
      [...vues, ...montrees.current],
      cle.split(',') as IdExplication[],
    );
    if (candidate === null) return;
    montrees.current.push(candidate);
    setCarte(candidate);
    void store.getState().marquerExplicationVue(candidate);
  }, [actif, carte, etat, maintenant, vues, cle, store]);

  const fermer = useCallback(() => setCarte(null), []);
  return { carte, fermer };
}
