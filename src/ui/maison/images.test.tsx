// Chargement des visuels de la maison (#88) : une image décodée est montrée par chaque composant
// qui la demande, même si celui qui a lancé le décodage n'est plus là quand il se termine (pièce
// redessinée, écran remonté, effets rejoués en développement). Sans cela, la toile d'araignée
// pouvait ne jamais apparaître sur la capture « poussiere-2 ».
import { act, render } from '@testing-library/react-native';
import { StrictMode } from 'react';
import { Text } from 'react-native';

import { useImagesMaison, useVisuelsDecodes } from './images';

interface Donnees {
  source: unknown;
}
type Fabrique<T> = (d: Donnees) => T;
const enAttente: (() => void)[] = [];

// Décodage piloté par le test : chaque image attend qu'on la libère.
jest.mock('@shopify/react-native-skia', () => ({
  Skia: { Image: { MakeImageFromEncoded: (d: { source: unknown }) => d } },
  loadData: <T,>(source: unknown, fabrique: Fabrique<T>): Promise<T> => {
    return new Promise((resoudre) => {
      enAttente.push(() => resoudre(fabrique({ source })));
    });
  },
}));

// Le cache des images vit tout le temps de l'appli : chaque test demande ses propres visuels.
const piece = (n: string) => [`rooms/room-${n}/view`, `rooms/room-${n}/background`];
beforeEach(() => {
  enAttente.length = 0;
});

async function liberer() {
  await act(async () => {
    for (const fin of enAttente.splice(0)) fin();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function Sonde({ visuels }: { visuels: readonly string[] }) {
  const charges = useImagesMaison(visuels);
  const dessinee = useVisuelsDecodes(visuels);
  return (
    <Text testID="sonde">
      {[...charges.keys()].join('|')}
      {dessinee ? ' · dessinée' : ''}
    </Text>
  );
}

describe('useImagesMaison', () => {
  it('donne les images une fois décodées, et dit quand la scène est complète', async () => {
    const r = await render(<Sonde visuels={piece('01')} />);
    expect(r.getByTestId('sonde')).not.toHaveTextContent('room');
    await liberer();
    expect(r.getByTestId('sonde')).toHaveTextContent(
      'rooms/room-01/view|rooms/room-01/background · dessinée',
    );
  });

  it('un composant remonté pendant le décodage reçoit quand même l’image', async () => {
    const r = await render(<Sonde visuels={piece('02')} />);
    // Le premier composant disparaît avant la fin du décodage, un autre prend sa place.
    await r.unmount();
    const r2 = await render(<Sonde visuels={piece('02')} />);
    await liberer();
    expect(r2.getByTestId('sonde')).toHaveTextContent(
      'rooms/room-02/view|rooms/room-02/background · dessinée',
    );
  });

  it('avec les effets rejoués du mode développement (StrictMode), l’image arrive', async () => {
    const r = await render(
      <StrictMode>
        <Sonde visuels={piece('03')} />
      </StrictMode>,
    );
    await liberer();
    expect(r.getByTestId('sonde')).toHaveTextContent(
      'rooms/room-03/view|rooms/room-03/background · dessinée',
    );
  });

  it('la toile ajoutée au niveau 2 arrive dans la maison déjà montée', async () => {
    const r = await render(<Sonde visuels={piece('04')} />);
    await liberer();
    await r.rerender(<Sonde visuels={[...piece('04'), 'dust/cobweb']} />);
    expect(r.getByTestId('sonde')).not.toHaveTextContent('dessinée');
    await liberer();
    expect(r.getByTestId('sonde')).toHaveTextContent(
      'rooms/room-04/view|rooms/room-04/background|dust/cobweb · dessinée',
    );
  });

  it('les visuels sans fichier ne retiennent pas la scène', async () => {
    const r = await render(<Sonde visuels={['rooms/room-05/view', 'inconnu/visuel']} />);
    await liberer();
    expect(r.getByTestId('sonde')).toHaveTextContent('rooms/room-05/view · dessinée');
  });
});
