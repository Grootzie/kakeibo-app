// Les 13 cartes de première fois (J5.8, #107), avec le vrai store, une base de test et l'horloge
// de test : chacune s'affiche à son moment, une seule fois, et ne revient jamais, ni dans la même
// session ni après redémarrage de l'appli (settings.seen_explanations).
import catalogueJson from '../content/catalogue.json';
import { migrate } from '../data/migrations';
import { type Repositories, createRepositories } from '../data/repositories';
import { createTestDb } from '../data/testDb';
import type { Catalog } from '../domain/objets';
import { type Horloge, createClock } from './clock';
import {
  EXPLICATIONS_ACCUEIL,
  EXPLICATIONS_BIENVENUE,
  EXPLICATIONS_J3,
  type IdExplication,
  type MomentsEcran,
  TOUTES_LES_EXPLICATIONS,
  explicationAAfficher,
  lireExplicationsVues,
} from './explications';
import { type DependancesStore, type KakeiboStore, createKakeiboStore } from './store';

interface Banc {
  repos: Repositories;
  horloge: Horloge;
  store: KakeiboStore;
  /** Redémarrage de l'appli : un nouveau store sur la même base, avec la même horloge. */
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

/** Où chaque carte s'affiche : les cartes que l'écran propose, et le moment qu'il constate. */
interface Ecran {
  proposees: readonly IdExplication[];
  moments: MomentsEcran;
}

/**
 * Fait venir le moment de la carte : par l'état (dépense, clôture, jour à rattraper, nouvelle
 * année, avec l'horloge de test) ou par l'écran (étape de E1, bilan, clôture qui répare).
 */
async function faireVenir(id: IdExplication, banc: Banc): Promise<Ecran> {
  const s = banc.store.getState();
  if ((EXPLICATIONS_BIENVENUE as readonly string[]).includes(id)) {
    return { proposees: EXPLICATIONS_BIENVENUE, moments: { [id]: true } };
  }
  if ((EXPLICATIONS_J3 as readonly string[]).includes(id)) {
    return { proposees: EXPLICATIONS_J3, moments: { [id]: true } };
  }
  const accueil = { proposees: [id], moments: {} };
  switch (id) {
    case 'first_expense':
      await s.noterDepense({ day: '2026-11-02', amount: 500, category: 'envies', note: '' });
      return accueil;
    case 'first_stamp':
      expect(await s.cloturerJour('2026-11-02')).toBeNull();
      return accueil;
    case 'first_catch_up':
      banc.horloge.avancerJours(1);
      await s.ouvrir();
      return accueil;
    case 'new_year':
      // Du lundi 2 novembre 2026 au lundi 4 janvier 2027, premier jour de la semaine 1.
      banc.horloge.avancerSemaines(9);
      await s.ouvrir();
      expect(banc.store.getState().maintenant?.day).toBe('2027-01-04');
      // À l'accueil, elle passe avant les cartes de J2 qui attendent aussi (jour à rattraper).
      expect(aAfficher(banc.store, { proposees: EXPLICATIONS_ACCUEIL, moments: {} })).toBe(id);
      return accueil;
    default:
      throw new Error(`carte sans moment : ${id}`);
  }
}

function aAfficher(store: KakeiboStore, ecran: Ecran): IdExplication | null {
  const { etat, maintenant, explicationsVues } = store.getState();
  if (etat === null || maintenant === null) throw new Error('store non chargé');
  return explicationAAfficher(etat, maintenant, explicationsVues, ecran.proposees, ecran.moments);
}

describe('les 13 cartes de première fois, une seule fois chacune', () => {
  test.each([...TOUTES_LES_EXPLICATIONS])('« %s »', async (id) => {
    const banc = await installer();
    const ecran = await faireVenir(id, banc);

    // Son moment est venu : la carte s'affiche, et l'écran la marque vue (useCarteExplication).
    expect(aAfficher(banc.store, ecran)).toBe(id);
    await banc.store.getState().marquerExplicationVue(id);

    // Même session : elle ne revient pas, alors que son moment est toujours là.
    expect(aAfficher(banc.store, ecran)).toBeNull();
    const { etat, maintenant } = banc.store.getState();
    expect(explicationAAfficher(etat!, maintenant!, [], ecran.proposees, ecran.moments)).toBe(id);

    // Après redémarrage, puis un deuxième : toujours pas.
    const apres = await banc.redemarrer();
    expect(apres.getState().explicationsVues).toContain(id);
    expect(aAfficher(apres, ecran)).toBeNull();
    banc.horloge.avancerJours(1);
    const encore = await banc.redemarrer();
    expect(aAfficher(encore, ecran)).toBeNull();

    // Gardée une seule fois dans settings.seen_explanations.
    const vues = lireExplicationsVues((await banc.repos.settings.get())?.seen_explanations ?? '');
    expect(vues.filter((v) => v === id)).toHaveLength(1);
  });

  test('toutes vues : plus aucune carte nulle part, même après redémarrage', async () => {
    const banc = await installer();
    for (const id of TOUTES_LES_EXPLICATIONS) {
      await banc.store.getState().marquerExplicationVue(id);
    }
    banc.horloge.avancerSemaines(9);
    const apres = await banc.redemarrer();
    const tousLesMoments = Object.fromEntries(TOUTES_LES_EXPLICATIONS.map((id) => [id, true]));
    expect(aAfficher(apres, { proposees: TOUTES_LES_EXPLICATIONS, moments: tousLesMoments })).toBe(
      null,
    );
    expect(apres.getState().explicationsVues).toEqual([...TOUTES_LES_EXPLICATIONS]);
  });
});
