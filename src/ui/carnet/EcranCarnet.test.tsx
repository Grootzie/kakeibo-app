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

  it('filtre par mois : décembre, puis retour à novembre', async () => {
    const p = await preparer();
    p.horloge.avancerJours(21); // mercredi 2 décembre : semaine 49, celle du jeudi 3 décembre
    await act(async () => {
      await p.store.getState().ouvrir();
    });
    await monter(p);
    expect(screen.getByText('Décembre 2026')).toBeOnTheScreen();
    expect(screen.getAllByText(/^Semaine du /)).toHaveLength(1);
    expect(screen.getByText(`Semaine du 30${NBSP}novembre au 6${NBSP}décembre`)).toBeOnTheScreen();
    expect(screen.getByText(t.aucuneDepense)).toBeOnTheScreen();
    const suivant = screen.getByRole('button', { name: 'Mois suivant' });
    expect(suivant).toBeDisabled();

    await fireEvent.press(
      screen.getByRole('button', { name: `Mois précédent${NBSP}: novembre 2026` }),
    );
    expect(screen.getByText('Novembre 2026')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: `novembre 2026, mois 1 sur 2` })).toBeOnTheScreen();
    expect(screen.getAllByText(/^Semaine du /)).toHaveLength(4);
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
});
