// Dessin Skia du plan de la maison (J4.4) : chaque calque du plan, dans l'ordre, à l'échelle de
// l'écran. Aucune règle ici : tout vient du plan (plan.ts), lui-même tiré de la scène de J4.1.
import { DashPathEffect, Group, Image, Oval, Rect, type SkImage } from '@shopify/react-native-skia';

import { SCENE } from './emplacements';
import type { Calque } from './plan';

/** Encre des emplacements libres et de l'assombrissement. */
const ENCRE = '#1F1B16';

export interface PropsCalquesMaison {
  plan: readonly Calque[];
  images: ReadonlyMap<string, SkImage>;
  /** Largeur dessinée / largeur du cadre de la scène (360 points). */
  echelle: number;
}

function DessinCalque({
  calque,
  images,
}: {
  calque: Calque;
  images: PropsCalquesMaison['images'];
}) {
  switch (calque.type) {
    case 'image': {
      const image = images.get(calque.visuel);
      if (image === undefined) return null;
      const { gauche, haut, largeur, hauteur } = calque.cadre;
      return (
        <Image
          image={image}
          x={gauche}
          y={haut}
          width={largeur}
          height={hauteur}
          fit="fill"
          opacity={calque.opacite}
        />
      );
    }
    case 'emplacementLibre':
      return (
        <Oval
          x={calque.x - calque.rayonX}
          y={calque.y - 2 * calque.rayonY}
          width={2 * calque.rayonX}
          height={2 * calque.rayonY}
          color={ENCRE}
          style="stroke"
          strokeWidth={1.5}
          opacity={calque.opacite}
        >
          <DashPathEffect intervals={[4, 3]} />
        </Oval>
      );
    case 'assombrissement':
      return (
        <Rect
          x={0}
          y={0}
          width={SCENE.largeur}
          height={SCENE.hauteur}
          color="#000000"
          opacity={calque.opacite}
        />
      );
    case 'objet': {
      const { gauche, haut, largeur, hauteur } = calque.cadre;
      return (
        <Group
          opacity={calque.opacite}
          origin={calque.ancrage}
          transform={[{ translateX: calque.decalageX }, { scale: calque.echelle }]}
        >
          {calque.calques.map((c) => {
            const image = images.get(c.visuel);
            return image === undefined ? null : (
              <Image
                key={c.visuel}
                image={image}
                x={gauche}
                y={haut}
                width={largeur}
                height={hauteur}
                fit="fill"
                opacity={c.opacite}
              />
            );
          })}
        </Group>
      );
    }
  }
}

export function CalquesMaison({ plan, images, echelle }: PropsCalquesMaison) {
  return (
    <Group transform={[{ scale: echelle }]}>
      {plan.map((c) => (
        <DessinCalque key={c.cle} calque={c} images={images} />
      ))}
    </Group>
  );
}
