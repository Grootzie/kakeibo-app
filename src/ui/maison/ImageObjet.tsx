// Un objet seul, dessiné avec son visuel de base (J4.5, #84) : celui qui sort de la capsule au
// bilan de la semaine, avant de rejoindre son emplacement dans la pièce. Comme la maison, il
// passe par les visuels du dossier maison : changer de style ne touche que ce dossier.
import { Canvas, Image } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { View } from 'react-native';

import { catalogue } from '../../content/catalogue';
import type { ItemId } from '../../domain/objets';
import { useImagesMaison } from './images';

export interface PropsImageObjet {
  itemId: ItemId;
  /** Côté du carré, en points. */
  taille: number;
}

export function ImageObjet({ itemId, taille }: PropsImageObjet) {
  const visuel = catalogue.items.find((i) => i.id === itemId)?.visuals.base;
  const visuels = useMemo(() => (visuel === undefined ? [] : [visuel]), [visuel]);
  const images = useImagesMaison(visuels);
  const image = visuel === undefined ? undefined : images.get(visuel);
  return (
    <View testID={`objet-${itemId}`} style={{ width: taille, height: taille }}>
      {image !== undefined && (
        <Canvas style={{ width: taille, height: taille }} pointerEvents="none">
          <Image image={image} x={0} y={0} width={taille} height={taille} fit="contain" />
        </Canvas>
      )}
    </View>
  );
}
