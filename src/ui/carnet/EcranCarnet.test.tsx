// Carnet (E9, J5.3, #102), avec le vrai store sur une base de test et l'horloge de test :
// semaines et jours, totaux par catégorie, résultat des semaines scellées sans reproche, filtre
// par mois, libellés d'accessibilité, zones tactiles et texte agrandi à 200 %.
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { readFileSync } from 'fs';
import { join } from 'path';
import { StyleSheet } from 'react-native';

import catalogueJson from '../../content/catalogue.json';
import { migrate } from '../../data/migrations';
import { createRepositories } from '../../data/repositories';
import { createTestDb } from '../../data/testDb';
import type { Catalog } from '../../domain/objets';
import { fr } from '../../i18n/fr';
import { type Horloge, createClock } from '../../state/clock';
import { enveloppeSemaine } from '../../state/selecteurs';
import { type KakeiboStore, createKakeiboStore } from '../../state/store';
import { theme } from '../theme';
import { EcranCarnet } from './EcranCarnet';

const NBSP = '\u00a0';
const t = fr.carnet;

interface Preparation {
  store: KakeiboStore;
  horloge: Horloge;
}

/**
 * Contexte des scénarios : installation le lundi 2 novembre 2026, 600 € par mois, 140 € par
 * semaine. Semaine 45 : 120 € en Essentiel (note « courses ») et 30 € en Envies le mardi 3,
 * chaque jour clôturé : 7 tampons, hors budget. Semaine 46 : 12,50 € en Culture le mardi 10, et
 * nous sommes le mercredi 11 à 9:00.
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
  const noter = (
    day: string,
    amount: number,
    category: 'essentiel' | 'envies' | 'culture',
    note = '',
  ) => store.getState().noterDepense({ day, amount, category, note });
  await noter('2026-11-03', 12000, 'essentiel', 'courses');
  await noter('2026-11-03', 3000, 'envies');
  for (let j = 2; j <= 8; j++) {
    reel = new Date(2026, 10, j, 21, 0);
    await store.getState().cloturerJour(`2026-11-${String(j).padStart(2, '0')}`);
  }
  reel = new Date(2026, 10, 10, 12, 0);
  await noter('2026-11-10', 1250, 'culture');
  reel = new Date(2026, 10, 11, 9, 0);
  await store.getState().ouvrir();
  return { store, horloge };
}

const d = fr.depense;

async function monter(p: Preparation) {
  const onRetour = jest.fn();
  await render(<EcranCarnet store={p.store} onRetour={onRetour} />);
  return onRetour;
}

describe('Carnet (E9, #102)', () => {
  it('montre les semaines du mois, de la plus récente à la plus ancienne', async () => {
    await monter(await preparer());
    expect(screen.getByRole('header', { name: t.titre })).toBeOnTheScreen();
    expect(screen.getByText(`Novembre 2026`)).toBeOnTheScreen();
    const semaines = screen.getAllByText(/^Semaine du /).map((e) => e.props.children);
    expect(semaines).toEqual([
      `Semaine du 9 au 15${NBSP}novembre`,
      `Semaine du 2 au 8${NBSP}novembre`,
    ]);
  });

  it('groupe les dépenses par jour, avec le total du jour et les totaux par catégorie', async () => {
    await monter(await preparer());
    const s45 = within(screen.getByTestId('semaine-2026-W45'));
    expect(
      s45.getByRole('header', { name: `mardi 3${NBSP}novembre, total${NBSP}: 150${NBSP}€` }),
    ).toBeOnTheScreen();
    expect(s45.getByText(`Mardi 3${NBSP}novembre`)).toBeOnTheScreen();
    expect(s45.getByLabelText(`120${NBSP}€ en Essentiel, note${NBSP}: courses`)).toBeOnTheScreen();
    expect(s45.getByText('courses')).toBeOnTheScreen();
    expect(s45.getByLabelText(`30${NBSP}€ en Envies`)).toBeOnTheScreen();
    for (const [nom, total] of [
      ['Essentiel', 12000],
      ['Envies', 3000],
      ['Culture', 0],
      ['Imprévus', 0],
    ] as const)
      expect(s45.getByLabelText(t.totalCategorie(nom, total))).toBeOnTheScreen();
    expect(s45.getByText(`Total de la semaine${NBSP}: 150${NBSP}€`)).toBeOnTheScreen();
    // La catégorie a son icône et son nom : la couleur ne porte rien seule.
    expect(s45.getAllByTestId('icone-essentiel', { includeHiddenElements: true }).length).toBe(2);
  });

  it('une semaine scellée affiche son résultat, sans reproche ; la semaine en cours est ouverte', async () => {
    await monter(await preparer());
    const resultat = screen.getByTestId('resultat-2026-W45');
    expect(resultat.props.accessibilityLabel).toBe(
      `Résultat${NBSP}: 7 tampons sur 7, Dépensé${NBSP}: 150${NBSP}€ sur 140${NBSP}€, Au-delà de ton enveloppe.`,
    );
    expect(within(resultat).getByText('7 tampons sur 7')).toBeOnTheScreen();
    expect(within(resultat).getByText('Au-delà de ton enveloppe')).toBeOnTheScreen();
    expect(screen.queryByTestId('resultat-2026-W46')).toBeNull();
    expect(
      within(screen.getByTestId('semaine-2026-W46')).getByText(t.semaineOuverte),
    ).toBeOnTheScreen();
    // Ni « dépassé », ni rouge d'alerte : rien qui culpabilise.
    expect(screen.queryByText(/dépassé|trop|attention/i)).toBeNull();
  });

  it('filtre par mois : la semaine à cheval est coupée aux jours de chaque mois (#102)', async () => {
    const p = await preparer();
    p.horloge.avancerJours(21); // mercredi 2 décembre : semaine 49, du 30 novembre au 6 décembre
    await act(async () => {
      await p.store.getState().noterDepense({
        day: '2026-11-30',
        amount: 2000,
        category: 'essentiel',
        note: '',
      });
      await p.store.getState().ouvrir();
    });
    await monter(p);
    expect(screen.getByText('Décembre 2026')).toBeOnTheScreen();
    expect(screen.getAllByText(/^Semaine du /)).toHaveLength(1);
    const d49 = within(screen.getByTestId('semaine-2026-W49'));
    expect(d49.getByText(`Semaine du 30${NBSP}novembre au 6${NBSP}décembre`)).toBeOnTheScreen();
    expect(d49.getByText(`Dans ce mois${NBSP}: du 1er au 6${NBSP}décembre`)).toBeOnTheScreen();
    // La dépense du lundi 30 reste sous novembre.
    expect(d49.getByText(t.aucuneDepenseJours)).toBeOnTheScreen();
    const suivant = screen.getByRole('button', { name: 'Mois suivant' });
    expect(suivant).toBeDisabled();

    await fireEvent.press(
      screen.getByRole('button', { name: `Mois précédent${NBSP}: novembre 2026` }),
    );
    expect(screen.getByText('Novembre 2026')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: `novembre 2026, mois 1 sur 2` })).toBeOnTheScreen();
    expect(screen.getAllByText(/^Semaine du /)).toHaveLength(5);
    const n49 = within(screen.getByTestId('semaine-2026-W49'));
    expect(n49.getByText(`Dans ce mois${NBSP}: le 30${NBSP}novembre`)).toBeOnTheScreen();
    expect(n49.getByText(`Total de ces jours${NBSP}: 20${NBSP}€`)).toBeOnTheScreen();
    expect(n49.getByLabelText(`20${NBSP}€ en Essentiel`)).toBeOnTheScreen();
    // Une semaine entière garde son titre de total.
    expect(
      within(screen.getByTestId('semaine-2026-W45')).getByText(
        `Total de la semaine${NBSP}: 150${NBSP}€`,
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mois précédent' })).toBeDisabled();
    await fireEvent.press(
      screen.getByRole('button', { name: `Mois suivant${NBSP}: décembre 2026` }),
    );
    expect(screen.getByText('Décembre 2026')).toBeOnTheScreen();
  });

  it('le retour, des zones tactiles de 44 points, et aucun texte tronqué à 200 %', async () => {
    const onRetour = await monter(await preparer());
    for (const b of screen.getAllByRole('button'))
      expect(StyleSheet.flatten(b.props.style)).toMatchObject({
        minHeight: theme.zoneTactileMin,
        minWidth: theme.zoneTactileMin,
      });
    await fireEvent.press(screen.getByRole('button', { name: t.retourLibelle }));
    expect(onRetour).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('carnet-defilement').type).toBe('RCTScrollView');
    expect(readFileSync(join(__dirname, 'EcranCarnet.tsx'), 'utf8')).not.toMatch(
      /numberOfLines|allowFontScaling|maxFontSizeMultiplier|adjustsFontSizeToFit/,
    );
  });

  describe('modifier ou supprimer une dépense (J5.4, #103)', () => {
    const ouvrir = (libelle: string) =>
      fireEvent.press(screen.getByRole('button', { name: libelle }));

    it('chaque dépense est un bouton qui ouvre la feuille de E3 pré-remplie', async () => {
      await monter(await preparer());
      const ligne = screen.getByRole('button', {
        name: `120${NBSP}€ en Essentiel, note${NBSP}: courses`,
      });
      expect(ligne.props.accessibilityHint).toBe(t.depenseIndice);
      await ouvrir(`120${NBSP}€ en Essentiel, note${NBSP}: courses`);
      expect(screen.getByRole('header', { name: d.titreModifier })).toBeOnTheScreen();
      expect(screen.getByLabelText(d.montantLibelle).props.value).toBe('120');
      expect(screen.getByLabelText(d.noteLibelle).props.value).toBe('courses');
      expect(
        screen.getByRole('button', { name: d.categorieActuelleLibelle('Essentiel') }),
      ).toBeSelected();
      expect(screen.getByRole('radio', { name: d.jourLibelle('2026-11-03') })).toBeSelected();
    });

    it('semaine ouverte : la modification suit dans le carnet et dans l’enveloppe de l’accueil', async () => {
      const p = await preparer();
      await monter(p);
      await ouvrir(`12,50${NBSP}€ en Culture`);
      await fireEvent.changeText(screen.getByLabelText(d.montantLibelle), '40');
      await fireEvent.press(screen.getByRole('button', { name: d.categorieLibelle('Imprévus') }));
      expect(screen.queryByTestId('feuille-depense')).toBeNull();
      const s46 = within(screen.getByTestId('semaine-2026-W46'));
      expect(s46.getByRole('button', { name: `40${NBSP}€ en Imprévus` })).toBeOnTheScreen();
      expect(s46.getByLabelText(t.totalCategorie('Imprévus', 4000))).toBeOnTheScreen();
      expect(s46.getByLabelText(t.totalCategorie('Culture', 0))).toBeOnTheScreen();
      const { etat, maintenant } = p.store.getState();
      expect(enveloppeSemaine(etat!, maintenant!)).toMatchObject({ depense: 4000, reste: 10000 });
    });

    it('semaine scellée : le carnet affiche le nouveau montant, le résultat reste figé (scénario 15)', async () => {
      await monter(await preparer());
      const resultat = screen.getByTestId('resultat-2026-W45').props.accessibilityLabel;
      await ouvrir(`30${NBSP}€ en Envies`);
      // Son jour, puis ceux des semaines ouvertes ; aucun autre jour de la semaine scellée.
      expect(screen.getAllByRole('radio').map((r) => r.props.accessibilityLabel)).toEqual([
        d.jourLibelle('2026-11-11'),
        d.jourLibelle('2026-11-10'),
        d.jourLibelle('2026-11-09'),
        d.jourLibelle('2026-11-03'),
      ]);
      await fireEvent.changeText(screen.getByLabelText(d.montantLibelle), '10');
      await fireEvent.press(
        screen.getByRole('button', { name: d.categorieActuelleLibelle('Envies') }),
      );
      const s45 = within(screen.getByTestId('semaine-2026-W45'));
      expect(s45.getByRole('button', { name: `10${NBSP}€ en Envies` })).toBeOnTheScreen();
      expect(s45.getByText(`Total de la semaine${NBSP}: 130${NBSP}€`)).toBeOnTheScreen();
      expect(screen.getByTestId('resultat-2026-W45').props.accessibilityLabel).toBe(resultat);
    });

    it('supprimer demande confirmation, puis la dépense disparaît et l’enveloppe suit', async () => {
      const p = await preparer();
      await monter(p);
      await ouvrir(`12,50${NBSP}€ en Culture`);
      await fireEvent.press(screen.getByRole('button', { name: d.supprimerLibelle }));
      expect(screen.getByText(d.confirmerSuppression)).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: d.garderLibelle }));
      expect(screen.getByRole('header', { name: d.titreModifier })).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: d.supprimerLibelle }));
      await fireEvent.press(screen.getByRole('button', { name: d.confirmerSupprimerLibelle }));
      expect(screen.queryByTestId('feuille-depense')).toBeNull();
      expect(
        within(screen.getByTestId('semaine-2026-W46')).getByText(t.aucuneDepense),
      ).toBeOnTheScreen();
      const { etat, maintenant } = p.store.getState();
      expect(enveloppeSemaine(etat!, maintenant!)).toMatchObject({ depense: 0, reste: 14000 });
    });

    it('supprimer une dépense d’une semaine scellée laisse son résultat figé', async () => {
      await monter(await preparer());
      const resultat = screen.getByTestId('resultat-2026-W45').props.accessibilityLabel;
      await ouvrir(`120${NBSP}€ en Essentiel, note${NBSP}: courses`);
      await fireEvent.press(screen.getByRole('button', { name: d.supprimerLibelle }));
      await fireEvent.press(screen.getByRole('button', { name: d.confirmerSupprimerLibelle }));
      const s45 = within(screen.getByTestId('semaine-2026-W45'));
      expect(s45.queryByLabelText(/en Essentiel, note/)).toBeNull();
      expect(s45.getByText(`Total de la semaine${NBSP}: 30${NBSP}€`)).toBeOnTheScreen();
      expect(screen.getByTestId('resultat-2026-W45').props.accessibilityLabel).toBe(resultat);
    });

    it('fermer la feuille ne change rien', async () => {
      const p = await preparer();
      await monter(p);
      const avant = p.store.getState().depenses;
      await ouvrir(`30${NBSP}€ en Envies`);
      await fireEvent.press(screen.getByRole('button', { name: d.fermerLibelle }));
      expect(screen.queryByTestId('feuille-depense')).toBeNull();
      expect(p.store.getState().depenses).toBe(avant);
    });
  });
});
