// Noter une dépense depuis l'accueil (E3, #44), avec le vrai store sur une base de test :
// l'enveloppe se met à jour, « Annuler » reste 5 secondes et supprime la dépense.
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import catalogueJson from '../../content/catalogue.json';
import { migrate } from '../../data/migrations';
import { createRepositories } from '../../data/repositories';
import { createTestDb } from '../../data/testDb';
import type { Catalog } from '../../domain/objets';
import { fr } from '../../i18n/fr';
import { createClock } from '../../state/clock';
import { createKakeiboStore } from '../../state/store';
import { EcranAccueil } from './EcranAccueil';

/** Installation le lundi 2 novembre 2026, budget de 600 € en novembre ; on est le vendredi 6. */
async function monter(onCloturer?: () => void, onRattraper?: (jour: string) => void) {
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
  reel = new Date(2026, 10, 6, 12, 0);
  const store = createKakeiboStore(deps);
  await store.getState().ouvrir();
  await render(<EcranAccueil store={store} onCloturer={onCloturer} onRattraper={onRattraper} />);
  return { repos, store };
}

async function noter(texte: string, categorie: string) {
  await fireEvent.press(screen.getByRole('button', { name: fr.accueil.noterDepenseLibelle }));
  await fireEvent.changeText(screen.getByLabelText(fr.depense.montantLibelle), texte);
  await fireEvent.press(
    screen.getByRole('button', { name: fr.depense.categorieLibelle(categorie) }),
  );
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('noter une dépense depuis l’accueil', () => {
  test('« Noter une dépense » ouvre la feuille, avec les jours de la semaine jusqu’à aujourd’hui', async () => {
    await monter();
    expect(screen.queryByTestId('feuille-depense')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: fr.accueil.noterDepenseLibelle }));
    expect(screen.getByTestId('feuille-depense')).toBeOnTheScreen();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    expect(screen.getAllByRole('radio')[0]).toHaveAccessibleName('vendredi 6 novembre');
  });

  test('l’enveloppe se met à jour, la feuille se ferme et « Annuler » reste 5 secondes', async () => {
    const { repos } = await monter();
    expect(screen.getByText('Il te reste 140 € jusqu’à dimanche')).toBeOnTheScreen();
    await noter('12,50', 'Envies');
    expect(await screen.findByText('Il te reste 127,50 € jusqu’à dimanche')).toBeOnTheScreen();
    expect(screen.queryByTestId('feuille-depense')).toBeNull();
    expect(await repos.expenses.all()).toMatchObject([
      { day: '2026-11-06', amount: 1250, category: 'envies', note: '' },
    ]);
    expect(screen.getByRole('button', { name: fr.depense.annulerLibelle })).toBeOnTheScreen();

    await act(() => jest.advanceTimersByTime(4999));
    expect(screen.getByRole('button', { name: fr.depense.annulerLibelle })).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTime(1));
    expect(screen.queryByRole('button', { name: fr.depense.annulerLibelle })).toBeNull();
    // La dépense reste notée.
    expect(await repos.expenses.all()).toHaveLength(1);
  });

  test('« Annuler » supprime la dépense et rend l’enveloppe', async () => {
    const { repos, store } = await monter();
    await noter('30', 'Essentiel');
    expect(await screen.findByText('Il te reste 110 € jusqu’à dimanche')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: fr.depense.annulerLibelle }));
    expect(await screen.findByText('Il te reste 140 € jusqu’à dimanche')).toBeOnTheScreen();
    expect(screen.queryByTestId('message-annuler')).toBeNull();
    expect(await repos.expenses.all()).toEqual([]);
    expect(store.getState().etat?.expenses).toEqual([]);
  });
});

describe('clôturer ma journée depuis l’accueil (E4, #45)', () => {
  test('« Clôturer ma journée » ouvre E4', async () => {
    const onCloturer = jest.fn();
    await monter(onCloturer);
    await fireEvent.press(screen.getByRole('button', { name: fr.accueil.cloturerJournee }));
    expect(onCloturer).toHaveBeenCalledTimes(1);
  });

  test('au retour, la case du jour est clôturée et le bouton devient « Journée clôturée »', async () => {
    const { store } = await monter(jest.fn());
    expect(screen.getByLabelText('vendredi, à clôturer aujourd’hui')).toBeOnTheScreen();
    await act(() => store.getState().cloturerJour('2026-11-06'));
    expect(screen.getByLabelText('vendredi, clôturé')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: fr.accueil.journeeCloturee })).toBeDisabled();
    expect(screen.queryByRole('button', { name: fr.accueil.cloturerJournee })).toBeNull();
  });
});

describe('rattraper un jour depuis l’accueil (E5, #46)', () => {
  test('le bandeau ouvre le plus ancien jour à rattraper, une case ouvre le sien', async () => {
    const onRattraper = jest.fn();
    const { store } = await monter(undefined, onRattraper);
    await act(() => store.getState().cloturerJour('2026-11-02'));
    await fireEvent.press(
      screen.getByRole('button', { name: fr.accueil.bandeauRattraper('2026-11-03') }),
    );
    expect(onRattraper).toHaveBeenLastCalledWith('2026-11-03');
    await fireEvent.press(screen.getByRole('button', { name: 'jeudi, à rattraper' }));
    expect(onRattraper).toHaveBeenLastCalledWith('2026-11-05');
  });
});

describe('bandeau des bilans depuis l’accueil (J3.1, #61)', () => {
  test('la semaine scellée propose son bilan, puis, une fois vu, le jour à rattraper revient', async () => {
    const db = createTestDb();
    await migrate(db);
    const repos = createRepositories(db);
    let reel = new Date(2026, 10, 2, 8, 0);
    const store = createKakeiboStore({
      depots: async () => repos,
      catalogue: catalogueJson as Catalog,
      horloge: createClock({ actif: true, reel: () => reel }),
      nouvelId: () => 'id',
    });
    await store.getState().ouvrir();
    reel = new Date(2026, 10, 10, 9, 0); // mardi 10 novembre : la semaine 45 est scellée
    await store.getState().ouvrir();
    const onBilanSemaine = jest.fn();
    await render(<EcranAccueil store={store} onBilanSemaine={onBilanSemaine} />);
    await fireEvent.press(screen.getByRole('button', { name: fr.accueil.bandeauBilanSemaine }));
    expect(onBilanSemaine).toHaveBeenCalledTimes(1);
    await act(() => store.getState().marquerBilansVus());
    expect(screen.queryByRole('button', { name: fr.accueil.bandeauBilanSemaine })).toBeNull();
    expect(
      screen.getByRole('button', { name: fr.accueil.bandeauRattraper('2026-11-09') }),
    ).toBeOnTheScreen();
  });
});

describe('bilan du mois à l’ouverture (E7, J3.4, #64)', () => {
  /** Installée le lundi 2 novembre 2026, rouverte le 1er décembre à 9:00. */
  async function decembre() {
    const db = createTestDb();
    await migrate(db);
    const repos = createRepositories(db);
    let reel = new Date(2026, 10, 2, 8, 0);
    const store = createKakeiboStore({
      depots: async () => repos,
      catalogue: catalogueJson as Catalog,
      horloge: createClock({ actif: true, reel: () => reel }),
      nouvelId: () => 'id',
    });
    await store.getState().ouvrir();
    reel = new Date(2026, 11, 1, 9, 0);
    await store.getState().ouvrir();
    return store;
  }

  test('s’ouvre seul, une fois, quand il est le premier bilan à faire', async () => {
    const store = await decembre();
    await store.getState().marquerBilansVus();
    const onBilanMois = jest.fn();
    const { rerender } = await render(<EcranAccueil store={store} onBilanMois={onBilanMois} />);
    expect(onBilanMois).toHaveBeenCalledTimes(1);
    // Retour à l'accueil sans valider : il ne se rouvre pas, le bandeau reste.
    await rerender(<EcranAccueil store={store} onBilanMois={onBilanMois} visible={false} />);
    await rerender(<EcranAccueil store={store} onBilanMois={onBilanMois} visible />);
    await act(() => store.getState().ouvrir());
    expect(onBilanMois).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: fr.accueil.bandeauBilanMois('2026-11') }),
    ).toBeOnTheScreen();
  });

  test('attend que les bilans de semaine soient vus, puis s’ouvre', async () => {
    const store = await decembre();
    const onBilanMois = jest.fn();
    await render(<EcranAccueil store={store} onBilanMois={onBilanMois} />);
    expect(onBilanMois).not.toHaveBeenCalled();
    await act(() => store.getState().marquerBilansVus());
    expect(onBilanMois).toHaveBeenCalledTimes(1);
  });

  test('ne s’ouvre pas sous un autre écran', async () => {
    const store = await decembre();
    await store.getState().marquerBilansVus();
    const onBilanMois = jest.fn();
    await render(<EcranAccueil store={store} onBilanMois={onBilanMois} visible={false} />);
    expect(onBilanMois).not.toHaveBeenCalled();
  });
});
