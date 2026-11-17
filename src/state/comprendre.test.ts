// Comprendre (E12, J5.7, #106) : les fiches, la fiche de chaque carte de première fois, les fêtes
// de chaque mois et les objets obtenus, avec le vrai store sur une base de test.
import catalogueJson from '../content/catalogue.json';
import { type ContentCatalog, catalogue } from '../content/catalogue';
import { migrate } from '../data/migrations';
import { createRepositories } from '../data/repositories';
import { createTestDb } from '../data/testDb';
import type { Catalog } from '../domain/objets';
import { fr } from '../i18n/fr';
import { createClock } from './clock';
import {
  FICHES_COMPRENDRE,
  FICHE_DE_CARTE,
  lireFicheComprendre,
  paragraphesDeFiche,
  vueFetes,
  vueObjetsObtenus,
} from './comprendre';
import { TOUTES_LES_EXPLICATIONS } from './explications';
import { createKakeiboStore } from './store';

const e = fr.explications;

describe('les fiches de Comprendre', () => {
  it('rassemblent ce que la spec demande, dans cet ordre', () => {
    expect(FICHES_COMPRENDRE).toEqual([
      'methode',
      'categories',
      'questions',
      'maison',
      'kintsugi',
      'gashapon',
      'fetes',
      'objets',
    ]);
    for (const fiche of FICHES_COMPRENDRE) {
      expect(fr.comprendre.fiches[fiche].length).toBeGreaterThan(0);
    }
  });

  it('reprennent chaque texte d’explication de la spec, une seule fois', () => {
    const tous = FICHES_COMPRENDRE.flatMap((f) => paragraphesDeFiche(f));
    for (const texte of Object.values(e)) {
      expect(tous.filter((t) => t === texte)).toHaveLength(1);
    }
    expect(tous).toHaveLength(Object.keys(e).length);
  });

  it('mettent chaque texte dans la fiche de son sujet', () => {
    expect(paragraphesDeFiche('methode')).toEqual([
      e.bienvenueMethode,
      e.premiereDepense,
      e.bienvenueMois,
    ]);
    expect(paragraphesDeFiche('categories')).toEqual([e.bienvenueCategories]);
    expect(paragraphesDeFiche('questions')).toEqual([e.premierBilanDuMois]);
    expect(paragraphesDeFiche('maison')).toEqual([
      e.premierTampon,
      e.premierJourARattraper,
      e.premierePoussiere,
      e.nouvelleAnnee,
    ]);
    expect(paragraphesDeFiche('kintsugi')).toEqual([e.premiereFelure, e.premiereReparation]);
    expect(paragraphesDeFiche('gashapon')).toEqual([e.premiereCapsule]);
    expect(paragraphesDeFiche('fetes')).toEqual([e.nouvellePiece]);
    expect(paragraphesDeFiche('objets')).toEqual([]);
  });

  it('« En savoir plus » de chaque carte ouvre la fiche qui reprend son texte', () => {
    // Les 13 cartes de la spec, dont les quatre de J5.8 (#107).
    const cartes = [...TOUTES_LES_EXPLICATIONS];
    expect(Object.keys(FICHE_DE_CARTE).sort()).toEqual([...cartes].sort());
    const texteDeCarte = {
      welcome_method: e.bienvenueMethode,
      welcome_categories: e.bienvenueCategories,
      welcome_month: e.bienvenueMois,
      first_expense: e.premiereDepense,
      first_stamp: e.premierTampon,
      first_catch_up: e.premierJourARattraper,
      first_capsule: e.premiereCapsule,
      first_dust: e.premierePoussiere,
      first_crack: e.premiereFelure,
      first_repair: e.premiereReparation,
      first_month_review: e.premierBilanDuMois,
      new_room: e.nouvellePiece,
      new_year: e.nouvelleAnnee,
    } as const;
    for (const carte of cartes) {
      expect(paragraphesDeFiche(FICHE_DE_CARTE[carte])).toContain(texteDeCarte[carte]);
    }
  });

  it('se lisent depuis le lien : une fiche inconnue ouvre la liste', () => {
    expect(lireFicheComprendre('kintsugi')).toBe('kintsugi');
    expect(lireFicheComprendre('fetes')).toBe('fetes');
    expect(lireFicheComprendre('inconnue')).toBeNull();
    expect(lireFicheComprendre(undefined)).toBeNull();
    expect(lireFicheComprendre(['kintsugi'])).toBeNull();
  });
});

describe('les fêtes de chaque mois', () => {
  it('montrent les douze pièces du catalogue, de janvier à décembre', () => {
    const fetes = vueFetes(catalogue);
    expect(fetes).toHaveLength(12);
    expect(fetes.map((f) => f.mois)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(fetes[0]).toEqual({
      mois: 1,
      piece: 'Genkan, l’entrée',
      fete: 'Shōgatsu, le Nouvel An',
      explication: catalogue.rooms[0].explanation,
    });
    expect(fetes[10].piece).toBe('Kura, la réserve');
    expect(fetes[10].fete).toBe('Tori no ichi et Shichi-go-san');
  });

  it('suivent l’ordre des mois même si le catalogue est dans un autre ordre', () => {
    const melange: ContentCatalog = {
      ...catalogue,
      rooms: [...catalogue.rooms].reverse(),
    };
    expect(vueFetes(melange).map((f) => f.mois)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe('les objets obtenus', () => {
  /** Installation le mercredi 4 novembre 2026, budget de novembre, puis une semaine complète. */
  async function preparer() {
    const db = createTestDb();
    await migrate(db);
    const repos = createRepositories(db);
    let reel = new Date(2026, 10, 4, 9, 0);
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
      income: 120000,
      fixed_costs: 60000,
      savings_goal: 0,
      effective_from: '2026-11-02',
    });
    const store = createKakeiboStore(deps);
    await store.getState().ouvrir();
    const avancer = async (d: Date) => {
      reel = d;
      await store.getState().ouvrir();
    };
    const cloturer = async (d: Date, jour: string) => {
      reel = d;
      await store.getState().cloturerJour(jour);
    };
    return { store, avancer, cloturer, maintenant: () => store.getState().maintenant };
  }

  it('à l’installation : les 3 objets de base de la pièce du mois, dans l’ordre du catalogue', async () => {
    const p = await preparer();
    const { etat, maintenant } = p.store.getState();
    if (etat === null || maintenant === null) throw new Error('store non ouvert');
    const vue = vueObjetsObtenus(etat, catalogue, maintenant);
    expect(vue).toHaveLength(1);
    expect(vue[0].mois).toBe(11);
    expect(vue[0].piece).toBe('Kura, la réserve');
    expect(vue[0].objets.map((o) => o.nom.nom)).toEqual([
      'étagères',
      'coffre nagamochi',
      'échelle',
    ]);
  });

  it('un objet gagné rejoint la liste après les objets de base', async () => {
    const p = await preparer();
    for (let j = 4; j <= 8; j++) {
      const jour = `2026-11-0${j}`;
      await p.cloturer(new Date(2026, 10, j, 21, 0), jour);
    }
    await p.avancer(new Date(2026, 10, 9, 9, 0));
    const { etat, maintenant } = p.store.getState();
    if (etat === null || maintenant === null) throw new Error('store non ouvert');
    const vue = vueObjetsObtenus(etat, catalogue, maintenant);
    expect(vue[0].objets.map((o) => o.itemId)).toHaveLength(4);
    expect(vue[0].objets[3].nom.nom).toBe('râteau porte-bonheur kumade');
    expect(vue[0].objets[3].etat).toBe('intact');
  });

  it('un objet qui attend sa pièce n’y figure pas encore ; les années passées non plus', async () => {
    const p = await preparer();
    const { etat, maintenant } = p.store.getState();
    if (etat === null || maintenant === null) throw new Error('store non ouvert');
    const objetDecembre =
      catalogue.items.find((i) => i.room === 'room-12' && i.source === 'weekly')?.id ?? '';
    const enAttente = {
      ...etat,
      house: {
        ...etat.house,
        owned: [
          ...etat.house.owned,
          {
            year: 2026,
            room: 'room-12',
            itemId: objetDecembre,
            source: 'weekly' as const,
            week: '2026-W49',
            acquiredAt: '2026-12-07T09:00:00+01:00',
            placedAt: null,
            state: 'intact' as const,
          },
          { ...etat.house.owned[0], year: 2025 },
        ],
      },
    };
    const vue = vueObjetsObtenus(enAttente, catalogue, maintenant);
    expect(vue).toHaveLength(1);
    expect(vue[0].objets).toHaveLength(3);
  });
});
