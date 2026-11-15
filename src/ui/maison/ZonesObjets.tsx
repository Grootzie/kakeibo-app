// Zones tactiles des objets de la maison (E8, J4.6, #85) : une zone transparente posée sur le
// cadre de chaque objet, pour toucher l'objet sur le dessin. Le lecteur d'écran ne les lit pas :
// l'écran donne aussi un bouton par objet, nommé par son nom et son état.
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { HouseScene } from '../../domain/maison';
import type { ItemId } from '../../domain/objets';
import { SCENE, cadreDansLaScene, emplacement } from './emplacements';

export interface PropsZonesObjets {
  scene: HouseScene;
  onToucher: (itemId: ItemId) => void;
}

export function ZonesObjets({ scene, onToucher }: PropsZonesObjets) {
  const [largeur, setLargeur] = useState(0);
  const echelle = largeur / SCENE.largeur;
  return (
    <View
      testID="zones-objets"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="box-none"
      onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}
      style={StyleSheet.absoluteFill}
    >
      {largeur > 0 &&
        scene.items.map((item) => {
          const cadre = cadreDansLaScene(emplacement(item.source, item.rank));
          return (
            <Pressable
              key={item.itemId}
              testID={`zone-${item.itemId}`}
              onPress={() => onToucher(item.itemId)}
              style={{
                position: 'absolute',
                left: cadre.gauche * echelle,
                top: cadre.haut * echelle,
                width: cadre.largeur * echelle,
                height: cadre.hauteur * echelle,
              }}
            />
          );
        })}
    </View>
  );
}
