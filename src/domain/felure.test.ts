// Fêlure, file de réparation et réparation à l'or (J1.6).
// Contexte commun : installation le lundi 2 novembre 2026, semaine 45 du lundi 2 au dimanche 8,
// enveloppe de 140 €, chaque jour clôturé le soir même sauf mention contraire.
import catalogueJson from '../content/catalogue.json';
import { type BudgetVersion, type Expense } from './budget';
import { addDays } from './calendrier';
import {
  type Crack,
  applyCrack,
  applyRepairs,
  cracksOfYear,
  crackTarget,
  repairProgress,
  repairs,
} from './felure';
import { type Catalog, type HouseState, awardWeeklyItem, installHouse } from './objets';
import { type DayKey, type WeekId, type WeekResult, sealWeek } from './scellement';

const catalog: Catalog = catalogueJson as Catalog;
const INSTALL = '2026-11-02';
const euros = (n: number): number => Math.round(n * 100);

const novembre: BudgetVersion = {
  id: 'b-nov',
  month: '2026-11',
  income: euros(2000),
  fixedCosts: euros(1100),
  savingsGoal: euros(300),
  effectiveFrom: '2026-11-02',
};

const plage = (debut: DayKey, fin: DayKey): DayKey[] => {
  const jours: DayKey[] = [];
  for (let j = debut; j <= fin; j = addDays(j, 1)) jours.push(j);
  return jours;
};
const depense = (day: DayKey, montant: number): Expense => ({
  id: `e-${day}`,
  day,
  amount: euros(montant),
});

const maison = (): HouseState => installHouse(catalog, INSTALL, '2026-11-02T08:00:00');

/** Scelle une semaine de novembre : prochain objet et cible de fêlure viennent du domaine. */
function sceller(
  house: HouseState,
  week: WeekId,
  closedDays: DayKey[],
  depenseDu: DayKey,
  montant: number,
  at: string,
): { house: HouseState; result: WeekResult } {
  const prochain = awardWeeklyItem(catalog, house, week, at);
  const complete = closedDays.length === 7;
  const result = sealWeek({
    week,
    installDay: INSTALL,
    sealedAt: { day: at.slice(0, 10), time: at.slice(11, 16) },
    closedDays,
    expenses: [depense(depenseDu, montant)],
    budgets: [novembre],
    nextItem: complete ? prochain.itemId : null,
    crackTarget: crackTarget(catalog, house.owned, 2026, prochain.itemId),
  });
  let suite = complete ? prochain.state : house;
  if (result.crackedItem) suite = applyCrack(suite, result.crackedItem);
  return { house: suite, result };
}

const SEMAINE_45 = plage('2026-11-02', '2026-11-08');
const baseKura = catalog.items.filter((i) => i.room === 'room-11' && i.source === 'base');
const gainsKura = catalog.items.filter((i) => i.room === 'room-11' && i.source === 'weekly');

describe('quel objet se fêle', () => {
  test(
    'scénario 2 : semaine 45 avec 7 clôtures et 150 € dépensés ; le même objet qu’au scénario 1 sort ' +
      'de sa capsule, et le 3e objet de base de novembre se fêle (à date égale, le dernier dans l’ordre du catalogue)',
    () => {
      const { house, result } = sceller(
        maison(),
        '2026-W45',
        SEMAINE_45,
        '2026-11-04',
        150,
        '2026-11-08T21:00:00',
      );
      expect(result.gashaponItem).toBe(gainsKura[0].id);
      expect(result.crackedItem).toBe(baseKura[2].id);
      const fele = house.owned.find((o) => o.itemId === baseKura[2].id);
      expect(fele?.state).toBe('cracked');
      // L'objet gagné au même bilan ne se fêle pas.
      expect(house.owned.find((o) => o.itemId === gainsKura[0].id)?.state).toBe('intact');
    },
  );

  test(
    'scénario 4 : comme le scénario 3 (mercredi 4 jamais clôturé) avec 150 € dépensés ; pas de capsule, ' +
      'poussière comme au scénario 3, et le même objet qu’au scénario 2 se fêle',
    () => {
      const six = SEMAINE_45.filter((j) => j !== '2026-11-04');
      const { result } = sceller(
        maison(),
        '2026-W45',
        six,
        '2026-11-04',
        150,
        '2026-11-09T12:00:00',
      );
      expect(result.stamps).toBe(6);
      expect(result.complete).toBe(false); // la poussière se lit ici (J1.5)
      expect(result.gashaponItem).toBeNull();
      expect(result.crackedItem).toBe(baseKura[2].id);
    },
  );

  test(
    'scénario 22 : semaines 45 à 47 complètes et dans le budget (objets A, B et C), semaine 48 avec ' +
      '7 tampons hors budget ; l’objet D sort de sa capsule et C se fêle, l’objet gagné au même bilan ne se fêle jamais',
    () => {
      let h = maison();
      const semaines: [WeekId, DayKey, DayKey][] = [
        ['2026-W45', '2026-11-02', '2026-11-08'],
        ['2026-W46', '2026-11-09', '2026-11-15'],
        ['2026-W47', '2026-11-16', '2026-11-22'],
      ];
      for (const [w, debut, fin] of semaines) {
        const r = sceller(h, w, plage(debut, fin), debut, 10, `${fin}T21:00:00`);
        expect(r.result.crackedItem).toBeNull();
        h = r.house;
      }
      const r48 = sceller(
        h,
        '2026-W48',
        plage('2026-11-23', '2026-11-29'),
        '2026-11-24',
        200,
        '2026-11-29T21:00:00',
      );
      expect(r48.result.gashaponItem).toBe(gainsKura[3].id); // D
      expect(r48.result.crackedItem).toBe(gainsKura[2].id); // C
      expect(r48.house.owned.find((o) => o.itemId === gainsKura[3].id)?.state).toBe('intact');
    },
  );

  test('scénario 13 : semaine hors budget alors que tous les objets possédés sont fêlés ou réparés ; rien ne se fêle', () => {
    let h = maison();
    h = {
      ...h,
      owned: h.owned.map((o, i) => ({ ...o, state: i === 0 ? 'repaired' : 'cracked' })),
    };
    expect(crackTarget(catalog, h.owned, 2026, null)).toBeNull();
    const r = sceller(h, '2026-W45', SEMAINE_45, '2026-11-04', 300, '2026-11-08T21:00:00');
    // Seul l'objet gagné (intact, même bilan) existe de plus : il est exclu.
    expect(r.result.crackedItem).toBeNull();
  });

  test('sans aucun objet intact, ou sans objet du tout, rien ne se fêle', () => {
    expect(crackTarget(catalog, [], 2026, null)).toBeNull();
  });

  test('l’objet intact obtenu le plus récemment gagne, les objets des années passées sont ignorés', () => {
    const h = maison();
    const ancien = { ...h.owned[2], year: 2025, acquiredAt: '2025-12-30T10:00:00' };
    const recent = {
      ...h.owned[0],
      itemId: gainsKura[0].id,
      source: 'weekly' as const,
      acquiredAt: '2026-11-08T21:00:00',
    };
    expect(crackTarget(catalog, [...h.owned, ancien, recent], 2026, null)).toBe(gainsKura[0].id);
    expect(crackTarget(catalog, [...h.owned, ancien, recent], 2026, gainsKura[0].id)).toBe(
      baseKura[2].id,
    );
  });
});

describe('file de réparation', () => {
  const A: Crack = { itemId: 'objet-a', week: '2026-W45' };
  const B: Crack = { itemId: 'objet-b', week: '2026-W46' };

  test(
    'scénario 10 : objet fêlé au bilan de la semaine 45, clôtures du lundi 9 au dimanche 15 ; ' +
      'réparé à la clôture du dimanche 15',
    () => {
      const [a] = repairs([A], plage('2026-11-09', '2026-11-15'));
      expect(a.startDay).toBe('2026-11-09');
      expect(a.repairedOn).toBe('2026-11-15');
      expect(repairs([A], plage('2026-11-09', '2026-11-14'))[0].repairedOn).toBeNull();
    },
  );

  test(
    'scénario 11 : fêlé en semaine 45, clôtures les 9 et 10 puis du 12 au 18, mercredi 11 jamais rattrapé ; ' +
      'affiche « 4 jours sur 7 » le dimanche 15, réparé à la clôture du mercredi 18',
    () => {
      const jusquAu15 = ['2026-11-09', '2026-11-10', ...plage('2026-11-12', '2026-11-15')];
      expect(repairs([A], jusquAu15)[0]).toMatchObject({ repairedOn: null, progress: 4 });
      expect(repairProgress('2026-11-09', jusquAu15)).toBe(4);
      const jusquAu18 = ['2026-11-09', '2026-11-10', ...plage('2026-11-12', '2026-11-18')];
      expect(repairs([A], jusquAu18)[0].repairedOn).toBe('2026-11-18');
    },
  );

  test(
    'scénario 12 : objet A fêlé en semaine 45, objet B fêlé en semaine 46, clôtures sans interruption à ' +
      'partir du lundi 9 ; A réparé dimanche 15, avant le scellement de la semaine 46, B réparé dimanche 22',
    () => {
      const [a, b] = repairs([A, B], plage('2026-11-09', '2026-11-22'));
      expect(a.repairedOn).toBe('2026-11-15');
      expect(b.startDay).toBe('2026-11-16');
      expect(b.repairedOn).toBe('2026-11-22');
      // Le dimanche 15, B n'a pas commencé : seul A est visible dans la file.
      const au15 = repairs([A, B], plage('2026-11-09', '2026-11-15'));
      expect(au15[0].repairedOn).toBe('2026-11-15');
      expect(au15[1]).toMatchObject({ repairedOn: null, progress: 0 });
    },
  );

  test('un objet fêlé plus tard commence au lundi suivant sa propre semaine fautive', () => {
    const tard: Crack = { itemId: 'objet-c', week: '2026-W47' };
    const [a, c] = repairs([A, tard], plage('2026-11-09', '2026-11-22'));
    expect(a.repairedOn).toBe('2026-11-15');
    expect(c.startDay).toBe('2026-11-23');
    expect(c.repairedOn).toBeNull();
  });

  test('les cracks sont traités dans l’ordre où les objets se sont fêlés, quel que soit l’ordre reçu', () => {
    const res = repairs([B, A], plage('2026-11-09', '2026-11-22'));
    expect(res.map((r) => r.itemId)).toEqual(['objet-a', 'objet-b']);
  });

  test('une clôture de rattrapage complète la série', () => {
    const sansMercredi = plage('2026-11-09', '2026-11-15').filter((j) => j !== '2026-11-11');
    expect(repairs([A], sansMercredi)[0].repairedOn).toBeNull();
    expect(repairs([A], [...sansMercredi, '2026-11-11'])[0].repairedOn).toBe('2026-11-15');
  });

  test('les jours antérieurs au jour de départ ne comptent pas', () => {
    const [a] = repairs([A], plage('2026-11-05', '2026-11-14'));
    expect(a.repairedOn).toBeNull();
    expect(a.progress).toBe(6);
  });

  test('la file d’une nouvelle année repart à zéro', () => {
    const resultats = [
      { week: '2026-W52', crackedItem: 'x' },
      { week: '2027-W02', crackedItem: 'y' },
      { week: '2027-W03', crackedItem: null },
    ] as WeekResult[];
    expect(cracksOfYear(resultats, 2027)).toEqual([{ itemId: 'y', week: '2027-W02' }]);
  });
});

describe('réparation à l’or', () => {
  test('applyRepairs fait passer l’objet fêlé à réparé, et un objet réparé ne se fêle plus', () => {
    let h = maison();
    const cible = baseKura[2].id;
    h = applyCrack(h, cible);
    expect(h.owned.find((o) => o.itemId === cible)?.state).toBe('cracked');
    h = applyRepairs(h, [
      {
        itemId: cible,
        week: '2026-W45',
        startDay: '2026-11-09',
        repairedOn: '2026-11-15',
        progress: 7,
      },
    ]);
    expect(h.owned.find((o) => o.itemId === cible)?.state).toBe('repaired');
    expect(applyCrack(h, cible)).toBe(h);
    expect(crackTarget(catalog, h.owned, 2026, null)).toBe(baseKura[1].id);
  });
});
