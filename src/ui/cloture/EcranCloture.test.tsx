// Clôturer ma journée (E4, #45), avec le vrai store sur une base de test : dépenses du jour et
// total par catégorie, les deux libellés, la dépense oubliée, le tampon et le refus.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, StyleSheet } from 'react-native';

import catalogueJson from '../../content/catalogue.json';
import { migrate } from '../../data/migrations';
import { type Repositories, createRepositories } from '../../data/repositories';
import { createTestDb } from '../../data/testDb';
import type { Catalog } from '../../domain/objets';
import { fr } from '../../i18n/fr';
import { createClock } from '../../state/clock';
import { type KakeiboStore, createKakeiboStore } from '../../state/store';
import { DUREE_TAMPON_MS, EcranCloture } from './EcranCloture';
import { DUREE_CHUTE_MS, DUREE_FONDU_MS } from './Tampon';

const VENDREDI = '2026-11-06';

interface Montage {
  repos: Repositories;
  store: KakeiboStore;
  onTerminer: jest.Mock;
  /** Change l'heure du téléphone (horloge de l'appli). */
  aller: (d: Date) => void;
}

/** Installation le lundi 2 novembre 2026, budget de 600 € en novembre. */
async function preparer(maintenant = new Date(2026, 10, 6, 21, 0)) {
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
  reel = maintenant;
  const store = createKakeiboStore(deps);
  await store.getState().ouvrir();
  return { repos, store, aller: (d: Date) => (reel = d) };
}

async function monter(
  preparation?: Awaited<ReturnType<typeof preparer>>,
  jour?: string,
): Promise<Montage> {
  const p = preparation ?? (await preparer());
  const onTerminer = jest.fn();
  await render(<EcranCloture store={p.store} jour={jour} onTerminer={onTerminer} />);
  return { ...p, onTerminer };
}

const bouton = (nom: string) => screen.getByRole('button', { name: nom });

// Le premier rendu charge les modules de la Modal : une fois ici, hors de la limite de chaque test.
beforeAll(async () => {
  await monter();
}, 30_000);

let moinsAnimations = false;
beforeEach(() => {
  moinsAnimations = false;
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockImplementation(() => Promise.resolve(moinsAnimations));
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('l’écran', () => {
  it('a un titre, la date du jour et un retour à l’accueil', async () => {
    const { onTerminer } = await monter();
    expect(screen.getByRole('header', { name: fr.cloture.titre })).toBeOnTheScreen();
    expect(screen.getByText('vendredi 6 novembre')).toBeOnTheScreen();
    await fireEvent.press(bouton(fr.cloture.retourLibelle));
    expect(onTerminer).toHaveBeenCalledTimes(1);
  });

  it('liste les dépenses du jour avec le total par catégorie', async () => {
    const p = await preparer();
    const s = p.store.getState();
    await s.noterDepense({ day: VENDREDI, amount: 1250, category: 'envies', note: 'Cinéma' });
    await s.noterDepense({ day: VENDREDI, amount: 400, category: 'imprevus', note: '' });
    await s.noterDepense({ day: VENDREDI, amount: 3000, category: 'envies', note: '' });
    await s.noterDepense({ day: '2026-11-05', amount: 700, category: 'essentiel', note: '' });
    await monter(p);

    expect(screen.getByText('12,50 € en Envies, Cinéma')).toBeOnTheScreen();
    expect(screen.getByText('4 € en Imprévus')).toBeOnTheScreen();
    expect(screen.getByText('30 € en Envies')).toBeOnTheScreen();
    expect(screen.queryByText('7 € en Essentiel')).toBeNull();
    expect(screen.getByText('Envies : 42,50 €')).toBeOnTheScreen();
    expect(screen.getByText('Imprévus : 4 €')).toBeOnTheScreen();
    expect(screen.queryByText(/^Essentiel :/)).toBeNull();
    expect(screen.getByText('Total du jour : 46,50 €')).toBeOnTheScreen();
  });
});

describe('un seul bouton de validation', () => {
  it('« Rien dépensé aujourd’hui » sans dépense ce jour', async () => {
    await monter();
    expect(screen.getByText(fr.cloture.aucuneDepense)).toBeOnTheScreen();
    expect(bouton(fr.cloture.rienDepense)).toBeEnabled();
    expect(screen.queryByRole('button', { name: fr.cloture.toutNote })).toBeNull();
  });

  it('« J’ai tout noté » dès qu’il y a une dépense', async () => {
    const p = await preparer();
    await p.store
      .getState()
      .noterDepense({ day: VENDREDI, amount: 900, category: 'culture', note: '' });
    await monter(p);
    expect(bouton(fr.cloture.toutNote)).toBeEnabled();
    expect(screen.queryByRole('button', { name: fr.cloture.rienDepense })).toBeNull();
  });

  it('« Rien dépensé aujourd’hui » enregistre une clôture sans dépense', async () => {
    const { repos, store } = await monter();
    await fireEvent.press(bouton(fr.cloture.rienDepense));
    expect(await repos.dayClosures.all()).toMatchObject([{ day: VENDREDI, kind: 'no_spend' }]);
    expect(store.getState().etat?.closedDays).toContain(VENDREDI);
  });

  it('« J’ai tout noté » enregistre une clôture complète', async () => {
    const p = await preparer();
    await p.store
      .getState()
      .noterDepense({ day: VENDREDI, amount: 900, category: 'culture', note: '' });
    const { repos } = await monter(p);
    await fireEvent.press(bouton(fr.cloture.toutNote));
    expect(await repos.dayClosures.all()).toMatchObject([{ day: VENDREDI, kind: 'complete' }]);
  });
});

describe('le tampon', () => {
  it('se pose, s’annonce au lecteur d’écran, puis ramène à l’accueil', async () => {
    const { onTerminer } = await monter();
    expect(screen.queryByTestId('tampon')).toBeNull();
    await fireEvent.press(bouton(fr.cloture.rienDepense));
    expect(screen.getByTestId('tampon')).toBeOnTheScreen();
    expect(screen.getByText(fr.cloture.tampon)).toBeOnTheScreen();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Tampon posé sur vendredi 6 novembre.',
    );
    await act(() => jest.advanceTimersByTime(DUREE_TAMPON_MS - 1));
    expect(onTerminer).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(1));
    expect(onTerminer).toHaveBeenCalledTimes(1);
  });

  it('tombe de haut, agrandi et tourné, avec toutes les animations', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await monter();
    await fireEvent.press(bouton(fr.cloture.rienDepense));
    const style = StyleSheet.flatten(screen.getByTestId('tampon').props.style);
    expect(style.transform).toEqual([{ scale: 1.8 }, { rotate: '-30deg' }]);
    expect(style.opacity).toBe(0);
    // La chute, jusqu'à la position posée, finit bien avant le retour à l'accueil.
    const durees = timing.mock.calls.map(([, config]) => config.duration ?? 0);
    expect(durees).toContain(DUREE_CHUTE_MS);
    expect(Math.max(...durees)).toBeLessThan(DUREE_TAMPON_MS);
    expect(timing.mock.calls.every(([, config]) => config.toValue === 1)).toBe(true);
  });

  it('apparaît sur place, sans mouvement, si l’utilisateur a demandé moins d’animations', async () => {
    moinsAnimations = true;
    const timing = jest.spyOn(Animated, 'timing');
    await monter();
    await fireEvent.press(bouton(fr.cloture.rienDepense));
    const style = StyleSheet.flatten(screen.getByTestId('tampon').props.style);
    // Déjà posé : ni agrandi ni tourné davantage, seul un court fondu le fait apparaître.
    expect(style.transform).toEqual([{ scale: 1 }, { rotate: '-8deg' }]);
    expect(timing.mock.calls.map(([, config]) => config.duration)).toEqual([DUREE_FONDU_MS]);
  });
});

describe('une clôture ne s’annule pas', () => {
  it('un jour clôturé affiche « Journée clôturée », inactif, sans rien pour annuler', async () => {
    const p = await preparer();
    await p.store.getState().cloturerJour(VENDREDI);
    await monter(p);
    expect(bouton(fr.cloture.journeeCloturee)).toBeDisabled();
    expect(screen.queryByRole('button', { name: fr.cloture.rienDepense })).toBeNull();
    expect(screen.queryByRole('button', { name: /annuler/i })).toBeNull();
  });
});

describe('ajouter une dépense oubliée', () => {
  const ajouter = async (texte: string, categorie: string) => {
    await fireEvent.press(bouton(fr.cloture.ajouterOubliee));
    expect(screen.getByTestId('feuille-depense')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText(fr.depense.montantLibelle), texte);
    await fireEvent.press(bouton(fr.depense.categorieLibelle(categorie)));
  };

  it('ouvre E3 sur ce jour, puis la liste et le bouton se mettent à jour', async () => {
    const p = await preparer(new Date(2026, 10, 7, 9, 0));
    const { repos } = await monter(p, VENDREDI);
    expect(
      await screen.findByRole('header', { name: fr.cloture.titreRattrapage(VENDREDI) }),
    ).toBeOnTheScreen();
    await fireEvent.press(bouton(fr.cloture.ajouterOubliee));
    const radios = screen.getAllByRole('radio');
    const choisi = radios.filter((r) => r.props.accessibilityState?.selected);
    expect(choisi).toHaveLength(1);
    expect(choisi[0]).toHaveAccessibleName('vendredi 6 novembre');
    await fireEvent.press(bouton(fr.depense.fermerLibelle));

    await ajouter('8,40', 'Culture');
    expect(await screen.findByText('8,40 € en Culture')).toBeOnTheScreen();
    expect(screen.queryByTestId('feuille-depense')).toBeNull();
    expect(bouton(fr.cloture.toutNote)).toBeEnabled();
    expect(await repos.expenses.all()).toMatchObject([
      { day: VENDREDI, amount: 840, category: 'culture' },
    ]);
  });

  it('reste possible sur un jour clôturé tant que sa semaine est ouverte', async () => {
    const p = await preparer();
    await p.store.getState().cloturerJour(VENDREDI);
    const { repos } = await monter(p);
    await ajouter('5', 'Essentiel');
    expect(await screen.findByText('5 € en Essentiel')).toBeOnTheScreen();
    expect(bouton(fr.cloture.journeeCloturee)).toBeDisabled();
    expect(await repos.expenses.all()).toMatchObject([{ day: VENDREDI, amount: 500 }]);
  });
});

describe('refus du domaine', () => {
  it('explique sans reproche qu’une semaine scellée ne se clôture plus', async () => {
    // L'écran est ouvert dimanche soir ; le lundi midi passe avant la touche.
    const p = await preparer(new Date(2026, 10, 8, 23, 50));
    const { repos, onTerminer } = await monter(p, '2026-11-08');
    p.aller(new Date(2026, 10, 9, 12, 0));
    await fireEvent.press(bouton(fr.cloture.rienDepense));
    expect(screen.getByText(fr.cloture.refus.week_sealed)).toBeOnTheScreen();
    expect(screen.queryByTestId('tampon')).toBeNull();
    expect(await repos.dayClosures.all()).toEqual([]);
    await act(() => jest.advanceTimersByTime(DUREE_TAMPON_MS));
    expect(onTerminer).not.toHaveBeenCalled();
  });

  it('a un message pour chaque refus d’une clôture, sans reproche', () => {
    const messages = Object.values(fr.cloture.refus);
    expect(messages).toHaveLength(5);
    messages.forEach((m) => expect(m).not.toMatch(/erreur|échec|interdit|impossible/i));
  });
});

describe('rattraper un jour (E5, #46)', () => {
  const MERCREDI = '2026-11-04';

  it('reprend E4 pour un jour passé, avec le titre « Rattraper mercredi 4 novembre »', async () => {
    const p = await preparer(new Date(2026, 10, 8, 21, 0));
    await p.store
      .getState()
      .noterDepense({ day: MERCREDI, amount: 1250, category: 'envies', note: '' });
    await monter(p, MERCREDI);
    const titre = await screen.findByRole('header', { name: fr.cloture.titreRattrapage(MERCREDI) });
    expect(titre).toHaveTextContent('Rattraper mercredi 4 novembre');
    expect(screen.queryByRole('header', { name: fr.cloture.titre })).toBeNull();
    expect(screen.getByText('12,50 € en Envies')).toBeOnTheScreen();
    expect(screen.getByText(fr.cloture.total(1250))).toBeOnTheScreen();
    expect(bouton(fr.cloture.ajouterOubliee)).toBeEnabled();
    expect(bouton(fr.cloture.toutNote)).toBeEnabled();
  });

  it('dimanche soir, pose le tampon sur ce jour puis ramène à l’accueil', async () => {
    const p = await preparer(new Date(2026, 10, 8, 23, 50));
    const { repos, onTerminer } = await monter(p, MERCREDI);
    await fireEvent.press(await screen.findByRole('button', { name: fr.cloture.rienDepense }));
    expect(screen.getByTestId('tampon')).toBeOnTheScreen();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Tampon posé sur mercredi 4 novembre.',
    );
    expect(await repos.dayClosures.all()).toMatchObject([{ day: MERCREDI, kind: 'no_spend' }]);
    expect(
      screen.getByRole('header', { name: fr.cloture.titreRattrapage(MERCREDI) }),
    ).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTime(DUREE_TAMPON_MS));
    expect(onTerminer).toHaveBeenCalledTimes(1);
  });

  it('s’ouvre encore le lundi suivant à 11:59', async () => {
    const p = await preparer(new Date(2026, 10, 9, 11, 59));
    const { repos, onTerminer } = await monter(p, MERCREDI);
    await fireEvent.press(await screen.findByRole('button', { name: fr.cloture.rienDepense }));
    expect(await repos.dayClosures.all()).toMatchObject([{ day: MERCREDI }]);
    expect(onTerminer).not.toHaveBeenCalled();
  });

  it('ne s’ouvre plus à partir du lundi suivant à 12:00 : retour à l’accueil, rien d’enregistré', async () => {
    const p = await preparer(new Date(2026, 10, 9, 12, 0));
    const { repos, onTerminer } = await monter(p, MERCREDI);
    await act(async () => undefined);
    expect(onTerminer).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('header')).toBeNull();
    expect(screen.queryByRole('button', { name: fr.cloture.rienDepense })).toBeNull();
    expect(screen.queryByRole('button', { name: fr.cloture.ajouterOubliee })).toBeNull();
    expect(await repos.dayClosures.all()).toEqual([]);
  });

  it('ne s’ouvre pas pour un jour déjà clôturé', async () => {
    const p = await preparer(new Date(2026, 10, 8, 21, 0));
    await p.store.getState().cloturerJour(MERCREDI);
    const { onTerminer } = await monter(p, MERCREDI);
    await act(async () => undefined);
    expect(onTerminer).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('header')).toBeNull();
  });
});
