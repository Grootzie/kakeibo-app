// « En savoir plus » des cartes de première fois (E12, J5.7, #106) : l'appli (app/_layout.tsx)
// fournit à tous ses écrans de quoi ouvrir Comprendre à une fiche. Les écrans ne connaissent pas
// le routeur : ils reçoivent cette ouverture par le contexte.
import { createContext } from 'react';

import type { FicheComprendre } from '../../state/comprendre';

export type OuvrirComprendre = (fiche: FicheComprendre) => void;

/** Sans fournisseur (tests d'un écran seul), la carte ne propose pas « En savoir plus ». */
export const EnSavoirPlus = createContext<OuvrirComprendre | null>(null);
