import { heureLocale, instantLocal } from './temps';

describe('heure locale', () => {
  it('donne le jour et l’heure du téléphone, à la minute', () => {
    expect(heureLocale(new Date(2026, 10, 9, 12, 0, 59))).toEqual({
      day: '2026-11-09',
      time: '12:00',
    });
    expect(heureLocale(new Date(2026, 10, 8, 23, 59))).toEqual({
      day: '2026-11-08',
      time: '23:59',
    });
    expect(heureLocale(new Date(2027, 0, 1, 0, 5))).toEqual({ day: '2027-01-01', time: '00:05' });
  });

  it('écrit un instant ISO 8601 avec son fuseau', () => {
    expect(instantLocal(new Date(2026, 10, 2, 21, 0, 7))).toMatch(
      /^2026-11-02T21:00:07(Z|[+-]\d\d:\d\d)$/,
    );
  });
});
