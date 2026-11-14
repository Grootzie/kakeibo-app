// Réparation annoncée et cartes de première fois de J3 (#66), avec le vrai store sur une base de
// test : « Réparée à l'or, … » à la clôture qui complète la réparation (emplacement A), puis les
// cartes « Première réparation », « Première capsule », « Première poussière », « Première
// fêlure », « Premier bilan du mois » et « Nouvelle pièce », chacune une seule fois, même après
// redémarrage.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import catalogueJson from '../../content/catalogue.json';
import { migrate } from '../../data/migrations';
import { type Repositories, createRepositories } from '../../data/repositories';
import { createTestDb } from '../../data/testDb';
import type { Catalog } from '../../domain/objets';
import { fr } from '../../i18n/fr';
import { createClock } from '../../state/clock';
import { type DependancesStore, type KakeiboStore, createKakeiboStore } from '../../state/store';
import { EcranBilanMois } from '../bilan/EcranBilanMois';
import { EcranBilanSemaine } from '../bilan/EcranBilanSemaine';
import { oublierEtapes } from '../bilan/etapesBilan';
import { DUREE_TAMPON_MS, EcranCloture } from '../cloture/EcranCloture';

const t = fr.carteExplication.titres;
const x = fr.explications;
const b = fr.bilanSemaine;
const echelle = { nom: 'échelle', article: "l'", genre: 'f' } as const;
const REPAREE = fr.messages.reparation(echelle);

const catalogue = catalogueJson as Catalog;
/** Catalogue où la pièce de décembre a son explication (le vrai ne l'a pas encore). */
const EXPLICATION_DOMA = 'Explication de la pièce de décembre, pour le test.';
const catalogueExplique: Catalog = {
  ...catalogue,
  rooms: catalogue.rooms.map((r) => (r.month === 12 ? { ...r, explanation: EXPLICATION_DOMA } : r)),
};

interface Banc {
  repos: Repositories;
  store: KakeiboStore;
  /** Change l'heure du téléphone. */
  aller(d: Date): void;
  /** Redémarrage de l'appli : un nouveau store sur la même base, ouvert à l'heure actuelle. */
  redemarrer(): Promise<KakeiboStore>;
}

const nov = (j: number, h = 21, m = 0) => new Date(2026, 10, j, h, m);
const jour = (j: number) => `2026-11-${String(j).padStart(2, '0')}`;

/** Installation le lundi 2 novembre 2026 à 8 h, budget de 600 € en novembre (140 € la semaine). */
async function installer(cat: Catalog = catalogue): Promise<Banc> {
  const db = createTestDb();
  await migrate(db);
  const repos = createRepositories(db);
  let reel = nov(2, 8);
  let n = 0;
  const deps: DependancesStore = {
    depots: async () => repos,
    catalogue: cat,
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
  await store.getState().ouvrir();
  const redemarrer = async () => {
    const autre = createKakeiboStore(deps);
    await autre.getState().ouvrir();
    return autre;
  };
  return { repos, store, aller: (d) => (reel = d), redemarrer };
}

/** Dépense notée à midi ce jour-là. */
async function depenser(banc: Banc, j: number, amount: number) {
  banc.aller(nov(j, 12));
  await banc.store.getState().noterDepense({ day: jour(j), amount, category: 'envies', note: '' });
}

/** Chaque jour clôturé le soir même. */
async function cloturer(banc: Banc, jours: number[]) {
  for (const j of jours) {
    banc.aller(nov(j));
    expect(await banc.store.getState().cloturerJour(jour(j))).toBeNull();
  }
}

const du = (a: number, z: number) => Array.from({ length: z - a + 1 }, (_, i) => a + i);

/**
 * Scénario 10 : semaine 45 complète à 150 €, l'échelle se fêle ; bilan vu le lundi 9 ;
 * puis clôtures du lundi 9 au samedi 14. La clôture du dimanche 15 répare l'échelle.
 */
async function echelleFeleeJusquAuSamedi(banc: Banc, jours = du(9, 14)) {
  await depenser(banc, 2, 15000);
  await cloturer(banc, du(2, 8));
  banc.aller(nov(9, 8));
  await banc.store.getState().ouvrir();
  await banc.store.getState().marquerBilansVus();
  await cloturer(banc, jours);
}

const fermerCarte = (titre: string) =>
  fireEvent.press(screen.getByRole('button', { name: fr.carteExplication.fermerLibelle(titre) }));

async function vues(repos: Repositories): Promise<string[]> {
  return JSON.parse((await repos.settings.get())?.seen_explanations ?? '[]') as string[];
}

let annonces: jest.SpyInstance;
beforeEach(() => {
  oublierEtapes();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  annonces = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('réparation annoncée à la clôture (E4, E5)', () => {
  async function clotureDuDimanche(banc: Banc, jourOuvert?: string) {
    const onTerminer = jest.fn();
    await banc.store.getState().ouvrir();
    jest.useFakeTimers();
    await render(<EcranCloture store={banc.store} jour={jourOuvert} onTerminer={onTerminer} />);
    await fireEvent.press(screen.getByRole('button', { name: fr.cloture.rienDepense }));
    return onTerminer;
  }

  it('après le tampon, « Réparée à l’or, l’échelle … », la carte, puis « Continuer »', async () => {
    const banc = await installer();
    await echelleFeleeJusquAuSamedi(banc);
    banc.aller(nov(15));
    const onTerminer = await clotureDuDimanche(banc);

    // Pendant le tampon, rien n'est encore annoncé.
    expect(screen.queryByText(REPAREE)).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(DUREE_TAMPON_MS);
    });
    expect(onTerminer).not.toHaveBeenCalled();
    expect(screen.getByRole('header', { name: REPAREE })).toBeOnTheScreen();
    expect(screen.getByRole('image', { name: fr.messages.repare(echelle) })).toBeOnTheScreen();
    expect(screen.getByTestId('veine-or')).toBeOnTheScreen();
    expect(annonces).toHaveBeenCalledWith(REPAREE);

    // La première fois, la carte « Première réparation ».
    expect(screen.getByRole('header', { name: t.first_repair })).toBeOnTheScreen();
    expect(screen.getByText(x.premiereReparation)).toBeOnTheScreen();
    expect(await vues(banc.repos)).toContain('first_repair');
    await fermerCarte(t.first_repair);
    expect(screen.queryByText(x.premiereReparation)).toBeNull();
    expect(screen.getByText(REPAREE)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: fr.cloture.continuerLibelle }));
    expect(onTerminer).toHaveBeenCalledTimes(1);
  });

  it('une clôture de rattrapage qui complète la série annonce aussi la réparation (E5)', async () => {
    const banc = await installer();
    // Mercredi 11 oublié, rattrapé le lundi 16 à 9 h : la série du 9 au 15 se complète.
    await echelleFeleeJusquAuSamedi(banc, [9, 10, 12, 13, 14, 15]);
    banc.aller(nov(16, 9));
    const onTerminer = jest.fn();
    jest.useFakeTimers();
    await render(<EcranCloture store={banc.store} jour={jour(11)} onTerminer={onTerminer} />);
    await fireEvent.press(await screen.findByRole('button', { name: fr.cloture.rienDepense }));
    await act(async () => {
      jest.advanceTimersByTime(DUREE_TAMPON_MS);
    });
    expect(screen.getByRole('header', { name: REPAREE })).toBeOnTheScreen();
    expect(onTerminer).not.toHaveBeenCalled();
  });

  it('une clôture qui ne répare rien revient à l’accueil, sans annonce', async () => {
    const banc = await installer();
    await echelleFeleeJusquAuSamedi(banc, du(9, 13));
    banc.aller(nov(14));
    const onTerminer = await clotureDuDimanche(banc);
    await act(async () => {
      jest.advanceTimersByTime(DUREE_TAMPON_MS);
    });
    expect(onTerminer).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(REPAREE)).toBeNull();
    expect(await vues(banc.repos)).not.toContain('first_repair');
  });

  it('carte déjà vue avant un redémarrage : l’annonce seule, sans la carte', async () => {
    const banc = await installer();
    await echelleFeleeJusquAuSamedi(banc);
    await banc.store.getState().marquerExplicationVue('first_repair');
    banc.aller(nov(15));
    banc.store = await banc.redemarrer();
    await clotureDuDimanche(banc);
    await act(async () => {
      jest.advanceTimersByTime(DUREE_TAMPON_MS);
    });
    expect(screen.getByRole('header', { name: REPAREE })).toBeOnTheScreen();
    expect(screen.queryByText(x.premiereReparation)).toBeNull();
  });
});

describe('bilan de la semaine (E6), au temps 3', () => {
  async function bilan(banc: Banc) {
    banc.aller(nov(10, 9));
    await banc.store.getState().ouvrir();
    await render(<EcranBilanSemaine store={banc.store} onTerminer={jest.fn()} />);
  }
  const suivant = () => fireEvent.press(screen.getByRole('button', { name: b.suivantLibelle }));
  const titres = [t.first_capsule, t.first_dust, t.first_crack];
  const aucuneCarte = () => {
    for (const titre of titres) expect(screen.queryByRole('header', { name: titre })).toBeNull();
  };

  it('« Première capsule » au temps 3 d’une semaine complète, avant la tirette', async () => {
    const banc = await installer();
    await depenser(banc, 2, 12000);
    await cloturer(banc, du(2, 8));
    await bilan(banc);
    aucuneCarte();
    await suivant();
    aucuneCarte();
    await suivant();
    expect(screen.getByRole('header', { name: t.first_capsule })).toBeOnTheScreen();
    expect(screen.getByText(x.premiereCapsule)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: b.tirerLibelle })).toBeOnTheScreen();
    expect(await vues(banc.repos)).toEqual(['first_capsule']);
    await fermerCarte(t.first_capsule);
    aucuneCarte();
  });

  it('tous les tampons hors budget : la capsule, puis la fêlure à la fermeture', async () => {
    const banc = await installer();
    await depenser(banc, 2, 15000);
    await cloturer(banc, du(2, 8));
    await bilan(banc);
    await suivant();
    await suivant();
    expect(screen.getByRole('header', { name: t.first_capsule })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: t.first_crack })).toBeNull();
    await fermerCarte(t.first_capsule);
    expect(screen.getByRole('header', { name: t.first_crack })).toBeOnTheScreen();
    expect(screen.getByText(x.premiereFelure)).toBeOnTheScreen();
    expect(await vues(banc.repos)).toEqual(['first_capsule', 'first_crack']);
  });

  it('tampons manquants dans le budget : « Première poussière », ni capsule ni fêlure', async () => {
    const banc = await installer();
    await cloturer(banc, [2, 3, 5, 6, 7, 8]);
    await bilan(banc);
    await suivant();
    await suivant();
    expect(screen.getByRole('header', { name: t.first_dust })).toBeOnTheScreen();
    expect(screen.getByText(x.premierePoussiere)).toBeOnTheScreen();
    await fermerCarte(t.first_dust);
    aucuneCarte();
    expect(await vues(banc.repos)).toEqual(['first_dust']);
  });

  it('tampons manquants hors budget : la poussière, puis la fêlure', async () => {
    const banc = await installer();
    await depenser(banc, 2, 15000);
    await cloturer(banc, [2, 3, 5, 6, 7, 8]);
    await bilan(banc);
    await suivant();
    await suivant();
    expect(screen.getByRole('header', { name: t.first_dust })).toBeOnTheScreen();
    await fermerCarte(t.first_dust);
    expect(screen.getByRole('header', { name: t.first_crack })).toBeOnTheScreen();
  });

  it('une carte vue ne revient jamais, même après redémarrage', async () => {
    const banc = await installer();
    await depenser(banc, 2, 15000);
    await cloturer(banc, du(2, 8));
    await banc.store.getState().marquerExplicationVue('first_capsule');
    await banc.store.getState().marquerExplicationVue('first_crack');
    banc.aller(nov(10, 9));
    banc.store = await banc.redemarrer();
    await render(<EcranBilanSemaine store={banc.store} onTerminer={jest.fn()} />);
    await suivant();
    await suivant();
    expect(screen.getByRole('button', { name: b.tirerLibelle })).toBeOnTheScreen();
    aucuneCarte();
  });
});

describe('récapitulatif après une longue absence (E6)', () => {
  it('« Première poussière » quand une semaine manque de tampons', async () => {
    const banc = await installer();
    await cloturer(banc, [2]);
    banc.aller(nov(24, 9));
    await banc.store.getState().ouvrir();
    await render(<EcranBilanSemaine store={banc.store} onTerminer={jest.fn()} />);
    expect(screen.getByRole('header', { name: fr.recapitulatif.titre })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: t.first_dust })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: t.first_capsule })).toBeNull();
    expect(await vues(banc.repos)).toEqual(['first_dust']);
  });
});

describe('bilan du mois (E7)', () => {
  async function bilanDuMois(banc: Banc) {
    banc.aller(new Date(2026, 11, 1, 9, 0));
    await banc.store.getState().ouvrir();
    await render(<EcranBilanMois store={banc.store} onTerminer={jest.fn()} />);
  }
  async function valider() {
    await fireEvent.press(screen.getByRole('button', { name: fr.bilanMois.valider }));
    await fireEvent.press(
      await screen.findByRole('button', { name: fr.bilanMois.confirmerBudget }),
    );
  }

  it('« Premier bilan du mois » à l’ouverture de E7, avec les quatre questions', async () => {
    const banc = await installer();
    await bilanDuMois(banc);
    expect(screen.getByRole('header', { name: t.first_month_review })).toBeOnTheScreen();
    expect(screen.getByText(x.premierBilanDuMois)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: fr.bilanMois.valider })).toBeOnTheScreen();
    expect(await vues(banc.repos)).toEqual(['first_month_review']);
  });

  it('« Nouvelle pièce » après la validation, suivie de l’explication de la pièce', async () => {
    const banc = await installer(catalogueExplique);
    await banc.store.getState().marquerExplicationVue('first_month_review');
    await bilanDuMois(banc);
    expect(screen.queryByRole('header', { name: t.new_room })).toBeNull();
    await valider();
    expect(
      screen.getByText(fr.messages.nouvellePiece('2026-12', 'Ōmisoka, le réveillon')),
    ).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: t.new_room })).toBeOnTheScreen();
    expect(screen.getByText(`${x.nouvellePiece} ${EXPLICATION_DOMA}`)).toBeOnTheScreen();
    expect(annonces).toHaveBeenCalledWith(`${t.new_room}. ${x.nouvellePiece} ${EXPLICATION_DOMA}`);
    expect(await vues(banc.repos)).toEqual(['first_month_review', 'new_room']);
  });

  it('sans explication de la pièce au catalogue, le texte de la spec seul', async () => {
    const banc = await installer();
    await bilanDuMois(banc);
    await fermerCarte(t.first_month_review);
    await valider();
    expect(screen.getByText(x.nouvellePiece)).toBeOnTheScreen();
  });

  it('une fois vues, plus aucune des deux cartes, même après redémarrage', async () => {
    const banc = await installer();
    await banc.store.getState().marquerExplicationVue('first_month_review');
    await banc.store.getState().marquerExplicationVue('new_room');
    banc.aller(new Date(2026, 11, 1, 9, 0));
    banc.store = await banc.redemarrer();
    await render(<EcranBilanMois store={banc.store} onTerminer={jest.fn()} />);
    expect(screen.queryByRole('header', { name: t.first_month_review })).toBeNull();
    await valider();
    expect(screen.queryByRole('header', { name: t.new_room })).toBeNull();
  });
});
