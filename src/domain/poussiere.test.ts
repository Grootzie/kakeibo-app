// Niveaux de poussière et plancher après une semaine incomplète (J1.5).
// Contexte commun : installation le lundi 2 novembre 2026.
import { dustDays, dustFloor, dustLevel, type DustWeek } from './poussiere';

const INSTALL = '2026-11-02';
const sem = (week: string, complete: boolean): DustWeek => ({ week, complete });

describe('poussière', () => {
  test('scénario 9 : dernière clôture le lundi 2 ; jeudi 5 poussière niveau 1, samedi 7 niveau 2, après rattrapage du vendredi 6 niveau 0', () => {
    const closures = ['2026-11-02'];
    expect(dustLevel('2026-11-05', closures, [], INSTALL)).toBe(1);
    expect(dustLevel('2026-11-07', closures, [], INSTALL)).toBe(2);
    expect(dustLevel('2026-11-07', [...closures, '2026-11-06'], [], INSTALL)).toBe(0);
  });

  describe('J, jours entre le dernier jour clôturé et hier', () => {
    test('0 si le dernier jour clôturé est hier ou aujourd’hui', () => {
      expect(dustDays('2026-11-05', ['2026-11-04'], INSTALL)).toBe(0);
      expect(dustDays('2026-11-05', ['2026-11-05'], INSTALL)).toBe(0);
    });

    test('compte les jours entiers jusqu’à hier', () => {
      expect(dustDays('2026-11-05', ['2026-11-02'], INSTALL)).toBe(2);
      expect(dustDays('2026-11-07', ['2026-11-02'], INSTALL)).toBe(4);
    });

    test('part du dernier jour clôturé, même si des jours plus anciens manquent', () => {
      expect(dustDays('2026-11-07', ['2026-11-02', '2026-11-05'], INSTALL)).toBe(1);
    });

    test('sans aucune clôture, part de la veille du jour d’installation', () => {
      expect(dustDays('2026-11-02', [], INSTALL)).toBe(0);
      expect(dustDays('2026-11-03', [], INSTALL)).toBe(1);
      expect(dustDays('2026-11-04', [], INSTALL)).toBe(2);
    });

    test('ne dépend pas de l’ordre des clôtures', () => {
      expect(dustDays('2026-11-07', ['2026-11-05', '2026-11-02'], INSTALL)).toBe(1);
    });
  });

  describe('niveaux', () => {
    const niveau = (j: number): number =>
      // dernier jour clôturé = aujourd’hui − 1 − j
      dustLevel('2026-11-20', [`2026-11-${String(19 - j).padStart(2, '0')}`], [], INSTALL);

    test('J = 0 ou 1 : niveau 0', () => {
      expect(niveau(0)).toBe(0);
      expect(niveau(1)).toBe(0);
    });

    test('J = 2 ou 3 : niveau 1', () => {
      expect(niveau(2)).toBe(1);
      expect(niveau(3)).toBe(1);
    });

    test('J = 4 et plus : niveau 2', () => {
      expect(niveau(4)).toBe(2);
      expect(niveau(10)).toBe(2);
    });
  });

  describe('clôturer recalcule le niveau', () => {
    test('clôturer un jour plus récent baisse le niveau', () => {
      const avant = dustLevel('2026-11-09', ['2026-11-02'], [], INSTALL);
      const apres = dustLevel('2026-11-09', ['2026-11-02', '2026-11-06'], [], INSTALL);
      expect(avant).toBe(2);
      expect(apres).toBe(1);
    });

    test('clôturer aujourd’hui remet à 0', () => {
      expect(dustLevel('2026-11-08', ['2026-11-02', '2026-11-08'], [], INSTALL)).toBe(0);
    });

    test('clôturer un jour plus ancien que le dernier ne change rien', () => {
      const avant = dustLevel('2026-11-08', ['2026-11-02'], [], INSTALL);
      expect(dustLevel('2026-11-08', ['2026-11-02', '2026-11-03'], [], INSTALL)).toBe(avant);
    });
  });

  describe('plancher après une semaine incomplète', () => {
    const toutesClotures = [
      '2026-11-02',
      '2026-11-03',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
    ];

    test('scénario 3, partie poussière : la maison garde au moins le niveau 1 même si les jours suivants sont clôturés', () => {
      const semaines = [sem('2026-W45', false)];
      expect(dustLevel('2026-11-10', toutesClotures, [], INSTALL)).toBe(0);
      expect(dustLevel('2026-11-10', toutesClotures, semaines, INSTALL)).toBe(1);
    });

    test('le plancher ne baisse pas le niveau 2', () => {
      expect(dustLevel('2026-11-20', ['2026-11-02'], [sem('2026-W45', false)], INSTALL)).toBe(2);
    });

    test('une semaine complète suivante lève le plancher', () => {
      const semaines = [sem('2026-W45', false), sem('2026-W46', true)];
      expect(dustLevel('2026-11-11', toutesClotures, semaines, INSTALL)).toBe(0);
    });

    test('une semaine incomplète après une complète rétablit le plancher', () => {
      const semaines = [sem('2026-W45', true), sem('2026-W46', false)];
      expect(dustLevel('2026-11-11', toutesClotures, semaines, INSTALL)).toBe(1);
    });

    test('l’ordre des semaines passées ne compte pas : seule la plus récente décide', () => {
      const semaines = [sem('2026-W46', true), sem('2026-W45', false)];
      expect(dustLevel('2026-11-11', toutesClotures, semaines, INSTALL)).toBe(0);
    });

    test('sans semaine scellée, aucun plancher', () => {
      expect(dustLevel('2026-11-10', toutesClotures, [], INSTALL)).toBe(0);
    });
  });

  test('scénario 14, partie poussière : après les semaines 46 à 48 non ouvertes, niveau 2 le mardi 1er décembre', () => {
    const closures = ['2026-11-08'];
    const semaines = [
      sem('2026-W45', true),
      sem('2026-W46', false),
      sem('2026-W47', false),
      sem('2026-W48', false),
    ];
    expect(dustLevel('2026-12-01', closures, semaines, INSTALL)).toBe(2);
    expect(dustDays('2026-12-01', closures, INSTALL)).toBe(22);
  });
});

describe('plancher après une semaine incomplète (récapitulatif, J3.3)', () => {
  test('actif si la dernière semaine scellée est incomplète, quel que soit l’ordre reçu', () => {
    expect(dustFloor([sem('2026-W46', false), sem('2026-W45', true)])).toBe(true);
    expect(dustFloor([sem('2026-W46', true), sem('2026-W45', false)])).toBe(false);
  });

  test('inactif sans aucune semaine scellée', () => {
    expect(dustFloor([])).toBe(false);
  });
});
