// Modèle de scène de la maison (J4.1, #80).
import catalogueJson from '../content/catalogue.json';
import type { BudgetVersion } from './budget';
import { addDays } from './calendrier';
import { houseScene, houseRooms } from './maison';
import { type Catalog, albumYears } from './objets';
import type { DayKey, LocalDateTime } from './scellement';
import { type AppEvent, type AppState, createAppState, process } from './traitement';

const catalog = catalogueJson as Catalog;
const at = (day: DayKey, time = '21:00'): LocalDateTime => ({ day, time });
const novembre: BudgetVersion = {
  id: 'b-nov',
  month: '2026-11',
  income: 200000,
  fixedCosts: 110000,
  savingsGoal: 30000,
  effectiveFrom: '2026-11-02',
};

function etat(installDay: DayKey, evenements: [AppEvent, LocalDateTime][]): AppState {
  let s = createAppState({ installDay, at: at(installDay, '08:00'), budgets: [novembre] }, catalog);
  for (const [e, t] of evenements) s = process(s, e, t, catalog).state;
  return s;
}
const ouvrir = (t: LocalDateTime): [AppEvent, LocalDateTime] => [{ type: 'open' }, t];
const fermer = (day: DayKey): [AppEvent, LocalDateTime] => [{ type: 'close_day', day }, at(day)];
const depenser = (day: DayKey, amount: number): [AppEvent, LocalDateTime] => [
  { type: 'save_expense', expense: { id: `e-${day}-${amount}`, day, amount } },
  at(day, '12:00'),
];
const fermerDu = (debut: DayKey, fin: DayKey, sauf: DayKey[] = []): [AppEvent, LocalDateTime][] => {
  const out: [AppEvent, LocalDateTime][] = [];
  for (let j = debut; j <= fin; j = addDays(j, 1)) if (!sauf.includes(j)) out.push(fermer(j));
  return out;
};

/** Semaine 45 complète et hors budget : le râteau sort de sa capsule, l'échelle se fêle. */
const semaine45HorsBudget = (): [AppEvent, LocalDateTime][] => [
  depenser('2026-11-03', 15000),
  ...fermerDu('2026-11-02', '2026-11-08'),
];

const resume = (s: AppState, year: number, room: string, today: DayKey) => {
  const scene = houseScene(s, catalog, year, room, today);
  return scene === null
    ? null
    : {
        ...scene,
        items: scene.items.map(
          (i) => `${i.itemId}:${i.source}${i.rank}:${i.state}:${i.repairDays}`,
        ),
        freeSlots: scene.freeSlots.map((f) => `${f.rank}:${f.itemId}`),
      };
};

describe('modèle de scène de la maison', () => {
  it('maison neuve : la pièce du mois, ses 3 objets de base intacts, 4 emplacements libres', () => {
    const s = etat('2026-11-02', []);
    expect(resume(s, 2026, 'room-11', '2026-11-02')).toEqual({
      year: 2026,
      month: '2026-11',
      room: 'room-11',
      items: [
        'etageres:base1:intact:null',
        'coffre-nagamochi:base2:intact:null',
        'echelle:base3:intact:null',
      ],
      freeSlots: [
        '1:rateau-porte-bonheur-kumade',
        '2:chat-porte-bonheur',
        '3:boulier-soroban',
        '4:sucres-d-orge-chitose-ame',
      ],
      dust: 0,
    });
  });

  it('une pièce pas encore débloquée n’a pas de scène', () => {
    const s = etat('2026-11-02', []);
    expect(houseScene(s, catalog, 2026, 'room-12', '2026-11-02')).toBeNull();
    expect(houseScene(s, catalog, 2025, 'room-11', '2026-11-02')).toBeNull();
  });

  it('objet gagné à son emplacement ; objet fêlé en tête de file : « x jours sur 7 »', () => {
    const s = etat('2026-11-02', [
      ...semaine45HorsBudget(),
      ...fermerDu('2026-11-09', '2026-11-12'),
    ]);
    expect(resume(s, 2026, 'room-11', '2026-11-12')?.items).toEqual([
      'etageres:base1:intact:null',
      'coffre-nagamochi:base2:intact:null',
      'echelle:base3:cracked:4',
      'rateau-porte-bonheur-kumade:weekly1:intact:null',
    ]);
    expect(resume(s, 2026, 'room-11', '2026-11-12')?.freeSlots).toEqual([
      '2:chat-porte-bonheur',
      '3:boulier-soroban',
      '4:sucres-d-orge-chitose-ame',
    ]);
  });

  it('juste après la fêlure, la réparation affiche 0 jour sur 7', () => {
    const s = etat('2026-11-02', [...semaine45HorsBudget(), ouvrir(at('2026-11-09', '08:00'))]);
    expect(resume(s, 2026, 'room-11', '2026-11-09')?.items[2]).toBe('echelle:base3:cracked:0');
  });

  it('objet réparé à l’or : plus de progression', () => {
    const s = etat('2026-11-02', [
      ...semaine45HorsBudget(),
      ...fermerDu('2026-11-09', '2026-11-15'),
    ]);
    expect(resume(s, 2026, 'room-11', '2026-11-15')?.items[2]).toBe('echelle:base3:repaired:null');
  });

  it('un objet fêlé qui attend son tour n’affiche aucune progression (scénario 11, puis 2e fêlure)', () => {
    // Semaine 46 : mercredi 11 jamais clôturé et hors budget, le râteau se fêle à son tour.
    const s = etat('2026-11-02', [
      ...semaine45HorsBudget(),
      depenser('2026-11-10', 15000),
      ...fermerDu('2026-11-09', '2026-11-15', ['2026-11-11']),
      ouvrir(at('2026-11-16', '13:00')),
    ]);
    expect(resume(s, 2026, 'room-11', '2026-11-16')?.items).toEqual([
      'etageres:base1:intact:null',
      'coffre-nagamochi:base2:intact:null',
      'echelle:base3:cracked:4',
      'rateau-porte-bonheur-kumade:weekly1:cracked:null',
    ]);
  });

  describe('poussière (scénario 9)', () => {
    const s = etat('2026-11-02', [fermer('2026-11-02')]);
    it.each([
      ['2026-11-03', 0],
      ['2026-11-04', 0],
      ['2026-11-05', 1],
      ['2026-11-06', 1],
      ['2026-11-07', 2],
    ] as const)('le %s : niveau %i', (today, niveau) => {
      expect(houseScene(s, catalog, 2026, 'room-11', today)?.dust).toBe(niveau);
    });

    it('après une semaine incomplète, au moins le niveau 1 malgré les clôtures', () => {
      const t = etat('2026-11-02', [
        ...fermerDu('2026-11-02', '2026-11-08', ['2026-11-04']),
        ouvrir(at('2026-11-09', '13:00')),
        ...fermerDu('2026-11-09', '2026-11-10'),
      ]);
      expect(houseScene(t, catalog, 2026, 'room-11', '2026-11-10')?.dust).toBe(1);
    });
  });

  it('mois de 5 semaines : décembre 2026 a 5 emplacements, novembre 4 (scénario 20)', () => {
    const s = etat('2026-11-02', [
      [{ type: 'validate_month', month: '2026-11', resolution: '' }, at('2026-12-01', '09:00')],
    ]);
    expect(resume(s, 2026, 'room-12', '2026-12-01')?.freeSlots).toEqual([
      '1:mortier-et-maillet-a-mochi',
      '2:balai-du-grand-menage',
      '3:soba-du-reveillon',
      '4:panier-de-yuzu',
      '5:boites-a-osechi',
    ]);
    expect(resume(s, 2026, 'room-11', '2026-12-01')?.freeSlots).toHaveLength(4);
  });

  it('un objet en attente n’apparaît dans aucune scène, puis entre dans sa pièce (scénario 18)', () => {
    const semaine49 = fermerDu('2026-11-30', '2026-12-06');
    const s = etat('2026-11-02', semaine49);
    expect(s.house.owned.some((o) => o.placedAt === null)).toBe(true);
    expect(houseScene(s, catalog, 2026, 'room-12', '2026-12-06')).toBeNull();
    expect(resume(s, 2026, 'room-11', '2026-12-06')?.items).toHaveLength(3);

    const t = process(
      s,
      { type: 'validate_month', month: '2026-11', resolution: '' },
      at('2026-12-07', '09:00'),
      catalog,
    ).state;
    const decembre = resume(t, 2026, 'room-12', '2026-12-07');
    expect(decembre?.items).toContain('mortier-et-maillet-a-mochi:weekly1:intact:null');
    expect(decembre?.freeSlots.map((f) => f.split(':')[0])).toEqual(['2', '3', '4', '5']);
  });

  describe('année passée (album)', () => {
    const s = etat('2026-11-02', [...semaine45HorsBudget(), ouvrir(at('2027-01-04', '09:00'))]);

    it('la maison 2026 reste telle quelle : fêlure sans progression, sans poussière', () => {
      expect(resume(s, 2026, 'room-11', '2027-01-04')).toEqual({
        year: 2026,
        month: '2026-11',
        room: 'room-11',
        items: [
          'etageres:base1:intact:null',
          'coffre-nagamochi:base2:intact:null',
          'echelle:base3:cracked:null',
          'rateau-porte-bonheur-kumade:weekly1:intact:null',
        ],
        freeSlots: ['2:chat-porte-bonheur', '3:boulier-soroban', '4:sucres-d-orge-chitose-ame'],
        dust: 0,
      });
    });

    it('la maison 2027 repart de la pièce de janvier et de ses objets de base', () => {
      const janvier = resume(s, 2027, 'room-01', '2027-01-04');
      expect(janvier?.items).toEqual([
        'porte-coulissante:base1:intact:null',
        'meuble-a-chaussures:base2:intact:null',
        'porte-parapluies:base3:intact:null',
      ]);
      expect(janvier?.dust).toBe(2);
    });

    it('pièces de chaque année dans l’ordre des mois, et années de l’album', () => {
      expect(houseRooms(s, catalog, 2027)).toEqual(['room-01']);
      expect(houseRooms(s, catalog, 2026)).toEqual(['room-11']);
      expect(albumYears(s.house, 2027)).toEqual([2026]);
    });
  });

  it('pièces débloquées de l’année dans l’ordre des mois, mois sautés compris', () => {
    const s = etat('2026-11-02', [
      [{ type: 'validate_month', month: '2026-11', resolution: '' }, at('2026-12-01', '09:00')],
    ]);
    expect(houseRooms(s, catalog, 2026)).toEqual(['room-11', 'room-12']);
  });
});
