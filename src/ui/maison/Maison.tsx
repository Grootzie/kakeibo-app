// Rendu de la maison (J4.4) : le seul composant qui dessine une scène. Il reçoit la vue de J4.1
// (la scène et sa description) et rien d'autre ; changer de style graphique ne touche que ce
// dossier et les visuels (Architecture technique › Rendu de la maison).
//
// Pour le lecteur d'écran, la maison est une seule image dont le libellé décrit la pièce, chaque
// objet et son état, les emplacements libres et la poussière. Elle ne contient aucun texte : le
// texte agrandi (jusqu'à 200 %) n'y fait rien perdre.
import { Canvas } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { catalogue } from '../../content/catalogue';
import type { HouseScene } from '../../domain/maison';
import type { VueMaison } from '../../state/maison';
import { useMoinsAnimations } from '../cloture/Tampon';
import { CalquesMaison } from './CalquesMaison';
import { SCENE } from './emplacements';
import { useImagesMaison } from './images';
import { planDeScene, visuelsDeScene } from './plan';
import { useAnimationsMaison } from './useAnimationsMaison';

export interface PropsMaison {
  vue: VueMaison;
  /**
   * Scène d'où part l'animation au montage : le bilan de la semaine (E6) montre ainsi l'objet de
   * la capsule qui rejoint son emplacement, et la fêlure qui se fait.
   */
  depuis?: HouseScene;
}

export function Maison({ vue, depuis }: PropsMaison) {
  const { scene, description } = vue;
  const [largeur, setLargeur] = useState(0);
  const reduit = useMoinsAnimations();
  const animations = useAnimationsMaison(scene, reduit, depuis);
  const plan = useMemo(() => planDeScene(scene, catalogue, animations), [scene, animations]);
  const visuels = useMemo(() => {
    return visuelsDeScene(scene, catalogue);
  }, [scene]);
  const images = useImagesMaison(visuels);
  const hauteur = (largeur * SCENE.hauteur) / SCENE.largeur;

  return (
    <View
      testID="maison"
      accessible
      accessibilityRole="image"
      accessibilityLabel={description}
      onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}
      style={{ width: '100%', aspectRatio: SCENE.largeur / SCENE.hauteur }}
    >
      {largeur > 0 && (
        <Canvas style={{ width: largeur, height: hauteur }} pointerEvents="none">
          <CalquesMaison plan={plan} images={images} echelle={largeur / SCENE.largeur} />
        </Canvas>
      )}
    </View>
  );
}
