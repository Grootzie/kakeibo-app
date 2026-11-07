// Toucher le rappel du soir ouvre directement E4 (voir « Notifications » dans docs/spec.md) :
// le rappel qui a lancé l'appli, puis chacun des suivants tant que l'appli tourne.
import { useEffect, useEffectEvent } from 'react';

import type { DayKey } from '../domain/scellement';
import type { ServiceRappelsTelephone } from '../state/notifications';

export function useOuvrirDepuisRappel(
  service: Pick<ServiceRappelsTelephone, 'ecouterTouches'>,
  ouvrir: (jour: DayKey) => void,
): void {
  // La dernière fonction reçue, sans réabonner l'écoute à chaque rendu.
  const ouvrirCourant = useEffectEvent(ouvrir);
  useEffect(() => service.ecouterTouches((jour) => ouvrirCourant(jour)), [service]);
}
