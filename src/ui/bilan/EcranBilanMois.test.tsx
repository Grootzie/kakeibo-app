// Bilan du mois (E7, #64), avec le vrai store sur une base de test : Q1 à Q3 chiffrées et par
// catégorie, épargne réelle, Q4 en 140 caractères, validation qui ouvre la pièce suivante.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

import catalogueJson from '../../content/catalogue.json';
import { migrate } from '../../data/migrations';
import { type Repositories, createRepositories } from '../../data/repositories';
import { createTestDb } from '../../data/testDb';
import type { Catalog } from '../../domain/objets';
import { fr } from '../../i18n/fr';
import { createClock } from '../../state/clock';
import { type KakeiboStore, createKakeiboStore } from '../../state/store';
import { EcranBilanMois } from './EcranBilanMois';

const N = ' ';
const euros = (texte: string) => texte.replace(/ €/g, `${N}€`);

interface Depense {
  day: string;
  amount: number;
  category: 'essentiel' | 'envies' | 'culture' | 'imprevus';
}

/**
 * Installation le lundi 2 novembre 2026 ; budget de novembre (Q1 900 €, Q2 300 €) sauf
 * `budget: false` ; dépenses notées en novembre, puis ouverture à `maintenant`.
 */
async function preparer(
  options: { depenses?: Depense[]; maintenant?: Date; budget?: boolean } = {},
): Promise<{ repos: Repositories; store: KakeiboStore }> {
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
  if (options.budget !== false) {
    await repos.budgetVersions.add({
      id: 'b-nov',
      month: '2026-11',
      income: 200000,
      fixed_costs: 110000,
      savings_goal: 30000,
      effective_from: '2026-11-02',
    });
  }
  const store = createKakeiboStore(deps);
  for (const d of options.depenses ?? []) {
    reel = new Date(`${d.day}T12:00`);
    await store.getState().noterDepense({ ...d, note: '' });
  }
  reel = options.maintenant ?? new Date(2026, 11, 1, 9, 0);
  await store.getState().ouvrir();
  return { repos, store };
}

async function monter(p: { repos: Repositories; store: KakeiboStore }) {
  const onTerminer = jest.fn();
  await render(<EcranBilanMois store={p.store} onTerminer={onTerminer} />);
  return { ...p, onTerminer };
}

const bouton = (nom: string) => screen.getByRole('button', { name: nom });

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('les trois premières questions', () => {
  it('scénario 17 : mois atteint, chiffré par catégorie et sans rien saisir', async () => {
    await monter(
      await preparer({
        depenses: [
          { day: '2026-11-03', amount: 42000, category: 'essentiel' },
          { day: '2026-11-20', amount: 10000, category: 'culture' },
        ],
      }),
    );
    expect(screen.getByRole('header', { name: 'Bilan de novembre' })).toBeOnTheScreen();
    expect(screen.getByLabelText(euros('Ce que j’avais : 900 €'))).toBeOnTheScreen();
    expect(
      screen.getByLabelText(euros('Ce que je voulais mettre de côté : 300 €')),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(euros('Ce que j’ai dépensé : 520 €'))).toBeOnTheScreen();
    expect(screen.getByLabelText(euros('Essentiel : 420 €'))).toBeOnTheScreen();
    expect(screen.getByLabelText(euros('Culture : 100 €'))).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Envies/)).toBeNull();
    expect(screen.getByLabelText(euros('Ce que j’ai vraiment épargné : 380 €'))).toBeOnTheScreen();
    expect(screen.getByText(fr.bilanMois.objectifAtteint)).toBeOnTheScreen();
    expect(screen.queryByText(fr.bilanMois.objectifManque)).toBeNull();
  });

  it('mois manqué : l’épargne réelle et un constat, sans reproche', async () => {
    await monter(
      await preparer({
        depenses: [
          { day: '2026-11-03', amount: 61250, category: 'essentiel' },
          { day: '2026-11-10', amount: 5000, category: 'imprevus' },
        ],
      }),
    );
    expect(screen.getByLabelText(euros('Ce que j’ai dépensé : 662,50 €'))).toBeOnTheScreen();
    expect(screen.getByLabelText(euros('Imprévus : 50 €'))).toBeOnTheScreen();
    expect(
      screen.getByLabelText(euros('Ce que j’ai vraiment épargné : 237,50 €')),
    ).toBeOnTheScreen();
    expect(screen.getByText(fr.bilanMois.objectifManque)).toBeOnTheScreen();
    expect(screen.queryByText(fr.bilanMois.objectifAtteint)).toBeNull();
  });

  it('scénario 25 : décembre sans version du budget reprend celle de novembre', async () => {
    const p = await preparer({
      depenses: [{ day: '2026-12-10', amount: 45000, category: 'envies' }],
      maintenant: new Date(2027, 0, 4, 9, 0),
    });
    // Seul le dernier mois terminé est proposé : décembre, pas novembre.
    expect(p.store.getState().etat?.monthToReview).toBe('2026-12');
    await monter(p);
    expect(screen.getByRole('header', { name: 'Bilan de décembre' })).toBeOnTheScreen();
    expect(screen.getByLabelText(euros('Ce que j’avais : 900 €'))).toBeOnTheScreen();
    expect(screen.getByLabelText(euros('Ce que j’ai dépensé : 450 €'))).toBeOnTheScreen();
    expect(screen.getByLabelText(euros('Ce que j’ai vraiment épargné : 450 €'))).toBeOnTheScreen();
    expect(screen.getByText(fr.bilanMois.objectifAtteint)).toBeOnTheScreen();
  });

  it('aucun budget posé : le dépensé seul, sans épargne ni objectif', async () => {
    await monter(
      await preparer({
        budget: false,
        depenses: [{ day: '2026-11-03', amount: 2000, category: 'culture' }],
      }),
    );
    expect(screen.getByText(fr.bilanMois.sansBudget)).toBeOnTheScreen();
    expect(screen.getByLabelText(euros('Ce que j’ai dépensé : 20 €'))).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Ce que j’avais/)).toBeNull();
    expect(screen.queryByLabelText(/^Ce que j’ai vraiment épargné/)).toBeNull();
    expect(bouton(fr.bilanMois.valider)).toBeOnTheScreen();
  });

  it('sans mois à faire, le dit et ramène à l’accueil', async () => {
    const { onTerminer } = await monter(await preparer({ maintenant: new Date(2026, 10, 20, 9) }));
    expect(screen.getByRole('header', { name: fr.bilan.titreMoisSans })).toBeOnTheScreen();
    expect(screen.getByText(fr.bilanMois.rienAFaire)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: fr.bilanMois.valider })).toBeNull();
    await fireEvent.press(bouton(fr.bilan.retourLibelle));
    expect(onTerminer).toHaveBeenCalledTimes(1);
  });
});

describe('la quatrième question', () => {
  it('se remplit en texte libre de 140 caractères au plus, avec compteur', async () => {
    await monter(await preparer());
    expect(screen.getByRole('header', { name: fr.bilanMois.q4 })).toBeOnTheScreen();
    const champ = screen.getByLabelText(fr.bilanMois.q4Libelle);
    expect(screen.getByText('0/140')).toBeOnTheScreen();
    await fireEvent.changeText(champ, 'Cuisiner le soir.');
    expect(screen.getByText('17/140')).toBeOnTheScreen();
    await fireEvent.changeText(champ, 'a'.repeat(150));
    expect(champ.props.value).toBe('a'.repeat(140));
    expect(screen.getByText('140/140')).toBeOnTheScreen();
  });

  it('compte un emoji pour un caractère, comme le domaine', async () => {
    await monter(await preparer());
    const champ = screen.getByLabelText(fr.bilanMois.q4Libelle);
    await fireEvent.changeText(champ, '🍙'.repeat(141));
    expect(Array.from(champ.props.value as string)).toHaveLength(140);
    expect(screen.getByText('140/140')).toBeOnTheScreen();
  });
});

describe('la validation', () => {
  it('enregistre le bilan avec sa résolution et ouvre la pièce de décembre', async () => {
    const { repos, store, onTerminer } = await monter(
      await preparer({ depenses: [{ day: '2026-11-03', amount: 52000, category: 'envies' }] }),
    );
    await fireEvent.changeText(screen.getByLabelText(fr.bilanMois.q4Libelle), 'Cuisiner le soir.');
    const valider = bouton(fr.bilanMois.valider);
    expect(StyleSheet.flatten(valider.props.style).minHeight).toBeGreaterThanOrEqual(44);
    await fireEvent.press(valider);
    const message = `La pièce de décembre s’ouvre${N}: c’est le mois d’Ōmisoka, le réveillon.`;
    expect(await screen.findByText(message)).toBeOnTheScreen();
    expect(screen.getByText(fr.bilanMois.enregistre('2026-11'))).toBeOnTheScreen();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      `${fr.bilanMois.enregistre('2026-11')} ${message}`,
    );
    expect(await repos.monthReviews.all()).toEqual([
      expect.objectContaining({ month: '2026-11', resolution: 'Cuisiner le soir.', q3: '52000' }),
    ]);
    expect(store.getState().etat?.monthToReview).toBeNull();
    // Plus de question ni de bouton de validation : le bilan est fait.
    expect(screen.queryByRole('button', { name: fr.bilanMois.valider })).toBeNull();
    await fireEvent.press(bouton(fr.bilan.retourLibelle));
    expect(onTerminer).toHaveBeenCalledTimes(1);
  });

  it('valide quel que soit le résultat, avec une résolution vide', async () => {
    const { repos } = await monter(
      await preparer({ depenses: [{ day: '2026-11-03', amount: 80000, category: 'envies' }] }),
    );
    await fireEvent.press(bouton(fr.bilanMois.valider));
    expect(await screen.findByText(/La pièce de décembre s’ouvre/)).toBeOnTheScreen();
    expect(await repos.monthReviews.all()).toEqual([
      expect.objectContaining({ month: '2026-11', resolution: '' }),
    ]);
  });

  it('ouvre aussi les pièces des mois sautés, une phrase chacune', async () => {
    await monter(await preparer({ maintenant: new Date(2027, 3, 1, 9, 0) }));
    expect(screen.getByRole('header', { name: 'Bilan de mars' })).toBeOnTheScreen();
    await fireEvent.press(bouton(fr.bilanMois.valider));
    expect(
      await screen.findByText(
        `La pièce de février s’ouvre${N}: c’est le mois de Setsubun, la veille du printemps.`,
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        `La pièce de mars s’ouvre${N}: c’est le mois de Hinamatsuri, la fête des filles.`,
      ),
    ).toBeOnTheScreen();
    expect(
      screen.getByText(
        `La pièce d’avril s’ouvre${N}: c’est le mois de Hanami, les cerisiers en fleur.`,
      ),
    ).toBeOnTheScreen();
  });

  it('en décembre, rien ne s’ouvre : la nouvelle année s’en charge', async () => {
    const p = await preparer({ maintenant: new Date(2026, 11, 1, 9, 0) });
    await p.store.getState().validerBilanMois('');
    const t = createClock({ actif: true, reel: () => new Date(2027, 0, 4, 9, 0) });
    // Même base, rouverte en janvier : le bilan de décembre est proposé.
    const janvier = createKakeiboStore({
      depots: async () => p.repos,
      catalogue: catalogueJson as Catalog,
      horloge: t,
      nouvelId: () => 'x',
    });
    await janvier.getState().ouvrir();
    await monter({ repos: p.repos, store: janvier });
    await fireEvent.press(bouton(fr.bilanMois.valider));
    expect(await screen.findByText(fr.bilanMois.enregistre('2026-12'))).toBeOnTheScreen();
    expect(screen.queryByText(/s’ouvre/)).toBeNull();
  });
});
