// Chargement des visuels de la maison dans Skia (J4.4). Une image décodée reste en mémoire pour
// toute la vie de l'appli : passer d'une pièce à l'autre ne la décode pas deux fois.
import { type SkImage, Skia, loadData } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';

import { VISUELS_PROVISOIRES } from './visuelsProvisoires';

const decodees = new Map<string, SkImage>();
const enChargement = new Set<string>();

/** Images Skia des visuels demandés ; celles qui ne sont pas encore décodées manquent. */
export function useImagesMaison(visuels: readonly string[]): ReadonlyMap<string, SkImage> {
  const cle = visuels.join('|');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let actif = true;
    for (const visuel of cle.split('|')) {
      const source = VISUELS_PROVISOIRES[visuel];
      if (source === undefined || decodees.has(visuel) || enChargement.has(visuel)) continue;
      enChargement.add(visuel);
      loadData(source, (d) => Skia.Image.MakeImageFromEncoded(d))
        .then((image) => {
          if (image !== null) decodees.set(visuel, image);
        })
        .catch(() => undefined)
        .finally(() => {
          enChargement.delete(visuel);
          if (actif) setVersion((v) => v + 1);
        });
    }
    return () => {
      actif = false;
    };
  }, [cle]);

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
