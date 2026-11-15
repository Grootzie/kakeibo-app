// Skia factice pour les tests de composants (jest.setup.ts) : chaque élément Skia devient une
// vue de test (`skia-Image`, `skia-Group`…) qui garde ses propriétés, pour vérifier ce que la
// maison dessine sans moteur graphique. Les pixels se vérifient à part, avec le vrai Skia
// (Maison.rendu.test.ts).
import type { ReactNode } from 'react';
import { View } from 'react-native';

type Props = Record<string, unknown> & { children?: ReactNode };

const element = (nom: string) => {
  function ElementSkia({ children, ...props }: Props) {
    return (
      <View testID={`skia-${nom}`} {...{ skia: props }}>
        {children}
      </View>
    );
  }
  ElementSkia.displayName = `Skia${nom}`;
  return ElementSkia;
};

/** Image décodée factice : elle garde la source dont elle vient. */
export interface ImageFactice {
  source: unknown;
}

export const Canvas = element('Canvas');
export const Group = element('Group');
export const Image = element('Image');
export const Oval = element('Oval');
export const Rect = element('Rect');
export const DashPathEffect = element('DashPathEffect');

export const Skia = {
  Image: { MakeImageFromEncoded: (data: { source: unknown }): ImageFactice => data },
};

export const loadData = <T,>(source: unknown, fabrique: (d: { source: unknown }) => T) =>
  Promise.resolve(fabrique({ source }));
