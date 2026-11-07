// Noter une dépense (E3, J2.3) : bornes du montant, longueur de la note et jours proposés.
// Installation le mercredi 4 novembre 2026 ; semaine 45 du lundi 2 au dimanche 8.
import {
  MAX_AMOUNT,
  MIN_AMOUNT,
  NOTE_MAX_LENGTH,
  expenseDays,
  isValidAmount,
  isValidNote,
} from './depense';
import type { DayKey, LocalDateTime } from './scellement';

const at = (day: DayKey, time: string): LocalDateTime => ({ day, time });

describe('montant d’une dépense', () => {
  test('accepté de 0,01 € à 99 999,99 €, en centimes entiers', () => {
    expect(MIN_AMOUNT).toBe(1);
    expect(MAX_AMOUNT).toBe(9_999_999);
    expect(isValidAmount(1)).toBe(true);
    expect(isValidAmount(1250)).toBe(true);
    expect(isValidAmount(9_999_999)).toBe(true);
  });

  test('refusé hors bornes ou s’il n’est pas un nombre entier de centimes', () => {
    expect(isValidAmount(0)).toBe(false);
    expect(isValidAmount(-1)).toBe(false);
    expect(isValidAmount(10_000_000)).toBe(false);
    expect(isValidAmount(12.5)).toBe(false);
    expect(isValidAmount(Number.NaN)).toBe(false);
  });
});

describe('note d’une dépense', () => {
  test('facultative, de 80 caractères au plus', () => {
    expect(NOTE_MAX_LENGTH).toBe(80);
    expect(isValidNote('')).toBe(true);
    expect(isValidNote('a'.repeat(80))).toBe(true);
    expect(isValidNote('a'.repeat(81))).toBe(false);
  });

  test('compte les caractères, pas les unités de code', () => {
    expect(isValidNote('𝄞'.repeat(80))).toBe(true);
    expect(isValidNote('é'.repeat(80))).toBe(true);
  });
});

describe('jours proposés pour une dépense', () => {
  const ctx = { installDay: '2026-11-04', closedDays: [], sealedWeeks: [] };

  test('les jours décomptés de la semaine en cours jusqu’à aujourd’hui, sans jour futur', () => {
    expect(expenseDays(at('2026-11-06', '10:00'), ctx)).toEqual([
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
    ]);
  });

  test('un jour clôturé reste proposé', () => {
    const clos = { ...ctx, closedDays: ['2026-11-04', '2026-11-05'] };
    expect(expenseDays(at('2026-11-06', '10:00'), clos)).toEqual([
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
    ]);
  });

  test('le lundi avant 12:00, la semaine précédente encore ouverte est proposée', () => {
    expect(expenseDays(at('2026-11-09', '11:59'), ctx)).toEqual([
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
    ]);
  });

  test('à partir du lundi 12:00, ou une fois scellée, la semaine précédente ne l’est plus', () => {
    expect(expenseDays(at('2026-11-09', '12:00'), ctx)).toEqual(['2026-11-09']);
    expect(expenseDays(at('2026-11-09', '08:00'), { ...ctx, sealedWeeks: ['2026-W45'] })).toEqual([
      '2026-11-09',
    ]);
  });
});
