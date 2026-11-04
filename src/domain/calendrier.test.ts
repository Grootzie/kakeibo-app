// Calendrier : semaines ISO, mois d'une semaine, emplacements (J1.1).
// Contexte commun : installation le lundi 2 novembre 2026 (voir docs/spec.md, « Scénarios de test »).
import {
  addDays,
  countedDays,
  dayOfWeek,
  slotsInMonth,
  weekDays,
  weekMonth,
  weekOf,
  weeksOfMonth,
} from './calendrier';

const INSTALL = '2026-11-02';

describe('calendrier', () => {
  describe('jours', () => {
    test('addDays traverse les mois, les années et les années bissextiles', () => {
      expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
      expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
      expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
      expect(addDays('2026-11-02', -3)).toBe('2026-10-30');
    });

    test('dayOfWeek vaut 1 pour lundi et 7 pour dimanche', () => {
      expect(dayOfWeek('2026-11-02')).toBe(1);
      expect(dayOfWeek('2026-11-08')).toBe(7);
    });
  });

  describe('semaines ISO 8601', () => {
    test('weekOf : le 2 novembre 2026 est en semaine 45', () => {
      expect(weekOf('2026-11-02')).toBe('2026-W45');
      expect(weekOf('2026-11-08')).toBe('2026-W45');
      expect(weekOf('2026-11-09')).toBe('2026-W46');
    });

    test('weekOf : les limites d’année suivent la norme', () => {
      expect(weekOf('2026-12-31')).toBe('2026-W53');
      expect(weekOf('2027-01-03')).toBe('2026-W53');
      expect(weekOf('2027-01-04')).toBe('2027-W01');
      expect(weekOf('2024-12-30')).toBe('2025-W01');
      expect(weekOf('2021-01-03')).toBe('2020-W53');
    });

    test('weekDays donne les sept jours, du lundi au dimanche', () => {
      expect(weekDays('2026-W45')).toEqual([
        '2026-11-02',
        '2026-11-03',
        '2026-11-04',
        '2026-11-05',
        '2026-11-06',
        '2026-11-07',
        '2026-11-08',
      ]);
      expect(weekDays('2027-W01')[0]).toBe('2027-01-04');
      expect(weekDays('2026-W53')[6]).toBe('2027-01-03');
    });

    test('weekDays et weekOf sont réciproques', () => {
      weekDays('2026-W49').forEach((d) => expect(weekOf(d)).toBe('2026-W49'));
    });
  });

  describe('jours décomptés', () => {
    test('une semaine entière après l’installation compte 7 jours', () => {
      expect(countedDays('2026-W46', INSTALL)).toHaveLength(7);
    });

    test('une semaine avant l’installation compte 0 jour', () => {
      expect(countedDays('2026-W44', INSTALL)).toEqual([]);
    });

    test('le jour d’installation lui-même est décompté', () => {
      expect(countedDays('2026-W45', INSTALL)).toHaveLength(7);
    });

    test('scénario 7 (partie calendrier) : installation le jeudi 5 novembre, 4 jours décomptés', () => {
      expect(countedDays('2026-W45', '2026-11-05')).toEqual([
        '2026-11-05',
        '2026-11-06',
        '2026-11-07',
        '2026-11-08',
      ]);
    });
  });

  describe('mois d’une semaine', () => {
    test('c’est celui de son jeudi', () => {
      expect(weekMonth('2026-W44')).toBe('2026-10'); // jeudi 29 octobre
      expect(weekMonth('2026-W45')).toBe('2026-11'); // jeudi 5 novembre
      expect(weekMonth('2026-W49')).toBe('2026-12'); // jeudi 3 décembre
      expect(weekMonth('2026-W53')).toBe('2026-12'); // jeudi 31 décembre
      expect(weekMonth('2027-W01')).toBe('2027-01'); // jeudi 7 janvier
    });

    test('la semaine du 30 novembre appartient à décembre (jeudi 3)', () => {
      expect(weekMonth(weekOf('2026-11-30'))).toBe('2026-12');
    });
  });

  describe('scénario 20 (calendrier)', () => {
    test('scénario 20 : novembre 2026 compte les semaines 45 à 48, donc 4 emplacements ; décembre 2026 compte les semaines 49 à 53, donc 5, car le jeudi de la semaine 53 tombe le 31 décembre', () => {
      expect(weeksOfMonth('2026-11')).toEqual(['2026-W45', '2026-W46', '2026-W47', '2026-W48']);
      expect(slotsInMonth('2026-11')).toBe(4);
      expect(weeksOfMonth('2026-12')).toEqual([
        '2026-W49',
        '2026-W50',
        '2026-W51',
        '2026-W52',
        '2026-W53',
      ]);
      expect(slotsInMonth('2026-12')).toBe(5);
    });

    test('février compte 4 semaines, sauf en 2052 où il en compte 5', () => {
      expect(slotsInMonth('2026-02')).toBe(4);
      expect(slotsInMonth('2052-02')).toBe(5);
    });

    test('chaque semaine appartient à un seul mois', () => {
      const vues = new Set<string>();
      for (let m = 1; m <= 12; m++) {
        const mois = `2026-${String(m).padStart(2, '0')}`;
        weeksOfMonth(mois).forEach((w) => {
          expect(vues.has(w)).toBe(false);
          vues.add(w);
        });
      }
    });
  });
});
