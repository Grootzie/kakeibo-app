// Bilan d'une semaine (E6, J3.2, #62), avec le vrai store sur une base de test : quatre temps
// (tampons, dépensé face à l'enveloppe, résultat, objet et conclusion), la tirette quand la
// semaine a tous ses jetons, les quatre cas du tableau, l'objet en attente, les animations
// réduites, le lecteur d'écran, la reprise au même endroit et `week_reviews_seen` à la fin.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';

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
import { oublierEtapes } from './etapesBilan';

const N = ' ';
const b = fr.bilanSemaine;
const rateau = { nom: 'râteau porte-bonheur kumade', article: 'le', genre: 'm' } as const;
const echelle = { nom: 'échelle', article: "l'", genre: 'f' } as const;

interface Preparation {
  repos: Repositories;
  store: KakeiboStore;
  redemarrer: () => KakeiboStore;
}

/**
 * Installation le `installation` (lundi 2 novembre 2026 par défaut), budget de novembre (140 €
 * par semaine entière). `depense` notée le jour d'installation, chaque jour clôturé le soir
 * jusqu'au dimanche 8 sauf `sauf`, puis ouverture le mardi 10 au matin : la semaine 45 attend.
 */
async function preparer(
  options: { depense?: number; sauf?: number[]; installation?: number } = {},
): Promise<Preparation> {
  const installation = options.installation ?? 2;
  const db = createTestDb();
  await migrate(db);
  const repos = createRepositories(db);
  let reel = new Date(2026, 10, installation, 8, 0);
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
  if ((options.depense ?? 0) > 0) {
    reel = new Date(2026, 10, installation, 12, 0);
    await store.getState().noterDepense({
      day: `2026-11-0${installation}`,
      amount: options.depense ?? 0,
      category: 'envies',
      note: '',
    });
  }
  for (let j = installation; j <= 8; j++) {
    if (options.sauf?.includes(j)) continue;
    reel = new Date(2026, 10, j, 21, 0);
    await store.getState().cloturerJour(`2026-11-0${j}`);
  }
  reel = new Date(2026, 10, 10, 9, 0);
  await store.getState().ouvrir();
  return { repos, store, redemarrer: () => createKakeiboStore(deps) };
}

async function monter(p: Preparation) {
  const onTerminer = jest.fn();
  const rendu = await render(<EcranBilanSemaine store={p.store} onTerminer={onTerminer} />);
  return { ...p, onTerminer, rendu };
}

const suivant = () => fireEvent.press(screen.getByRole('button', { name: b.suivantLibelle }));
const tirer = () => fireEvent.press(screen.getByRole('button', { name: b.tirerLibelle }));
/** Passe les temps 1 et 2. */
async function jusquAuResultat() {
  await suivant();
  await suivant();
}

let annonces: jest.SpyInstance;
beforeEach(() => {
  oublierEtapes();
  annonces = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

/** Le téléphone demande moins d'animations. */
function moinsAnimations() {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
}

describe('temps 1 et 2', () => {
  it('temps 1 : les tampons de la semaine, « 7 sur 7 »', async () => {
    await monter(await preparer({ depense: 12000 }));
    expect(screen.getByRole('header', { name: fr.bilan.titreSemaine })).toBeOnTheScreen();
    expect(screen.getByText(`Semaine du 2${N}novembre`)).toBeOnTheScreen();
    expect(screen.getByText(b.temps(1))).toBeOnTheScreen();
    expect(screen.getByText('7 sur 7')).toBeOnTheScreen();
    expect(screen.getByLabelText(`${b.tamponsTitre}${N}: 7 tampons sur 7`)).toBeOnTheScreen();
  });

  it('temps 1 : T sur N jours décomptés la semaine de l’installation (scénario 7)', async () => {
    await monter(await preparer({ installation: 5, depense: 7000 }));
    expect(screen.getByText('4 sur 4')).toBeOnTheScreen();
  });

  it('temps 2 : le dépensé face à l’enveloppe', async () => {
    await monter(await preparer({ depense: 12000 }));
    await suivant();
    expect(screen.getByText(b.temps(2))).toBeOnTheScreen();
    expect(screen.getByText(`Dépensé${N}: 120${N}€ sur 140${N}€`)).toBeOnTheScreen();
    expect(screen.getByText(fr.recapitulatif.dansEnveloppe)).toBeOnTheScreen();
    expect(screen.queryByText('7 sur 7')).toBeNull();
  });

  it('temps 2 : au-delà de l’enveloppe, sans alerte', async () => {
    await monter(await preparer({ depense: 15000 }));
    await suivant();
    expect(screen.getByText(`Dépensé${N}: 150${N}€ sur 140${N}€`)).toBeOnTheScreen();
    expect(screen.getByText(fr.recapitulatif.horsEnveloppe)).toBeOnTheScreen();
  });
});

describe('temps 3 : les quatre cas du tableau', () => {
  it('tous les tampons, dans le budget : la tirette, puis la capsule s’ouvre sur l’objet', async () => {
    moinsAnimations();
    await monter(await preparer({ depense: 12000 }));
    await jusquAuResultat();
    expect(screen.getByText(b.temps(3))).toBeOnTheScreen();
    expect(screen.getByText(fr.bilan.toutTamponsDansBudget)).toBeOnTheScreen();
    // Tant que la tirette n'est pas tirée, on ne passe pas au temps suivant.
    expect(screen.queryByRole('button', { name: b.suivantLibelle })).toBeNull();
    expect(screen.queryByText(fr.messages.ouvertureCapsule(rateau))).toBeNull();
    const bouton = screen.getByRole('button', { name: b.tirerLibelle });
    expect(screen.getByText(b.tirer)).toBeOnTheScreen();
    expect(StyleSheet.flatten(bouton.props.style).minHeight).toBeGreaterThanOrEqual(44);
    await tirer();
    expect(
      screen.getByText('Un râteau porte-bonheur kumade entre dans ta maison.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: b.tirerLibelle })).toBeNull();
    expect(screen.queryByText(/fêl/)).toBeNull();
  });

  it('tous les tampons, hors budget : la capsule, et l’échelle se fêle', async () => {
    moinsAnimations();
    await monter(await preparer({ depense: 15000 }));
    await jusquAuResultat();
    expect(
      screen.getByText(
        `Tu as tout noté, c’est l’essentiel${N}: tes jetons sont prêts, tire la tirette. L’échelle s’est fêlée${N}; 7 jours de clôture d’affilée, et elle sera réparée à l’or.`,
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(fr.messages.fele(echelle))).toBeOnTheScreen();
    await tirer();
    expect(screen.getByText(fr.messages.ouvertureCapsule(rateau))).toBeOnTheScreen();
  });

  it('tampons manquants, dans le budget : la poussière, ni tirette ni capsule', async () => {
    await monter(await preparer({ depense: 10000, sauf: [4] }));
    await suivant();
    await suivant();
    expect(screen.getByText(fr.bilan.manqueDansBudget)).toBeOnTheScreen();
    expect(screen.getByLabelText(b.poussiereLibelle)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: b.tirerLibelle })).toBeNull();
    expect(screen.queryByLabelText(b.machineLibelle)).toBeNull();
    expect(screen.getByRole('button', { name: b.suivantLibelle })).toBeOnTheScreen();
  });

  it('tampons manquants, hors budget : la poussière, et l’échelle se fêle', async () => {
    await monter(await preparer({ depense: 15000, sauf: [4] }));
    await jusquAuResultat();
    expect(
      screen.getByText(
        `Pas de capsule cette semaine, et l’échelle s’est fêlée. Rien n’est perdu${N}: 7 jours de clôture d’affilée, et elle sera réparée à l’or.`,
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(fr.messages.fele(echelle))).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: b.tirerLibelle })).toBeNull();
  });

  it('une semaine sans tampon ni dépense ne montre ni capsule ni fêlure', async () => {
    await monter(await preparer({ sauf: [2, 3, 4, 5, 6, 7, 8] }));
    expect(screen.getByText('0 sur 7')).toBeOnTheScreen();
    await jusquAuResultat();
    expect(screen.queryByRole('button', { name: b.tirerLibelle })).toBeNull();
    expect(screen.queryByLabelText(b.machineLibelle)).toBeNull();
    expect(screen.queryByText(/fêl/)).toBeNull();
    expect(screen.queryByLabelText(/fêl/)).toBeNull();
    await suivant();
    expect(screen.getByText(b.conclusionSansObjet)).toBeOnTheScreen();
  });
});

describe('la tirette et la capsule', () => {
  it('avec les animations, la capsule tombe puis s’ouvre sur l’objet', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    await monter(await preparer({ depense: 12000 }));
    await jusquAuResultat();
    await tirer();
    expect(screen.getByLabelText(b.machineLibelle)).toBeOnTheScreen();
    expect(
      await screen.findByText(fr.messages.ouvertureCapsule(rateau), {}, { timeout: 4000 }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: b.suivantLibelle })).toBeOnTheScreen();
  });

  it('moins d’animations : l’objet s’affiche tout de suite, sans attendre', async () => {
    moinsAnimations();
    await monter(await preparer({ depense: 12000 }));
    await jusquAuResultat();
    await tirer();
    expect(screen.getByText(fr.messages.ouvertureCapsule(rateau))).toBeOnTheScreen();
  });
});

describe('temps 4 et fin', () => {
  it('l’objet seul, avec son dessin provisoire, et une phrase de conclusion', async () => {
    moinsAnimations();
    await monter(await preparer({ depense: 12000 }));
    await jusquAuResultat();
    await tirer();
    await suivant();
    expect(screen.getByText(b.temps(4))).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: b.maisonTitre })).toBeOnTheScreen();
    expect(screen.getByLabelText(b.objetLibelle(rateau))).toBeOnTheScreen();
    expect(screen.getByText('Le râteau porte-bonheur kumade')).toBeOnTheScreen();
    expect(screen.getByText(b.conclusionObjet)).toBeOnTheScreen();
  });

  it('« Terminer » envoie week_reviews_seen et revient à l’accueil, même après redémarrage', async () => {
    moinsAnimations();
    const p = await monter(await preparer({ depense: 12000 }));
    await jusquAuResultat();
    await tirer();
    await suivant();
    const terminer = screen.getByRole('button', { name: b.terminerLibelle });
    expect(StyleSheet.flatten(terminer.props.style).minHeight).toBeGreaterThanOrEqual(44);
    await fireEvent.press(terminer);
    expect(p.onTerminer).toHaveBeenCalledTimes(1);
    expect(p.store.getState().etat?.unseenWeeks).toEqual([]);
    expect((await p.repos.weekResults.all()).map((w) => [w.week, w.ceremony_seen])).toEqual([
      ['2026-W45', 1],
    ]);
    const apres = p.redemarrer();
    await apres.getState().ouvrir();
    expect(weekReviewScreen(apres.getState().etat!)).toBeNull();
  });

  it('un échec de l’enregistrement s’explique et laisse le bilan ouvert', async () => {
    const p = await monter(await preparer({ depense: 10000, sauf: [4] }));
    await jusquAuResultat();
    await suivant();
    jest.spyOn(p.store.getState(), 'marquerBilansVus').mockRejectedValueOnce(new Error('base'));
    await fireEvent.press(screen.getByRole('button', { name: b.terminerLibelle }));
    expect(screen.getByText(b.refus)).toBeOnTheScreen();
    expect(p.onTerminer).not.toHaveBeenCalled();
  });

  it('« Retour » ramène à l’accueil sans rien marquer vu', async () => {
    const p = await monter(await preparer({ depense: 12000 }));
    await fireEvent.press(screen.getByRole('button', { name: fr.bilan.retourLibelle }));
    expect(p.onTerminer).toHaveBeenCalledTimes(1);
    expect(p.store.getState().etat?.unseenWeeks).toEqual(['2026-W45']);
  });
});

describe('objet en attente de sa pièce (scénario 18)', () => {
  it('dit « Ton objet attend la pièce de … » à l’ouverture de la capsule', async () => {
    moinsAnimations();
    // Installation le lundi 23 novembre ; semaine 48 vue ; semaine 49 complète, à décembre
    // (jeudi 3), dont la pièce attend le bilan de novembre.
    const db = createTestDb();
    await migrate(db);
    const repos = createRepositories(db);
    let reel = new Date(2026, 10, 23, 8, 0);
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
    for (let i = 0; i < 14; i++) {
      const jour = new Date(2026, 10, 23 + i, 21, 0);
      reel = jour;
      const cle = `${jour.getFullYear()}-${String(jour.getMonth() + 1).padStart(2, '0')}-${String(jour.getDate()).padStart(2, '0')}`;
      await store.getState().cloturerJour(cle);
      if (i === 6) await store.getState().marquerBilansVus();
    }
    reel = new Date(2026, 11, 7, 9, 0);
    await store.getState().ouvrir();
    await monter({ repos, store, redemarrer: () => createKakeiboStore(deps) });
    expect(screen.getByText(`Semaine du 30${N}novembre`)).toBeOnTheScreen();
    await jusquAuResultat();
    await tirer();
    expect(
      screen.getByText(
        `Ton objet attend la pièce de décembre${N}: elle s’ouvrira avec le bilan de novembre.`,
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/entrent? dans ta maison/)).toBeNull();
    await suivant();
    expect(screen.getByText('Le mortier et maillet à mochi')).toBeOnTheScreen();
  });
});

describe('lecteur d’écran et reprise', () => {
  it('chaque temps est lu par le lecteur d’écran', async () => {
    moinsAnimations();
    await monter(await preparer({ depense: 12000 }));
    expect(annonces).toHaveBeenLastCalledWith(
      `${b.temps(1)}. ${b.tamponsTitre}${N}: 7 tampons sur 7.`,
    );
    await suivant();
    expect(annonces).toHaveBeenLastCalledWith(
      `${b.temps(2)}. ${b.enveloppeTitre}${N}: Dépensé${N}: 120${N}€ sur 140${N}€. ${fr.recapitulatif.dansEnveloppe}.`,
    );
    await suivant();
    expect(annonces).toHaveBeenLastCalledWith(
      `${b.temps(3)}. ${b.resultatTitre}${N}: ${fr.bilan.toutTamponsDansBudget}`,
    );
    await tirer();
    expect(annonces).toHaveBeenLastCalledWith(fr.messages.ouvertureCapsule(rateau));
    await suivant();
    expect(annonces).toHaveBeenLastCalledWith(
      `${b.temps(4)}. ${b.maisonTitre}${N}: Le râteau porte-bonheur kumade. ${b.conclusionObjet}`,
    );
  });

  it('quitté avant la tirette, le bilan se rouvre au même endroit', async () => {
    const p = await monter(await preparer({ depense: 12000 }));
    await jusquAuResultat();
    expect(screen.getByRole('button', { name: b.tirerLibelle })).toBeOnTheScreen();
    await act(async () => p.rendu.unmount());
    await monter(p);
    expect(screen.getByText(b.temps(3))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: b.tirerLibelle })).toBeOnTheScreen();
  });

  it('se rouvre aussi après la tirette, la capsule ouverte', async () => {
    moinsAnimations();
    const p = await monter(await preparer({ depense: 12000 }));
    await jusquAuResultat();
    await tirer();
    await act(async () => p.rendu.unmount());
    await monter(p);
    expect(screen.getByText(fr.messages.ouvertureCapsule(rateau))).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: b.tirerLibelle })).toBeNull();
  });
});
