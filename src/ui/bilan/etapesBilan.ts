// Où en est le bilan d'une semaine (E6) : le temps atteint et la tirette tirée ou non. Gardé
// tant que l'appli vit, pour que le bilan quitté (retour, appli en arrière-plan) se rouvre au
// même endroit. Le bilan n'est marqué vu qu'à la fin : rien ne se perd s'il est interrompu.
import type { WeekId } from '../../domain/calendrier';

export type Temps = 1 | 2 | 3 | 4;

export interface EtapeBilan {
  temps: Temps;
  tiree: boolean;
}

const etapes = new Map<WeekId, EtapeBilan>();

export function etapeBilan(semaine: WeekId): EtapeBilan {
  return etapes.get(semaine) ?? { temps: 1, tiree: false };
}

export function retenirEtape(semaine: WeekId, etape: EtapeBilan): void {
  etapes.set(semaine, etape);
}

/** Bilan terminé (ou tests) : la prochaine ouverture repart du temps 1. */
export function oublierEtapes(semaine?: WeekId): void {
  if (semaine === undefined) etapes.clear();
  else etapes.delete(semaine);
}
