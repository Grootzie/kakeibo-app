// Composant de rendu de la maison (J4.4) : il reçoit la vue de J4.1 et dessine ses calques (avec
// le Skia factice de jest.setup.ts) ; trois états d'objet, trois niveaux de poussière, emplacements
// libres, animations à la durée de la fiche, « Réduire les animations », vibration de la fêlure,
// description pour le lecteur d'écran et texte agrandi.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';

import catalogueJson from '../../content/catalogue.json';
import type { HouseScene } from '../../domain/maison';
import type { Catalog } from '../../domain/objets';
import { createAppState } from '../../domain/traitement';
import { type VueMaison, vueMaison } from '../../state/maison';
import { catalogue } from '../../content/catalogue';
import { emplacement } from './emplacements';
import { Maison } from './Maison';
import { objetScene, sceneNovembre } from './scenesDeTest';
import type { ImageFactice } from './skiaFactice';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

const DESCRIPTION = 'Kura, la réserve, novembre 2026. Description de test.';
const vue = (over: Partial<HouseScene> = {}): VueMaison => ({
  scene: sceneNovembre(over),
  description: DESCRIPTION,
});

let moinsAnimations = false;
beforeEach(() => {
  moinsAnimations = false;
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockImplementation(() => Promise.resolve(moinsAnimations));
  jest.mocked(Haptics.impactAsync).mockClear();
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

/** Monte la maison, lui donne sa largeur et laisse les images se décoder. */
async function monter(v: VueMaison, largeur = 360, depuis?: HouseScene) {
  const rendu = await render(<Maison vue={v} depuis={depuis} />);
  await fireEvent(screen.getByTestId('maison'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: largeur, height: (largeur * 3) / 4 } },
  });
  await act(async () => {
    await Promise.resolve();
  });
  return rendu;
}

type PropsSkia = Record<string, unknown>;
const props = (testID: string): PropsSkia[] =>
  screen.queryAllByTestId(testID).map((n) => n.props.skia as PropsSkia);
/** Visuels dessinés, dans l'ordre, avec leur opacité. */
const dessines = () =>
  screen.queryAllByTestId('skia-Image').map((n) => {
    const p = n.props.skia as { image: ImageFactice; opacity: number };
    return { source: p.image.source, opacite: p.opacity };
  });
const VISUELS =
  jest.requireActual<typeof import('./visuelsProvisoires')>(
    './visuelsProvisoires',
  ).VISUELS_PROVISOIRES;
const dessine = (visuel: string) => dessines().some((d) => d.source === VISUELS[visuel]);
const opaciteDe = (visuel: string) => dessines().find((d) => d.source === VISUELS[visuel])?.opacite;
/** Groupe d'un objet : celui dont l'origine est le point d'ancrage de son emplacement. */
function groupeDe(itemId: string): PropsSkia {
  const item = catalogue.items.find((i) => i.id === itemId);
  if (item === undefined) throw new Error(`objet inconnu ${itemId}`);
  const e = emplacement(item.source, item.rank);
  const groupe = props('skia-Group').find(
    (g) => JSON.stringify(g.origin) === JSON.stringify({ x: e.x, y: e.y }),
  );
  if (groupe === undefined) throw new Error(`pas de groupe pour ${itemId}`);
  return groupe;
}

describe('ce que la maison dessine', () => {
  it('le fond, la vue et chaque objet à son emplacement, à l’échelle de l’écran', async () => {
    await monter(vue(), 720);
    expect(dessine('rooms/room-11/view')).toBe(true);
    expect(dessine('rooms/room-11/background')).toBe(true);
    for (const id of ['etageres', 'coffre-nagamochi', 'echelle', 'rateau-porte-bonheur-kumade'])
      expect(dessine(`items/${id}/base`)).toBe(true);
    const racine = props('skia-Group')[0];
    expect(racine.transform).toEqual([{ scale: 2 }]);
    expect(props('skia-Canvas')[0].style).toEqual({ width: 720, height: 540 });
  });

  it('objet intact : l’image de base seule', async () => {
    await monter(vue({ items: [objetScene('echelle', 'base', 3, 'intact')] }));
    expect(dessine('items/echelle/base')).toBe(true);
    expect(dessine('items/echelle/crack')).toBe(false);
    expect(dessine('items/echelle/gold')).toBe(false);
  });

  it('objet fêlé : le calque de fêlure par-dessus', async () => {
    await monter(vue({ items: [objetScene('echelle', 'base', 3, 'cracked')] }));
    expect(dessine('items/echelle/base')).toBe(true);
    expect(opaciteDe('items/echelle/crack')).toBe(1);
    expect(dessine('items/echelle/gold')).toBe(false);
  });

  it('objet réparé à l’or : le calque d’or par-dessus, plus de fêlure', async () => {
    await monter(vue({ items: [objetScene('echelle', 'base', 3, 'repaired')] }));
    expect(dessine('items/echelle/base')).toBe(true);
    expect(dessine('items/echelle/crack')).toBe(false);
    expect(opaciteDe('items/echelle/gold')).toBe(1);
  });

  it('emplacements libres : une ombre en pointillés, discrète, par emplacement', async () => {
    await monter(vue());
    const libres = props('skia-Oval');
    expect(libres).toHaveLength(3);
    for (const l of libres) {
      expect(l.style).toBe('stroke');
      expect(l.opacity).toBeLessThanOrEqual(0.4);
    }
    expect(screen.getAllByTestId('skia-DashPathEffect')).toHaveLength(3);
  });

  it('poussière 0 : maison propre', async () => {
    await monter(vue({ dust: 0 }));
    expect(dessine('dust/veil')).toBe(false);
    expect(dessine('dust/cobweb')).toBe(false);
    expect(props('skia-Rect')).toHaveLength(0);
  });

  it('poussière 1 : le voile', async () => {
    await monter(vue({ dust: 1 }));
    expect(dessine('dust/veil')).toBe(true);
    expect(dessine('dust/cobweb')).toBe(false);
    expect(props('skia-Rect')).toHaveLength(0);
  });

  it('poussière 2 : voile, toile d’araignée et assombrissement de 15 %, par-dessus tout', async () => {
    await monter(vue({ dust: 2 }));
    const d = dessines();
    expect(d.at(-2)?.source).toBe(VISUELS['dust/veil']);
    expect(d.at(-1)?.source).toBe(VISUELS['dust/cobweb']);
    expect(props('skia-Rect')).toEqual([
      expect.objectContaining({ color: '#000000', opacity: 0.15 }),
    ]);
  });
});

describe('accessibilité', () => {
  it('une seule image annoncée, avec la description textuelle de J4.1', async () => {
    const etat = createAppState(
      { installDay: '2026-11-02', at: { day: '2026-11-02', time: '08:00' }, budgets: [] },
      catalogueJson as Catalog,
    );
    const v = vueMaison(etat, catalogueJson as Catalog, 2026, 'room-11', {
      day: '2026-11-02',
      time: '09:00',
    });
    if (v === null) throw new Error('pièce non débloquée');
    await monter(v);
    const maison = screen.getByRole('image', {
      name:
        'Kura, la réserve, novembre 2026. Les étagères. Le coffre nagamochi. L’échelle. ' +
        '4 emplacements libres. La maison est propre.',
    });
    expect(maison.props.accessible).toBe(true);
  });

  it('texte agrandi à 200 % : aucun texte dans la maison, rien ne se perd', async () => {
    await monter(vue({ dust: 2 }));
    expect(screen.toJSON()).toBeTruthy();
    expect(screen.queryAllByText(/.+/)).toHaveLength(0);
    expect(screen.getByLabelText(DESCRIPTION)).toBeOnTheScreen();
  });
});

describe('animations', () => {
  const avecKumade = (state: 'intact' | 'cracked' | 'repaired' = 'intact') => ({
    items: [
      objetScene('etageres', 'base', 1),
      objetScene('rateau-porte-bonheur-kumade', 'weekly', 1, state),
    ],
  });

  it('premier affichage : aucune animation', async () => {
    jest.useFakeTimers();
    await monter(vue(avecKumade()));
    expect(groupeDe('rateau-porte-bonheur-kumade').opacity).toBe(1);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('apparition d’un objet en 0,3 s', async () => {
    jest.useFakeTimers();
    const { rerender } = await monter(vue({ items: [objetScene('etageres', 'base', 1)] }));
    await rerender(<Maison vue={vue(avecKumade())} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(groupeDe('rateau-porte-bonheur-kumade').opacity).toBe(0);
    await act(async () => {
      jest.advanceTimersByTime(150);
    });
    const milieu = groupeDe('rateau-porte-bonheur-kumade').opacity as number;
    expect(milieu).toBeGreaterThan(0);
    expect(milieu).toBeLessThan(1);
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(groupeDe('rateau-porte-bonheur-kumade').opacity).toBe(1);
  });

  it('fêlure en 0,2 s, avec vibration', async () => {
    jest.useFakeTimers();
    const { rerender } = await monter(vue(avecKumade('intact')));
    await rerender(<Maison vue={vue(avecKumade('cracked'))} />);
    expect(opaciteDe('items/rateau-porte-bonheur-kumade/crack')).toBe(0);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(48);
    });
    expect(groupeDe('rateau-porte-bonheur-kumade').transform).not.toEqual([
      { translateX: 0 },
      { scale: 1 },
    ]);
    await act(async () => {
      jest.advanceTimersByTime(200);
    });
    expect(opaciteDe('items/rateau-porte-bonheur-kumade/crack')).toBe(1);
    expect(groupeDe('rateau-porte-bonheur-kumade').transform).toEqual([
      { translateX: 0 },
      { scale: 1 },
    ]);
  });

  it('réparation à l’or en 1 s : la fêlure s’efface, l’or apparaît', async () => {
    jest.useFakeTimers();
    const { rerender } = await monter(vue(avecKumade('cracked')));
    await rerender(<Maison vue={vue(avecKumade('repaired'))} />);
    expect(opaciteDe('items/rateau-porte-bonheur-kumade/crack')).toBe(1);
    expect(opaciteDe('items/rateau-porte-bonheur-kumade/gold')).toBe(0);
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(opaciteDe('items/rateau-porte-bonheur-kumade/gold')).toBeGreaterThan(0.3);
    expect(opaciteDe('items/rateau-porte-bonheur-kumade/gold')).toBeLessThan(0.7);
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(dessine('items/rateau-porte-bonheur-kumade/crack')).toBe(false);
    expect(opaciteDe('items/rateau-porte-bonheur-kumade/gold')).toBe(1);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('depuis une scène d’avant : au montage, l’objet entre et la fêlure se fait (bilan, #84)', async () => {
    jest.useFakeTimers();
    const avant = sceneNovembre({ items: sceneNovembre().items.slice(0, 3) });
    const apres = sceneNovembre({
      items: [
        objetScene('etageres', 'base', 1),
        objetScene('coffre-nagamochi', 'base', 2),
        objetScene('echelle', 'base', 3, 'cracked'),
        objetScene('rateau-porte-bonheur-kumade', 'weekly', 1),
      ],
    });
    await monter(vue(apres), 360, avant);
    expect(groupeDe('rateau-porte-bonheur-kumade').opacity).toBe(0);
    expect(opaciteDe('items/echelle/crack')).toBe(0);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(groupeDe('rateau-porte-bonheur-kumade').opacity).toBe(1);
    expect(opaciteDe('items/echelle/crack')).toBe(1);
  });

  it('depuis une scène d’avant, « Réduire les animations » : l’état final d’emblée', async () => {
    moinsAnimations = true;
    jest.useFakeTimers();
    const avant = sceneNovembre({ items: sceneNovembre().items.slice(0, 3) });
    await monter(vue(sceneNovembre()), 360, avant);
    expect(groupeDe('rateau-porte-bonheur-kumade').opacity).toBe(1);
  });

  it('« Réduire les animations » : le nouvel état s’affiche d’emblée, la fêlure vibre quand même', async () => {
    moinsAnimations = true;
    jest.useFakeTimers();
    const { rerender } = await monter(vue({ items: [objetScene('etageres', 'base', 1)] }));
    await rerender(<Maison vue={vue(avecKumade())} />);
    expect(groupeDe('rateau-porte-bonheur-kumade').opacity).toBe(1);
    await rerender(<Maison vue={vue(avecKumade('cracked'))} />);
    expect(opaciteDe('items/rateau-porte-bonheur-kumade/crack')).toBe(1);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    await rerender(<Maison vue={vue(avecKumade('repaired'))} />);
    expect(dessine('items/rateau-porte-bonheur-kumade/crack')).toBe(false);
    expect(opaciteDe('items/rateau-porte-bonheur-kumade/gold')).toBe(1);
  });

  it('changer de pièce n’anime rien', async () => {
    jest.useFakeTimers();
    const { rerender } = await monter(vue());
    await rerender(
      <Maison
        vue={{
          scene: {
            ...sceneNovembre(),
            room: 'room-12',
            month: '2026-12',
            items: [objetScene('jarre-a-eau', 'base', 1)],
            freeSlots: [],
          },
          description: DESCRIPTION,
        }}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(groupeDe('jarre-a-eau').opacity).toBe(1);
  });
});
