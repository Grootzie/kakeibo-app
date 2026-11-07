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
async function monter(onCloturer?: () => void) {
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
  await render(<EcranAccueil store={store} onCloturer={onCloturer} />);
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
