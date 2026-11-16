// Fiche d'objet (E8, J4.7, #86), avec le vrai store sur une base de test et l'horloge de test :
// l'objet en grand sur fond de papier, dans son état ; ses noms français et japonais ; son
// explication du catalogue ; son histoire ; les libellés d'accessibilité.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { readFileSync } from 'fs';
import { join } from 'path';

import catalogueJson from '../../content/catalogue.json';
import { migrate } from '../../data/migrations';
import { createRepositories } from '../../data/repositories';
import { createTestDb } from '../../data/testDb';
import type { Catalog } from '../../domain/objets';
import { fr } from '../../i18n/fr';
import { createClock } from '../../state/clock';
import { type KakeiboStore, createKakeiboStore } from '../../state/store';
import { theme } from '../theme';
import { EcranFicheObjet } from './EcranFicheObjet';
import type { ImageFactice } from './skiaFactice';

const NBSP = ' ';
const f = fr.ficheObjet;
const VISUELS =
  jest.requireActual<typeof import('./visuelsProvisoires')>(
    './visuelsProvisoires',
  ).VISUELS_PROVISOIRES;

const jourDe = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const du = (debut: number, fin: number, sauf: number[] = []) =>
  Array.from({ length: fin - debut + 1 }, (_, i) => debut + i)
    .filter((j) => !sauf.includes(j))
    .map((j) => new Date(2026, 10, j));

/**
 * Installation le lundi 2 novembre 2026 à 8:00, budget de novembre (140 € par semaine). `jours` :
 * les journées clôturées, chacune le soir ; `depenses` : notées à midi ; puis retour à `fin`.
 */
async function preparer(
  jours: Date[],
  depenses: { jour: string; montant: number }[],
  fin: Date,
): Promise<KakeiboStore> {
  const db = createTestDb();
  await migrate(db);
  const repos = createRepositories(db);
  let reel = new Date(2026, 10, 2, 8, 0);
  let n = 0;
  const deps = {
    depots: async () => repos,
    catalogue: catalogueJson as Catalog,
    horloge: createClock({ actif: true, reel: () => reel }),
    nouvelId: () => `id-${++n}`,
  };
  await createKakeiboStore(deps).getState().ouvrir();
  await repos.budgetVersions.add({
    id: 'b-nov',
    month: '2026-11',
    income: 200000,
    fixed_costs: 110000,
    savings_goal: 30000,
    effective_from: '2026-11-02',
  });
  const store = createKakeiboStore(deps);
  for (const j of jours) {
    const jour = jourDe(j);
    for (const d of depenses.filter((x) => x.jour === jour)) {
      reel = new Date(j.getFullYear(), j.getMonth(), j.getDate(), 12, 0);
      await store
        .getState()
        .noterDepense({ day: jour, amount: d.montant, category: 'envies', note: '' });
    }
    reel = new Date(j.getFullYear(), j.getMonth(), j.getDate(), 21, 0);
    await store.getState().cloturerJour(jour);
  }
  reel = fin;
  await store.getState().ouvrir();
  return store;
}

/**
 * Semaine 45 complète et dans le budget : le kumade entre. Semaine 46 complète et hors budget :
 * le kumade se fêle (le 15). Semaine 47 toute clôturée : il est réparé à l'or le 22.
 */
const kumadeRepare = () =>
  preparer(du(2, 22), [{ jour: '2026-11-10', montant: 15000 }], new Date(2026, 10, 23, 9, 0));

async function monter(store: KakeiboStore, itemId: string | undefined) {
  const onRetour = jest.fn();
  await render(<EcranFicheObjet store={store} itemId={itemId} onRetour={onRetour} />);
  // Les visuels se décodent après le premier rendu.
  await act(async () => {});
  return onRetour;
}

const dessines = () =>
  screen
    .queryAllByTestId('skia-Image')
    .map((n) => (n.props.skia as { image: ImageFactice }).image.source);

describe('Fiche d’objet (E8, #86)', () => {
  it('objet gagné, fêlé puis réparé à l’or : en grand avec ses veines d’or, ses noms, son explication et son histoire', async () => {
    await monter(await kumadeRepare(), 'rateau-porte-bonheur-kumade');
    expect(
      screen.getByRole('header', { name: 'Le râteau porte-bonheur kumade' }),
    ).toBeOnTheScreen();
    // L'objet en grand, sur fond de papier, dans son état.
    expect(screen.getByTestId('fiche-objet-papier')).toHaveStyle({
      backgroundColor: theme.couleurs.papier,
    });
    expect(
      screen.getByRole('image', { name: 'Le râteau porte-bonheur kumade, réparé à l’or' }),
    ).toBeOnTheScreen();
    expect(dessines()).toEqual([
      VISUELS['items/rateau-porte-bonheur-kumade/base'],
      VISUELS['items/rateau-porte-bonheur-kumade/gold'],
    ]);
    // Nom japonais : écriture et transcription, lus d'un seul tenant.
    const japonais = screen.getByLabelText(/^En japonais/);
    expect(japonais.props.accessibilityLabel).toBe(`En japonais${NBSP}: kumade, 熊手`);
    expect(screen.getByText('熊手')).toBeOnTheScreen();
    expect(screen.getByText('kumade')).toBeOnTheScreen();
    // Explication du catalogue.
    expect(screen.getByRole('header', { name: f.auJapon })).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Ce râteau de bambou se vend en novembre aux marchés Tori no ichi : il sert à ratisser la chance. On en rachète un plus grand chaque année.',
      ),
    ).toBeOnTheScreen();
    // Histoire tirée de owned_item.
    expect(screen.getByRole('header', { name: f.sonHistoire })).toBeOnTheScreen();
    expect(
      screen.getByText(`Gagné la semaine du 2${NBSP}novembre. Fêlé le 15, réparé à l’or le 22.`),
    ).toBeOnTheScreen();
  });

  it('objet de base fêlé, réparation en cours : la fêlure dessinée, « x jours sur 7 », depuis quand il est là', async () => {
    // Semaine 45 hors budget : l'échelle se fêle le dimanche 8 ; jeudi 12, 4 jours sur 7.
    const store = await preparer(
      du(2, 12),
      [{ jour: '2026-11-03', montant: 15000 }],
      new Date(2026, 10, 13, 9, 0),
    );
    await monter(store, 'echelle');
    expect(screen.getByRole('header', { name: 'L’échelle' })).toBeOnTheScreen();
    expect(
      screen.getByRole('image', { name: `L’échelle, fêlée, réparation${NBSP}: 4 jours sur 7` }),
    ).toBeOnTheScreen();
    expect(dessines()).toEqual([VISUELS['items/echelle/base'], VISUELS['items/echelle/crack']]);
    expect(screen.getByText(`Réparation${NBSP}: 4 jours sur 7`)).toBeOnTheScreen();
    expect(
      screen.getByText(`Dans ta maison depuis le 2${NBSP}novembre. Fêlée le 8.`),
    ).toBeOnTheScreen();
  });

  it('objet de base intact : la base seule, au féminin pluriel', async () => {
    await monter(await preparer([], [], new Date(2026, 10, 2, 9, 0)), 'etageres');
    expect(screen.getByRole('image', { name: 'Les étagères, intactes' })).toBeOnTheScreen();
    expect(dessines()).toEqual([VISUELS['items/etageres/base']]);
    expect(screen.getByText('Intactes')).toBeOnTheScreen();
    expect(screen.getByText(`Dans ta maison depuis le 2${NBSP}novembre.`)).toBeOnTheScreen();
  });

  it('objet absent de la maison : le titre de la maison et le retour', async () => {
    const onRetour = await monter(
      await preparer([], [], new Date(2026, 10, 2, 9, 0)),
      'rateau-porte-bonheur-kumade',
    );
    expect(screen.getByRole('header', { name: fr.ecranMaison.titre })).toBeOnTheScreen();
    expect(screen.queryByRole('image')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: f.retourLibelle }));
    expect(onRetour).toHaveBeenCalledTimes(1);
  });

  it('retour à la maison, zones tactiles de 44 points, aucun texte tronqué à 200 %', async () => {
    const onRetour = await monter(await kumadeRepare(), 'rateau-porte-bonheur-kumade');
    for (const b of screen.getAllByRole('button'))
      expect(b.props.style).toMatchObject({ minHeight: theme.zoneTactileMin });
    await fireEvent.press(screen.getByRole('button', { name: f.retourLibelle }));
    expect(onRetour).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('fiche-objet-defilement').type).toBe('RCTScrollView');
    for (const fichier of ['EcranFicheObjet.tsx', 'ObjetEnGrand.tsx'])
      expect(readFileSync(join(__dirname, fichier), 'utf8')).not.toMatch(
        /numberOfLines|allowFontScaling|maxFontSizeMultiplier|adjustsFontSizeToFit/,
      );
  });
});
