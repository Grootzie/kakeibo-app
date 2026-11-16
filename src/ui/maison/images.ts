// Chargement des visuels de la maison dans Skia (J4.4). Une image décodée reste en mémoire pour
// toute la vie de l'appli : passer d'une pièce à l'autre ne la décode pas deux fois.
//
// La fin d'un décodage est annoncée à tous les composants montés qui attendent des images, et pas
// seulement à celui qui l'a lancé (#88) : un composant remonté pendant le décodage (pièce
// redessinée, effets rejoués en développement) reçoit quand même son image.
import { type SkImage, Skia, loadData } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';

import { VISUELS_PROVISOIRES } from './visuelsProvisoires';

const decodees = new Map<string, SkImage>();
/** Visuels dont le décodage a échoué : ils ne seront jamais dessinés, on ne les attend plus. */
const echouees = new Set<string>();
const enChargement = new Set<string>();
const abonnes = new Set<() => void>();

function charger(visuel: string): void {
  const source = VISUELS_PROVISOIRES[visuel];
  if (source === undefined || decodees.has(visuel) || echouees.has(visuel)) return;
  if (enChargement.has(visuel)) return;
  enChargement.add(visuel);
  loadData(source, (d) => Skia.Image.MakeImageFromEncoded(d))
    .then((image) => {
      if (image !== null) decodees.set(visuel, image);
      else echouees.add(visuel);
    })
    .catch(() => {
      echouees.add(visuel);
    })
    .finally(() => {
      enChargement.delete(visuel);
      for (const prevenir of [...abonnes]) prevenir();
    });
}

/** Version qui change à chaque image décodée, et lance le décodage des visuels demandés. */
function useDecodage(cle: string): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const prevenir = () => setVersion((v) => v + 1);
    abonnes.add(prevenir);
    for (const visuel of cle.split('|')) charger(visuel);
    return () => {
      abonnes.delete(prevenir);
    };
  }, [cle]);
  return version;
}

/** Images Skia des visuels demandés ; celles qui ne sont pas encore décodées manquent. */
export function useImagesMaison(visuels: readonly string[]): ReadonlyMap<string, SkImage> {
  const cle = visuels.join('|');
  const version = useDecodage(cle);
  return useMemo(() => {
    const images = new Map<string, SkImage>();
    for (const visuel of cle.split('|')) {
      const image = decodees.get(visuel);
      if (image !== undefined) images.set(visuel, image);
    }
    return images;
    // `version` change quand une image vient d'être décodée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, version]);
}

/**
 * Vrai quand tous les visuels demandés qui ont un fichier sont décodés (ou ont échoué) : la scène
 * est alors entièrement dessinable. Les parcours Maestro l'attendent avant une capture.
 */
export function useVisuelsDecodes(visuels: readonly string[]): boolean {
  const cle = visuels.join('|');
  const version = useDecodage(cle);
  return useMemo(
    () =>
      cle
        .split('|')
        .every((v) => VISUELS_PROVISOIRES[v] === undefined || decodees.has(v) || echouees.has(v)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cle, version],
  );
}
