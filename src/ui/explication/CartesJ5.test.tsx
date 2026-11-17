// Dernières cartes de première fois (J5.8, #107), avec le vrai store sur une base de test :
// « Bienvenue, la méthode », « Bienvenue, les catégories » et « Bienvenue, mon mois » pendant E1,
// « Nouvelle année » à l'accueil le lundi de la semaine 1. Chacune une seule fois, même après
// redémarrage.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import catalogueJson from '../../content/catalogue.json';
import { migrate } from '../../data/migrations';
import { type Repositories, createRepositories } from '../../data/repositories';
import { createTestDb } from '../../data/testDb';
import type { Catalog } from '../../domain/objets';
import { fr } from '../../i18n/fr';
import { type Horloge, createClock } from '../../state/clock';
import { lireExplicationsVues } from '../../state/explications';
import { type DependancesStore, type KakeiboStore, createKakeiboStore } from '../../state/store';
import { EcranAccueil } from '../accueil/EcranAccueil';
import { EcranBienvenue } from '../bienvenue/EcranBienvenue';

const t = fr.carteExplication.titres;
const x = fr.explications;
const b = fr.bienvenue;
const fermer = (titre: string) =>
  screen.getByRole('button', { name: fr.carteExplication.fermerLibelle(titre) });
const continuer = () => fireEvent.press(screen.getByRole('button', { name: b.continuerLibelle }));
const retour = () => fireEvent.press(screen.getByRole('button', { name: b.retourLibelle }));

interface Banc {
  repos: Repositories;
  horloge: Horloge;
  store: KakeiboStore;
  redemarrer(): Promise<KakeiboStore>;
}

/** Installation le lundi 2 novembre 2026 à 12 h, horloge de test active. */
async function installer(): Promise<Banc> {
  const db = createTestDb();
  await migrate(db);
  const repos = createRepositories(db);
  const horloge = createClock({ actif: true, reel: () => new Date(2026, 10, 2, 12, 0) });
  let n = 0;
  const deps: DependancesStore = {
    depots: async () => repos,
    catalogue: catalogueJson as Catalog,
    horloge,
    nouvelId: () => `id-${++n}`,
  };
  const redemarrer = async () => {
    const s = createKakeiboStore(deps);
    await s.getState().ouvrir();
    return s;
  };
  return { repos, horloge, store: await redemarrer(), redemarrer };
}

async function vues(repos: Repositories): Promise<string[]> {
  return lireExplicationsVues((await repos.settings.get())?.seen_explanations ?? '');
}

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('cartes de la bienvenue (E1)', () => {
  test('une carte par étape, avec le texte de la spec, lue et marquée vue', async () => {
    const { store, repos } = await installer();
    await render(<EcranBienvenue store={store} onArrivee={() => undefined} />);

    const etapes = [
      { titre: t.welcome_method, texte: x.bienvenueMethode, id: 'welcome_method' },
      { titre: t.welcome_categories, texte: x.bienvenueCategories, id: 'welcome_categories' },
      { titre: t.welcome_month, texte: x.bienvenueMois, id: 'welcome_month' },
    ];
    for (const [i, e] of etapes.entries()) {
      if (i > 0) await continuer();
      expect(await screen.findByTestId(`explication-${e.id}`)).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: e.titre })).toBeOnTheScreen();
      expect(screen.getByText(e.texte)).toBeOnTheScreen();
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
        `${e.titre}. ${e.texte}`,
      );
      // Une seule carte à la fois : celle de l'étape.
      for (const autre of etapes.filter((a) => a.id !== e.id)) {
        expect(screen.queryByTestId(`explication-${autre.id}`)).toBeNull();
      }
    }
    expect(await vues(repos)).toEqual(['welcome_method', 'welcome_categories', 'welcome_month']);
  });

  test('les titres sont ceux de la spec', () => {
    expect(t.welcome_method).toBe('Bienvenue, la méthode');
    expect(t.welcome_categories).toBe('Bienvenue, les catégories');
    expect(t.welcome_month).toBe('Bienvenue, mon mois');
    expect(t.new_year).toBe('Nouvelle année');
  });

  test('fermée, elle ne revient pas en revenant à son étape', async () => {
    const { store } = await installer();
    await render(<EcranBienvenue store={store} onArrivee={() => undefined} />);
    expect(await screen.findByTestId('explication-welcome_method')).toBeOnTheScreen();
    await fireEvent.press(fermer(t.welcome_method));
    expect(screen.queryByTestId('explication-welcome_method')).toBeNull();
    await continuer();
    expect(await screen.findByTestId('explication-welcome_categories')).toBeOnTheScreen();
    await retour();
    expect(screen.getByRole('header', { name: b.methode.titre })).toBeOnTheScreen();
    expect(screen.queryByTestId('explication-welcome_method')).toBeNull();
    expect(screen.queryByText(x.bienvenueMethode)).toBeNull();
  });

  test('pas fermée, elle reste à son étape tant que la bienvenue est ouverte', async () => {
    const { store } = await installer();
    await render(<EcranBienvenue store={store} onArrivee={() => undefined} />);
    expect(await screen.findByTestId('explication-welcome_method')).toBeOnTheScreen();
    await continuer();
    await retour();
    expect(screen.getByTestId('explication-welcome_method')).toBeOnTheScreen();
  });

  test('après redémarrage pendant la bienvenue, les cartes vues ne reviennent jamais', async () => {
    const { store, redemarrer } = await installer();
    const premier = await render(<EcranBienvenue store={store} onArrivee={() => undefined} />);
    expect(await screen.findByTestId('explication-welcome_method')).toBeOnTheScreen();
    await continuer();
    expect(await screen.findByTestId('explication-welcome_categories')).toBeOnTheScreen();
    await premier.unmount();

    const apres = await redemarrer();
    await render(<EcranBienvenue store={apres} onArrivee={() => undefined} />);
    expect(screen.getByRole('header', { name: b.methode.titre })).toBeOnTheScreen();
    expect(screen.queryByTestId('explication-welcome_method')).toBeNull();
    await continuer();
    expect(screen.queryByTestId('explication-welcome_categories')).toBeNull();
    // Pas encore vue : « Bienvenue, mon mois » s'affiche à son étape.
    await continuer();
    expect(await screen.findByTestId('explication-welcome_month')).toBeOnTheScreen();
  });
});

describe('« Nouvelle année » (accueil)', () => {
  async function avecBudget() {
    const banc = await installer();
    await banc.store.getState().poserBudgetInitial({
      income: 200000,
      fixedCosts: 110000,
      savingsGoal: 30000,
    });
    return banc;
  }

  test('rien en décembre, puis la carte le lundi de la semaine 1, une seule fois', async () => {
    const { horloge, redemarrer, repos } = await avecBudget();
    // Toutes les cartes de J2 déjà vues : seule « Nouvelle année » peut venir.
    for (const id of ['first_expense', 'first_stamp', 'first_catch_up'] as const) {
      await (await redemarrer()).getState().marquerExplicationVue(id);
    }
    // Dimanche 3 janvier 2027 : encore la semaine 53 de 2026.
    horloge.avancerJours(62);
    const dimanche = await redemarrer();
    expect(dimanche.getState().maintenant?.day).toBe('2027-01-03');
    const avant = await render(<EcranAccueil store={dimanche} />);
    expect(screen.queryByTestId('explication-new_year')).toBeNull();
    await avant.unmount();

    // Lundi 4 janvier 2027.
    horloge.avancerJours(1);
    const lundi = await redemarrer();
    const ecran = await render(<EcranAccueil store={lundi} />);
    expect(await screen.findByTestId('explication-new_year')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: t.new_year })).toBeOnTheScreen();
    expect(screen.getByText(x.nouvelleAnnee)).toBeOnTheScreen();
    expect(await vues(repos)).toContain('new_year');
    await fireEvent.press(fermer(t.new_year));
    expect(screen.queryByTestId('explication-new_year')).toBeNull();
    await ecran.unmount();

    // Redémarrage, le même jour puis le lendemain : plus jamais.
    await render(<EcranAccueil store={await redemarrer()} />);
    expect(screen.queryByTestId('explication-new_year')).toBeNull();
    horloge.avancerJours(1);
    await render(<EcranAccueil store={await redemarrer()} />);
    expect(screen.queryByTestId('explication-new_year')).toBeNull();
  });
});
