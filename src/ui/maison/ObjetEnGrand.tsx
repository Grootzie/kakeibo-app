// Un objet seul, en grand, dans son état (fiche d'objet, J4.7) : son image de base, puis la
// fêlure ou les veines d'or, les mêmes visuels et le même ordre que dans la maison. Comme le
// rendu de la maison, il ne dépend que des visuels : changer de style ne touche que ce dossier.
import { Canvas, Image } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { View } from 'react-native';

import type { ItemVisuals } from '../../content/catalogue';
import type { OwnedItem } from '../../domain/objets';
import { useImagesMaison } from './images';
import { calquesDeLObjet } from './plan';

export interface PropsObjetEnGrand {
  visuels: ItemVisuals;
  etat: OwnedItem['state'];
  /** Côté du dessin, en points. */
  taille: number;
  /** Nom et état de l'objet, lus par le lecteur d'écran. */
  libelle: string;
}

export function ObjetEnGrand({ visuels, etat, taille, libelle }: PropsObjetEnGrand) {
  const calques = useMemo(() => {
    return calquesDeLObjet(visuels, etat);
  }, [visuels, etat]);
  const images = useImagesMaison(calques);
  return (
    <View
      testID="objet-en-grand"
      accessible
      accessibilityRole="image"
      accessibilityLabel={libelle}
      style={{ width: taille, height: taille }}
    >
      <Canvas style={{ width: taille, height: taille }} pointerEvents="none">
        {calques.map((visuel) => {
          const image = images.get(visuel);
          return image === undefined ? null : (
            <Image
              key={visuel}
              image={image}
              x={0}
              y={0}
              width={taille}
              height={taille}
              fit="contain"
            />
          );
        })}
      </Canvas>
    </View>
  );
}
