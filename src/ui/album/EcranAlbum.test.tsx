// Album des années passées (E8, J4.8, #87), avec le vrai store sur une base de test et l'horloge
// de test : passer la nouvelle année et retrouver la maison de l'année écoulée, objets encore
// fêlés compris, sans poussière ni réparation en cours ; album vide ; libellés d'accessibilité.
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import catalogueJson from '../../content/catalogue.json';
import { migrate } from '../../data/migrations';
import { createRepositories } from '../../data/repositories';
import { createTestDb } from '../../data/testDb';
import type { Catalog } from '../../domain/objets';
import { fr } from '../../i18n/fr';
import { type Horloge, createClock } from '../../state/clock';
import { type KakeiboStore, createKakeiboStore } from '../../state/store';
import { EcranAlbum } from './EcranAlbum';

const NBSP = ' ';
const a = fr.album;

interface Preparation {
  store: KakeiboStore;
  horloge: Horloge;
}

/**
 * Installation le lundi 2 novembre 2026 à 8:00, budget de novembre (140 € par semaine). Semaine
 * 45 : 150 € notés le mardi 3 et chaque jour clôturé le soir (le kumade entre, l'échelle se
 * fêle) ; puis les 9 à 12 novembre clôturés, la réparation en est à 4 jours sur 7.
 */
async function preparer(): Promise<Preparation> {
  const db = createTestDb();
  await migrate(db);
  const repos = createRepositories(db);
  let reel = new Date(2026, 10, 2, 8, 0);
  let n = 0;
  const horloge = createClock({ actif: true, reel: () => reel });
  const deps = {
    depots: async () => repos,
    catalogue: catalogueJson as Catalog,
    horloge,
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
  reel = new Date(2026, 10, 3, 12, 0);
  await store.getState().noterDepense({
    day: '2026-11-03',
    amount: 15000,
    category: 'envies',
    note: '',
  });
  for (let j = 2; j <= 12; j++) {
    reel = new Date(2026, 10, j, 21, 0);
    await store.getState().cloturerJour(`2026-11-${String(j).padStart(2, '0')}`);
  }
  // Retour le vendredi 13 novembre à 9:00 ; l'horloge de test avancera ensuite.
  reel = new Date(2026, 10, 13, 9, 0);
  await store.getState().ouvrir();
  return { store, horloge };
}

/** L'horloge de test avance, puis l'appli traite l'heure nouvelle comme une ouverture. */
async function avancer(p: Preparation, jours: number) {
  p.horloge.avancerJours(jours);
  await act(async () => {
    await p.store.getState().ouvrir();
  });
}

async function monter(p: Preparation) {
  const onRetour = jest.fn();
  await render(<EcranAlbum store={p.store} onRetour={onRetour} />);
  return onRetour;
}

describe('Album (E8, #87)', () => {
  it('album vide : un message court, sans reproche, et le retour', async () => {
    const p = await preparer();
    const onRetour = await monter(p);
    expect(screen.getByRole('header', { name: a.titre })).toBeTruthy();
    expect(
      screen.getByText(
        'Ton album est encore vide. À la nouvelle année, ta maison de 2026 viendra s’y ranger, telle que tu l’as faite.',
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId('maison')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: a.retourLibelle }));
    expect(onRetour).toHaveBeenCalledTimes(1);
  });

  it('le dimanche 3 janvier 2027 est encore dans la semaine 2026-W53 : l’album reste vide', async () => {
    const p = await preparer();
    await avancer(p, 51); // vendredi 13 novembre + 51 jours = dimanche 3 janvier 2027
    await monter(p);
    expect(screen.getByText(/^Ton album est encore vide\..*ta maison de 2026/)).toBeTruthy();
  });

  it('passer la nouvelle année et retrouver la maison de l’année écoulée', async () => {
    const p = await preparer();
    await avancer(p, 52); // lundi 4 janvier 2027, semaine 1
    await monter(p);
    expect(screen.queryByText(/encore vide/)).toBeNull();

    // Une vignette par année passée, nommée pour le lecteur d'écran ; la scène n'y est pas relue.
    const vignette = screen.getByRole('button', { name: 'Ta maison de 2026, 1 pièce' });
    expect(vignette.props.accessibilityHint).toBe(a.vignetteIndice);
    expect(screen.getByText('2026')).toBeTruthy();
    expect(screen.getAllByTestId('maison', { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.queryByRole('image')).toBeNull();

    await fireEvent.press(vignette);
    expect(screen.getByRole('header', { name: 'Ta maison de 2026' })).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Novembre · Kura, la réserve' })).toBeTruthy();
    // L'échelle reste fêlée, sans « Réparation : 4 jours sur 7 » ; ni poussière ni réparation.
    expect(
      screen.getByRole('image', {
        name:
          'Kura, la réserve, novembre 2026. Les étagères. Le coffre nagamochi. L’échelle, fêlée. ' +
          'Le râteau porte-bonheur kumade. 3 emplacements libres. La maison est propre.',
      }),
    ).toBeTruthy();
    expect(screen.queryByText(new RegExp(`Réparation${NBSP}:`))).toBeNull();

    // Retour à toutes les années, puis fermeture de l'album.
    await fireEvent.press(screen.getByRole('button', { name: a.toutesLesAnneesLibelle }));
    expect(screen.getByRole('button', { name: 'Ta maison de 2026, 1 pièce' })).toBeTruthy();
  });

  it('les clôtures de 2027 ne réparent pas l’échelle de l’album', async () => {
    const p = await preparer();
    await avancer(p, 52);
    for (let j = 4; j <= 10; j++) {
      await act(async () => {
        await p.store.getState().cloturerJour(`2027-01-${String(j).padStart(2, '0')}`);
      });
      if (j < 10) p.horloge.avancerJours(1);
    }
    await monter(p);
    await fireEvent.press(screen.getByRole('button', { name: 'Ta maison de 2026, 1 pièce' }));
    expect(screen.getByRole('image', { name: /L’échelle, fêlée\./ })).toBeTruthy();
  });

  it('deux années passées : deux vignettes, de la plus ancienne à la plus récente', async () => {
    const p = await preparer();
    await avancer(p, 52 + 364); // lundi 3 janvier 2028, semaine 1 de 2028
    await monter(p);
    const vignettes = screen.getAllByRole('button', { name: /^Ta maison de \d{4}/ });
    expect(vignettes.map((v) => v.props.accessibilityLabel)).toEqual([
      'Ta maison de 2026, 1 pièce',
      'Ta maison de 2027, 1 pièce',
    ]);
    await fireEvent.press(vignettes[1]);
    expect(screen.getByRole('header', { name: 'Janvier · Genkan, l’entrée' })).toBeTruthy();
  });
});
