// Récapitulatif après une longue absence (E6, J3.3, #63), avec le vrai store sur une base de
// test : un seul écran pour les semaines manquées, une ligne par semaine de la plus ancienne à la
// plus récente, puis la poussière et la file de réparation ; « Continuer » les marque toutes vues.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import catalogueJson from '../../content/catalogue.json';
import { migrate } from '../../data/migrations';
import { type Repositories, createRepositories } from '../../data/repositories';
import { createTestDb } from '../../data/testDb';
import type { Catalog } from '../../domain/objets';
import { weekReviewScreen } from '../../domain/traitement';
import { fr } from '../../i18n/fr';
import { createClock } from '../../state/clock';
import { type KakeiboStore, createKakeiboStore } from '../../state/store';
import { EcranBilanSemaine } from './EcranBilanSemaine';

const N = '\u00a0';
const r = fr.recapitulatif;

interface Preparation {
  repos: Repositories;
  store: KakeiboStore;
  /** Nouveau store sur la même base : un redémarrage de l'appli. */
  redemarrer: () => KakeiboStore;
}

/**
 * Installation le lundi 2 novembre 2026, budget de novembre (140 € par semaine). Semaine 45 :
 * 150 € notés le mardi 3 et chaque jour clôturé le soir, sauf `semaine45: false`. Puis plus
 * aucune ouverture jusqu'à `retour`.
 */
async function preparer(options: { retour: Date; semaine45?: boolean }): Promise<Preparation> {
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
  if (options.semaine45 !== false) {
    reel = new Date(2026, 10, 3, 12, 0);
    await store.getState().noterDepense({
      day: '2026-11-03',
      amount: 15000,
      category: 'envies',
      note: '',
    });
    for (let j = 2; j <= 8; j++) {
      reel = new Date(2026, 10, j, 21, 0);
      await store.getState().cloturerJour(`2026-11-0${j}`);
    }
  }
  reel = options.retour;
  await store.getState().ouvrir();
  return { repos, store, redemarrer: () => createKakeiboStore(deps) };
}

/** Trois semaines d'absence : de retour le mercredi 25 novembre, les semaines 45 à 47 attendent. */
const troisSemaines = () => preparer({ retour: new Date(2026, 10, 25, 9, 0) });

async function monter(p: Preparation) {
  const onTerminer = jest.fn();
  await render(<EcranBilanSemaine store={p.store} onTerminer={onTerminer} />);
  return { ...p, onTerminer };
}

const lignesSemaines = () => screen.getAllByLabelText(/^Semaine du /);

describe('un seul écran pour les semaines manquées', () => {
  it('s’affiche à la place des bilans un par un quand plusieurs semaines attendent', async () => {
    const p = await troisSemaines();
    expect(weekReviewScreen(p.store.getState().etat!)).toEqual({
      kind: 'recap',
      weeks: ['2026-W45', '2026-W46', '2026-W47'],
    });
    await monter(p);
    expect(screen.getByRole('header', { name: r.titre })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: fr.bilan.titreSemaine })).toBeNull();
  });

  it('une seule semaine : le bilan de la semaine, pas le récapitulatif', async () => {
    await monter(await preparer({ retour: new Date(2026, 10, 10, 9, 0) }));
    expect(screen.getByRole('header', { name: fr.bilan.titreSemaine })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: r.titre })).toBeNull();
  });
});

describe('une ligne par semaine', () => {
  it('se lit dans l’ordre, de la plus ancienne semaine à la plus récente', async () => {
    await monter(await troisSemaines());
    expect(lignesSemaines().map((l) => l.props.accessibilityLabel)).toEqual([
      r.ligneLibelle([
        `Semaine du 2${N}novembre`,
        '7 tampons sur 7',
        r.horsEnveloppe,
        r.objetGagne('râteau porte-bonheur kumade'),
        r.objetFele('échelle'),
      ]),
      r.ligneLibelle([`Semaine du 9${N}novembre`, '0 tampon sur 7', r.dansEnveloppe, r.poussiere]),
      r.ligneLibelle([`Semaine du 16${N}novembre`, '0 tampon sur 7', r.dansEnveloppe, r.poussiere]),
    ]);
  });

  it('affiche tampons, enveloppe, objet gagné ou poussière et objet fêlé', async () => {
    await monter(await troisSemaines());
    expect(screen.getByText(`Semaine du 2${N}novembre`)).toBeOnTheScreen();
    expect(screen.getByText('7 tampons sur 7')).toBeOnTheScreen();
    expect(screen.getAllByText('0 tampon sur 7')).toHaveLength(2);
    expect(screen.getByText(r.horsEnveloppe)).toBeOnTheScreen();
    expect(screen.getByText(r.objetGagne('râteau porte-bonheur kumade'))).toBeOnTheScreen();
    expect(screen.getByText(r.objetFele('échelle'))).toBeOnTheScreen();
    expect(screen.getAllByText(r.poussiere)).toHaveLength(2);
  });
});

describe('la maison, après les semaines', () => {
  it('poussière et file de réparation, puis une conclusion qui encourage', async () => {
    await monter(await troisSemaines());
    expect(screen.getByRole('header', { name: r.maisonTitre })).toBeOnTheScreen();
    expect(screen.getByText(fr.messages.poussiereJours)).toBeOnTheScreen();
    expect(screen.getByText(fr.messages.poussiereSemaineIncomplete)).toBeOnTheScreen();
    expect(screen.getByText(r.reparationEnCours('échelle', 0))).toBeOnTheScreen();
    expect(screen.getByText(r.conclusion)).toBeOnTheScreen();
  });

  it('scénario 14 : aucune fêlure, rien à réparer', async () => {
    // Semaine 45 jamais clôturée ni dépensée ; retour le mardi 1er décembre au matin.
    await monter(await preparer({ retour: new Date(2026, 11, 1, 9, 0), semaine45: false }));
    expect(lignesSemaines()).toHaveLength(4);
    expect(screen.queryByText(/^Objet fêlé/)).toBeNull();
    expect(screen.getByText(r.reparationAucune)).toBeOnTheScreen();
    expect(screen.getByText(fr.messages.poussiereJours)).toBeOnTheScreen();
  });
});

describe('à la fin', () => {
  it('« Continuer » marque toutes les semaines vues, même après redémarrage', async () => {
    const p = await monter(await troisSemaines());
    const continuer = screen.getByRole('button', { name: r.continuer });
    expect(StyleSheet.flatten(continuer.props.style).minHeight).toBeGreaterThanOrEqual(44);
    await fireEvent.press(continuer);
    expect(p.onTerminer).toHaveBeenCalledTimes(1);
    expect(p.store.getState().etat?.unseenWeeks).toEqual([]);
    expect((await p.repos.weekResults.all()).map((w) => [w.week, w.ceremony_seen])).toEqual([
      ['2026-W45', 1],
      ['2026-W46', 1],
      ['2026-W47', 1],
    ]);
    // L'écran garde le récapitulatif jusqu'à ce qu'on le quitte.
    expect(screen.getByRole('header', { name: r.titre })).toBeOnTheScreen();
    const apres = p.redemarrer();
    await apres.getState().ouvrir();
    expect(weekReviewScreen(apres.getState().etat!)).toBeNull();
  });

  it('« Retour » ramène à l’accueil sans rien marquer vu', async () => {
    const p = await monter(await troisSemaines());
    await fireEvent.press(screen.getByRole('button', { name: fr.bilan.retourLibelle }));
    expect(p.onTerminer).toHaveBeenCalledTimes(1);
    expect(p.store.getState().etat?.unseenWeeks).toHaveLength(3);
  });

  it('un échec de l’enregistrement s’explique et laisse l’écran ouvert', async () => {
    const p = await monter(await troisSemaines());
    jest.spyOn(p.store.getState(), 'marquerBilansVus').mockRejectedValueOnce(new Error('base'));
    await fireEvent.press(screen.getByRole('button', { name: r.continuer }));
    expect(screen.getByText(r.refus)).toBeOnTheScreen();
    expect(p.onTerminer).not.toHaveBeenCalled();
  });
});
