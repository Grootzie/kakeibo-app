// Cartes de première fois de J2 (#48), avec le vrai store sur une base de test : chaque carte
// s'affiche à son moment, se ferme d'une touche, est lue par le lecteur d'écran, puis ne revient
// jamais, y compris après redémarrage.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import catalogueJson from '../../content/catalogue.json';
import { migrate } from '../../data/migrations';
import { createRepositories } from '../../data/repositories';
import { createTestDb } from '../../data/testDb';
import type { Catalog } from '../../domain/objets';
import { fr } from '../../i18n/fr';
import { createClock } from '../../state/clock';
import { type DependancesStore, createKakeiboStore } from '../../state/store';
import { EcranAccueil } from '../accueil/EcranAccueil';
import { DUREE_TAMPON_MS, EcranCloture } from '../cloture/EcranCloture';

const t = fr.carteExplication.titres;
const fermer = (titre: string) =>
  screen.getByRole('button', { name: fr.carteExplication.fermerLibelle(titre) });

/** Installation le lundi 2 novembre 2026 à 8 h, budget de 600 € en novembre. */
async function preparer() {
  const db = createTestDb();
  await migrate(db);
  const repos = createRepositories(db);
  let reel = new Date(2026, 10, 2, 8, 0);
  let n = 0;
  const deps: DependancesStore = {
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
  /** Redémarrage de l'appli à cette heure : un nouveau store sur la même base. */
  const demarrer = async (d: Date) => {
    reel = d;
    const store = createKakeiboStore(deps);
    await store.getState().ouvrir();
    return store;
  };
  return { repos, demarrer, aller: (d: Date) => (reel = d) };
}

async function noter(texte: string, categorie: string) {
  await fireEvent.press(screen.getByRole('button', { name: fr.accueil.noterDepenseLibelle }));
  await fireEvent.changeText(screen.getByLabelText(fr.depense.montantLibelle), texte);
  await fireEvent.press(
    screen.getByRole('button', { name: fr.depense.categorieLibelle(categorie) }),
  );
}

// À froid (cache Jest vide), le premier rendu charge et transforme les modules de l'accueil, de la
// feuille de dépense et de E4 : plusieurs secondes, qui étaient comptées dans le premier test et
// le faisaient dépasser ses 5 s. On les charge ici une fois, avec un délai à part, avant les tests.
beforeAll(async () => {
  jest.useFakeTimers();
  const { demarrer } = await preparer();
  const store = await demarrer(new Date(2026, 10, 2, 21, 0));
  const accueil = await render(<EcranAccueil store={store} />);
  await noter('1', 'Essentiel');
  await accueil.unmount();
  const e4 = await render(<EcranCloture store={store} onTerminer={() => undefined} />);
  await fireEvent.press(screen.getByRole('button', { name: fr.cloture.ajouterOubliee }));
  await e4.unmount();
  jest.useRealTimers();
}, 60000);

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('« Première dépense »', () => {
  test('rien avant la première dépense, puis la carte, le texte de la spec et sa fermeture', async () => {
    const { demarrer, repos } = await preparer();
    const store = await demarrer(new Date(2026, 10, 2, 12, 0));
    await render(<EcranAccueil store={store} />);
    expect(screen.queryByText(t.first_expense)).toBeNull();

    await noter('4,20', 'Essentiel');
    expect(await screen.findByText(t.first_expense)).toBeOnTheScreen();
    expect(screen.getByText(fr.explications.premiereDepense)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: t.first_expense })).toBeOnTheScreen();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      `${t.first_expense}. ${fr.explications.premiereDepense}`,
    );
    expect((await repos.settings.get())?.seen_explanations).toBe('["first_expense"]');

    await fireEvent.press(fermer(t.first_expense));
    expect(screen.queryByText(t.first_expense)).toBeNull();

    // Une deuxième dépense : plus de carte.
    await act(() => jest.advanceTimersByTime(5000));
    await noter('3', 'Envies');
    expect(screen.queryByText(t.first_expense)).toBeNull();
  });

  test('plus jamais après redémarrage, même fermée sans avoir été touchée', async () => {
    const { demarrer } = await preparer();
    const store = await demarrer(new Date(2026, 10, 2, 12, 0));
    const premier = await render(<EcranAccueil store={store} />);
    await noter('4,20', 'Essentiel');
    expect(await screen.findByText(t.first_expense)).toBeOnTheScreen();
    await premier.unmount();

    const apres = await demarrer(new Date(2026, 10, 2, 13, 0));
    await render(<EcranAccueil store={apres} />);
    expect(screen.getByText(fr.accueil.noterDepense)).toBeOnTheScreen();
    expect(screen.queryByText(t.first_expense)).toBeNull();
  });

  test('aussi sur E4, après une dépense oubliée ; le tampon s’explique à l’accueil', async () => {
    const { demarrer } = await preparer();
    const store = await demarrer(new Date(2026, 10, 2, 21, 0));
    const onTerminer = jest.fn();
    const e4 = await render(<EcranCloture store={store} onTerminer={onTerminer} />);
    await fireEvent.press(screen.getByRole('button', { name: fr.cloture.ajouterOubliee }));
    await fireEvent.changeText(screen.getByLabelText(fr.depense.montantLibelle), '8,40');
    await fireEvent.press(
      screen.getByRole('button', { name: fr.depense.categorieLibelle('Culture') }),
    );
    expect(await screen.findByText(t.first_expense)).toBeOnTheScreen();
    await fireEvent.press(fermer(t.first_expense));

    await fireEvent.press(screen.getByRole('button', { name: fr.cloture.toutNote }));
    await act(async () => {
      jest.advanceTimersByTime(DUREE_TAMPON_MS);
    });
    expect(onTerminer).toHaveBeenCalled();
    expect(screen.queryByText(t.first_stamp)).toBeNull();
    await e4.unmount();

    await render(<EcranAccueil store={store} />);
    expect(await screen.findByText(t.first_stamp)).toBeOnTheScreen();
    expect(screen.queryByText(t.first_expense)).toBeNull();
  });
});

describe('« Premier tampon »', () => {
  test('à l’accueil, au retour de la première clôture, puis plus jamais', async () => {
    const { demarrer, repos } = await preparer();
    const store = await demarrer(new Date(2026, 10, 2, 21, 0));
    await render(<EcranAccueil store={store} />);
    expect(screen.queryByText(t.first_stamp)).toBeNull();

    await act(async () => {
      await store.getState().cloturerJour('2026-11-02');
    });
    expect(await screen.findByText(t.first_stamp)).toBeOnTheScreen();
    expect(screen.getByText(fr.explications.premierTampon)).toBeOnTheScreen();
    await fireEvent.press(fermer(t.first_stamp));
    expect(screen.queryByText(t.first_stamp)).toBeNull();
    expect((await repos.settings.get())?.seen_explanations).toBe('["first_stamp"]');

    const apres = await demarrer(new Date(2026, 10, 3, 21, 0));
    await act(async () => {
      await apres.getState().cloturerJour('2026-11-03');
    });
    await render(<EcranAccueil store={apres} />);
    expect(screen.getByText(fr.accueil.journeeCloturee)).toBeOnTheScreen();
    expect(screen.queryByText(t.first_stamp)).toBeNull();
  });

  test('attend que l’accueil soit visible : rien n’est marqué vu sous un autre écran', async () => {
    const { demarrer, repos } = await preparer();
    const store = await demarrer(new Date(2026, 10, 2, 21, 0));
    const vue = await render(<EcranAccueil store={store} visible={false} />);
    await act(async () => {
      await store.getState().cloturerJour('2026-11-02');
    });
    expect(screen.queryByText(t.first_stamp)).toBeNull();
    expect((await repos.settings.get())?.seen_explanations).toBe('[]');

    await vue.rerender(<EcranAccueil store={store} visible />);
    expect(await screen.findByText(t.first_stamp)).toBeOnTheScreen();
  });
});

describe('« Premier jour à rattraper »', () => {
  test('le lendemain d’un jour sans tampon, sous le bandeau, puis plus jamais', async () => {
    const { demarrer, repos } = await preparer();
    const store = await demarrer(new Date(2026, 10, 3, 12, 0));
    const premier = await render(<EcranAccueil store={store} />);
    expect(screen.getByText(fr.accueil.bandeauRattraper('2026-11-02'))).toBeOnTheScreen();
    expect(await screen.findByText(t.first_catch_up)).toBeOnTheScreen();
    expect(screen.getByText(fr.explications.premierJourARattraper)).toBeOnTheScreen();
    await fireEvent.press(fermer(t.first_catch_up));
    expect(screen.queryByText(t.first_catch_up)).toBeNull();
    expect((await repos.settings.get())?.seen_explanations).toBe('["first_catch_up"]');
    await premier.unmount();

    // Un autre jour oublié, après redémarrage : le bandeau, mais plus la carte.
    const apres = await demarrer(new Date(2026, 10, 5, 12, 0));
    await render(<EcranAccueil store={apres} />);
    expect(screen.getByText(fr.accueil.bandeauRattraper('2026-11-02'))).toBeOnTheScreen();
    expect(screen.queryByText(t.first_catch_up)).toBeNull();
  });

  test('une seule carte à la fois : la suivante après la fermeture', async () => {
    const { demarrer } = await preparer();
    const store = await demarrer(new Date(2026, 10, 3, 12, 0));
    await render(<EcranAccueil store={store} />);
    await noter('2', 'Envies');
    // « Jour à rattraper » est arrivée la première ; « Première dépense » attend.
    expect(await screen.findByText(t.first_catch_up)).toBeOnTheScreen();
    expect(screen.queryByText(t.first_expense)).toBeNull();
    await fireEvent.press(fermer(t.first_catch_up));
    expect(await screen.findByText(t.first_expense)).toBeOnTheScreen();
    expect(screen.queryByText(t.first_catch_up)).toBeNull();
  });
});
