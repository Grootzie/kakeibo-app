// Objets, pièces, objet en attente et nouvelle année (J1.4).
// Contexte commun : installation le lundi 2 novembre 2026, budget de 600 € par mois.
import catalogueJson from '../content/catalogue.json';
import {
  type Catalog,
  type HouseState,
  albumYears,
  awardWeeklyItem,
  houseYear,
  installHouse,
  nextItem,
  openNewYear,
  roomOfMonth,
  validateMonthReview,
} from './objets';

const catalog: Catalog = catalogueJson as Catalog;
const INSTALL = '2026-11-02';
const NOVEMBRE = roomOfMonth('2026-11');
const DECEMBRE = roomOfMonth('2026-12');
const JANVIER = roomOfMonth('2026-01');

const ids = (state: HouseState, room: string, year: number) =>
  state.owned.filter((o) => o.year === year && o.room === room).map((o) => o.itemId);

describe('catalogue', () => {
  it('compte 12 pièces, 36 objets de base et 59 objets à gagner', () => {
    expect(catalog.rooms).toHaveLength(12);
    expect(catalog.items.filter((i) => i.source === 'base')).toHaveLength(36);
    expect(catalog.items.filter((i) => i.source === 'weekly')).toHaveLength(59);
  });

  it('donne 3 objets de base à chaque pièce et 5 à gagner, sauf 4 en février', () => {
    for (const room of catalog.rooms) {
      const base = catalog.items.filter((i) => i.room === room.id && i.source === 'base');
      const weekly = catalog.items.filter((i) => i.room === room.id && i.source === 'weekly');
      expect(base.map((i) => i.rank)).toEqual([1, 2, 3]);
      expect(weekly.map((i) => i.rank)).toEqual(room.month === 2 ? [1, 2, 3, 4] : [1, 2, 3, 4, 5]);
    }
  });

  it('suit les objets du tableau de la spec', () => {
    const nom = (id: string) => catalog.items.find((i) => i.id === id)?.name;
    expect(nom('kadomatsu')).toBe('kadomatsu');
    expect(nom('daruma')).toBe('daruma');
    expect(catalog.items.filter((i) => i.room === JANVIER && i.source === 'weekly')[3].id).toBe(
      'daruma',
    );
  });
});

describe('maison de l’année', () => {
  it('appartient à l’année ISO : la semaine 53 de 2026 finit le 3 janvier 2027', () => {
    expect(houseYear('2027-01-03')).toBe(2026);
    expect(houseYear('2027-01-04')).toBe(2027);
    expect(houseYear('2025-12-29')).toBe(2026);
  });
});

describe('à l’installation', () => {
  it('ouvre la pièce du mois de la semaine en cours avec ses 3 objets de base, placés', () => {
    const state = installHouse(catalog, INSTALL, '2026-11-02T09:00');
    expect(state.unlocked).toEqual([
      { year: 2026, room: NOVEMBRE, unlockedAt: '2026-11-02T09:00' },
    ]);
    expect(ids(state, NOVEMBRE, 2026)).toEqual(['etageres', 'coffre-nagamochi', 'echelle']);
    expect(state.owned.every((o) => o.source === 'base' && o.placedAt !== null)).toBe(true);
    expect(state.owned.every((o) => o.state === 'intact')).toBe(true);
  });

  it('ouvre le mois du jeudi : installé un dimanche 1er novembre, la pièce reste celle d’octobre', () => {
    const state = installHouse(catalog, '2026-11-01', '2026-11-01T09:00');
    expect(state.unlocked[0].room).toBe(roomOfMonth('2026-10'));
  });
});

describe('objet suivant', () => {
  it('est le prochain objet non obtenu de la pièce, dans l’ordre du catalogue', () => {
    let state = installHouse(catalog, INSTALL, '2026-11-02T09:00');
    expect(nextItem(catalog, NOVEMBRE, 2026, state.owned)).toBe('rateau-porte-bonheur-kumade');
    state = awardWeeklyItem(catalog, state, '2026-W45', '2026-11-08T21:00').state;
    expect(nextItem(catalog, NOVEMBRE, 2026, state.owned)).toBe('chat-porte-bonheur');
  });

  it('ne compte que les objets de la même année', () => {
    const state = installHouse(catalog, INSTALL, '2026-11-02T09:00');
    const gagne = awardWeeklyItem(catalog, state, '2026-W45', '2026-11-08T21:00').state;
    expect(nextItem(catalog, NOVEMBRE, 2027, gagne.owned)).toBe('rateau-porte-bonheur-kumade');
  });

  it('scénario 20 (emplacements) : novembre 2026 offre 4 objets, décembre 2026 en offre 5', () => {
    const owned: HouseState['owned'] = [];
    const prendre = (room: string, annee: number) => {
      const suivant = nextItem(catalog, room, annee, owned);
      if (suivant) {
        owned.push({
          year: annee,
          room,
          itemId: suivant,
          source: 'weekly',
          week: null,
          acquiredAt: 'x',
          placedAt: 'x',
          state: 'intact',
        });
      }
      return suivant;
    };
    const novembre = [1, 2, 3, 4, 5].map(() => prendre(NOVEMBRE, 2026));
    expect(novembre.filter((i) => i !== null)).toHaveLength(4);
    expect(novembre[4]).toBeNull();
    const decembre = [1, 2, 3, 4, 5, 6].map(() => prendre(DECEMBRE, 2026));
    expect(decembre.filter((i) => i !== null)).toHaveLength(5);
    expect(decembre[5]).toBeNull();
  });

  it('est nul quand la pièce n’a plus d’objet à gagner (février 2052, 5 emplacements, 4 objets)', () => {
    const owned: HouseState['owned'] = [];
    const fevrier = roomOfMonth('2052-02');
    for (let k = 0; k < 6; k++) {
      const suivant = nextItem(catalog, fevrier, 2052, owned);
      if (suivant)
        owned.push({
          year: 2052,
          room: fevrier,
          itemId: suivant,
          source: 'weekly',
          week: null,
          acquiredAt: 'x',
          placedAt: 'x',
          state: 'intact',
        });
    }
    expect(owned).toHaveLength(4);
  });
});

describe('objet de la semaine', () => {
  it('entre dans la pièce du mois du jeudi, déjà débloquée', () => {
    const state = installHouse(catalog, INSTALL, '2026-11-02T09:00');
    const {
      state: apres,
      itemId,
      pending,
    } = awardWeeklyItem(catalog, state, '2026-W45', '2026-11-08T21:00');
    expect(itemId).toBe('rateau-porte-bonheur-kumade');
    expect(pending).toBe(false);
    const objet = apres.owned.find((o) => o.itemId === itemId);
    expect(objet).toMatchObject({ year: 2026, room: NOVEMBRE, source: 'weekly', week: '2026-W45' });
    expect(objet?.placedAt).toBe('2026-11-08T21:00');
  });

  it('ne rend rien quand la pièce n’a plus d’objet à gagner', () => {
    let state = installHouse(catalog, INSTALL, '2026-11-02T09:00');
    for (const w of ['2026-W45', '2026-W46', '2026-W47', '2026-W48']) {
      state = awardWeeklyItem(catalog, state, w, '2026-11-30T21:00').state;
    }
    const encore = awardWeeklyItem(catalog, state, '2026-W48', '2026-11-30T21:00');
    expect(encore.itemId).toBeNull();
    expect(encore.state).toBe(state);
  });

  test('scénario 18 : l’objet de la semaine 49 appartient à décembre, attend, puis entre à la validation du bilan de novembre', () => {
    const avant = installHouse(catalog, INSTALL, '2026-11-02T09:00');
    const { state, itemId, pending } = awardWeeklyItem(
      catalog,
      avant,
      '2026-W49',
      '2026-12-06T21:00',
    );
    expect(itemId).toBe('mortier-et-maillet-a-mochi');
    expect(pending).toBe(true);
    const attente = state.owned.find((o) => o.itemId === itemId);
    expect(attente).toMatchObject({ year: 2026, room: DECEMBRE, placedAt: null });
    expect(state.unlocked.some((u) => u.room === DECEMBRE)).toBe(false);

    const valide = validateMonthReview(catalog, state, {
      month: '2026-11',
      previousReview: null,
      installDay: INSTALL,
      at: '2026-12-07T08:00',
    });
    expect(valide.unlocked.some((u) => u.year === 2026 && u.room === DECEMBRE)).toBe(true);
    const place = valide.owned.find((o) => o.itemId === itemId);
    expect(place?.placedAt).toBe('2026-12-07T08:00');
    expect(ids(valide, DECEMBRE, 2026)).toEqual([
      'mortier-et-maillet-a-mochi',
      'jarre-a-eau',
      'banc-de-bois',
      'sandales-de-paille',
    ]);
  });

  it('un objet en attente ne compte pas deux fois : la semaine suivante donne l’objet d’après', () => {
    const avant = installHouse(catalog, INSTALL, '2026-11-02T09:00');
    const un = awardWeeklyItem(catalog, avant, '2026-W49', '2026-12-06T21:00');
    const deux = awardWeeklyItem(catalog, un.state, '2026-W50', '2026-12-13T21:00');
    expect(deux.itemId).toBe('balai-du-grand-menage');
  });
});

describe('déblocage des pièces', () => {
  it('scénario 17 (déblocage) : valider le bilan de novembre débloque la pièce de décembre, avec ses 3 objets de base', () => {
    const avant = installHouse(catalog, INSTALL, '2026-11-02T09:00');
    const apres = validateMonthReview(catalog, avant, {
      month: '2026-11',
      previousReview: null,
      installDay: INSTALL,
      at: '2026-12-01T08:00',
    });
    expect(apres.unlocked.map((u) => u.room)).toEqual([NOVEMBRE, DECEMBRE]);
    expect(ids(apres, DECEMBRE, 2026)).toEqual([
      'jarre-a-eau',
      'banc-de-bois',
      'sandales-de-paille',
    ]);
  });

  it('débloque aussi les pièces des mois sautés depuis le précédent bilan validé', () => {
    const avant = installHouse(catalog, '2026-03-02', '2026-03-02T09:00');
    const apres = validateMonthReview(catalog, avant, {
      month: '2026-06',
      previousReview: '2026-03',
      installDay: '2026-03-02',
      at: '2026-07-01T08:00',
    });
    expect(apres.unlocked.map((u) => u.room)).toEqual(
      ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07'].map(roomOfMonth),
    );
  });

  it('part de l’installation quand aucun bilan n’a été validé', () => {
    const avant = installHouse(catalog, '2026-03-02', '2026-03-02T09:00');
    const apres = validateMonthReview(catalog, avant, {
      month: '2026-05',
      previousReview: null,
      installDay: '2026-03-02',
      at: '2026-06-01T08:00',
    });
    expect(apres.unlocked.map((u) => u.room)).toEqual(
      ['2026-03', '2026-04', '2026-05', '2026-06'].map(roomOfMonth),
    );
  });

  it('place les objets en attente des mois sautés', () => {
    const avant = installHouse(catalog, '2026-03-02', '2026-03-02T09:00');
    const attente = awardWeeklyItem(catalog, avant, '2026-W19', '2026-05-10T21:00');
    expect(attente.pending).toBe(true);
    const apres = validateMonthReview(catalog, attente.state, {
      month: '2026-05',
      previousReview: null,
      installDay: '2026-03-02',
      at: '2026-06-01T08:00',
    });
    expect(apres.owned.every((o) => o.placedAt !== null)).toBe(true);
  });

  it('ne rouvre pas une pièce déjà débloquée', () => {
    const avant = installHouse(catalog, INSTALL, '2026-11-02T09:00');
    const un = validateMonthReview(catalog, avant, {
      month: '2026-11',
      previousReview: null,
      installDay: INSTALL,
      at: '2026-12-01T08:00',
    });
    const deux = validateMonthReview(catalog, un, {
      month: '2026-11',
      previousReview: null,
      installDay: INSTALL,
      at: '2026-12-02T08:00',
    });
    expect(deux).toEqual(un);
  });

  it('en décembre, le bilan ne débloque rien', () => {
    const avant = installHouse(catalog, INSTALL, '2026-11-02T09:00');
    const un = validateMonthReview(catalog, avant, {
      month: '2026-11',
      previousReview: null,
      installDay: INSTALL,
      at: '2026-12-01T08:00',
    });
    const deux = validateMonthReview(catalog, un, {
      month: '2026-12',
      previousReview: '2026-11',
      installDay: INSTALL,
      at: '2027-01-04T08:00',
    });
    expect(deux).toEqual(un);
  });
});

describe('nouvelle année', () => {
  test('scénario 21 : la maison 2027 démarre le lundi 4 janvier avec janvier et ses 3 objets de base ; l’objet de la semaine 53 reste dans la pièce de décembre 2026, dans l’album', () => {
    const base = installHouse(catalog, INSTALL, '2026-11-02T09:00');
    const decembre = validateMonthReview(catalog, base, {
      month: '2026-11',
      previousReview: null,
      installDay: INSTALL,
      at: '2026-12-01T08:00',
    });
    const semaine53 = awardWeeklyItem(catalog, decembre, '2026-W53', '2027-01-04T10:00');
    expect(semaine53.itemId).toBe('mortier-et-maillet-a-mochi');
    expect(semaine53.pending).toBe(false);
    expect(semaine53.state.owned.find((o) => o.itemId === semaine53.itemId)?.year).toBe(2026);

    const nouvelle = openNewYear(catalog, semaine53.state, 2027, '2027-01-04T00:00');
    expect(nouvelle.unlocked.filter((u) => u.year === 2027)).toEqual([
      { year: 2027, room: JANVIER, unlockedAt: '2027-01-04T00:00' },
    ]);
    expect(ids(nouvelle, JANVIER, 2027)).toEqual([
      'porte-coulissante',
      'meuble-a-chaussures',
      'porte-parapluies',
    ]);
    const maison2027 = nouvelle.owned.filter((o) => o.year === 2027);
    expect(maison2027.every((o) => o.state === 'intact' && o.source === 'base')).toBe(true);
    expect(albumYears(nouvelle, 2027)).toEqual([2026]);
    expect(ids(nouvelle, DECEMBRE, 2026)).toContain('mortier-et-maillet-a-mochi');
  });

  it('laisse la maison de l’année écoulée telle quelle, fêlures comprises', () => {
    const base = installHouse(catalog, INSTALL, '2026-11-02T09:00');
    const fele: HouseState = {
      ...base,
      owned: base.owned.map((o, i) => (i === 2 ? { ...o, state: 'cracked' as const } : o)),
    };
    const nouvelle = openNewYear(catalog, fele, 2027, '2027-01-04T00:00');
    expect(nouvelle.owned.filter((o) => o.year === 2026)).toEqual(fele.owned);
  });

  it('ouvre janvier sans attendre le bilan de décembre, qui ne débloque rien', () => {
    const base = installHouse(catalog, INSTALL, '2026-11-02T09:00');
    const nouvelle = openNewYear(catalog, base, 2027, '2027-01-04T00:00');
    expect(nouvelle.unlocked.some((u) => u.year === 2027 && u.room === JANVIER)).toBe(true);
  });

  it('est idempotente', () => {
    const base = installHouse(catalog, INSTALL, '2026-11-02T09:00');
    const un = openNewYear(catalog, base, 2027, '2027-01-04T00:00');
    expect(openNewYear(catalog, un, 2027, '2027-01-04T00:05')).toEqual(un);
  });

  it('place l’objet de la semaine 1 dans janvier de la nouvelle année', () => {
    const base = openNewYear(
      catalog,
      installHouse(catalog, INSTALL, '2026-11-02T09:00'),
      2027,
      '2027-01-04T00:00',
    );
    const { state, itemId } = awardWeeklyItem(catalog, base, '2027-W01', '2027-01-10T21:00');
    expect(itemId).toBe('kadomatsu');
    expect(state.owned.find((o) => o.itemId === 'kadomatsu')?.year).toBe(2027);
  });
});
