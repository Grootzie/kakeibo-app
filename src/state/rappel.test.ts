// Rappel du soir (#47) : quels rappels planifier, à partir de l'heure actuelle, des réglages et des
// jours clôturés. Une notification par jour au plus, à l'heure choisie, seulement si le jour n'est
// pas clôturé ; les trois textes de la spec en alternance.
import { fr } from '../i18n/fr';
import { JOURS_PLANIFIES, jourDuRappel, rappelsAPlanifier } from './rappel';

const reglages = { reminderTime: '21:00', reminderEnabled: true };

describe('rappels à planifier', () => {
  test('aujourd’hui à 21:00 si la journée n’est pas clôturée, puis un par jour', () => {
    const plan = rappelsAPlanifier({
      maintenant: { day: '2026-11-05', time: '09:00' },
      reglages,
      joursClotures: [],
    });
    expect(plan).toHaveLength(JOURS_PLANIFIES);
    expect(plan[0]).toMatchObject({ jour: '2026-11-05', heure: '21:00' });
    expect(plan[1]).toMatchObject({ jour: '2026-11-06', heure: '21:00' });
    // Un seul rappel par jour, jours consécutifs.
    expect(new Set(plan.map((r) => r.jour)).size).toBe(plan.length);
    expect(plan.every((r) => r.heure === '21:00')).toBe(true);
  });

  test('pas de rappel aujourd’hui si la journée est clôturée : le premier est demain', () => {
    const plan = rappelsAPlanifier({
      maintenant: { day: '2026-11-05', time: '20:30' },
      reglages,
      joursClotures: ['2026-11-04', '2026-11-05'],
    });
    expect(plan[0].jour).toBe('2026-11-06');
    expect(plan.map((r) => r.jour)).not.toContain('2026-11-05');
  });

  test('pas de rappel aujourd’hui une fois l’heure passée', () => {
    const a = rappelsAPlanifier({
      maintenant: { day: '2026-11-05', time: '21:00' },
      reglages,
      joursClotures: [],
    });
    expect(a[0].jour).toBe('2026-11-06');
    const b = rappelsAPlanifier({
      maintenant: { day: '2026-11-05', time: '20:59' },
      reglages,
      joursClotures: [],
    });
    expect(b[0].jour).toBe('2026-11-05');
  });

  test('à l’heure de reminder_time', () => {
    const plan = rappelsAPlanifier({
      maintenant: { day: '2026-11-05', time: '08:00' },
      reglages: { reminderTime: '07:30', reminderEnabled: true },
      joursClotures: [],
    });
    expect(plan[0]).toMatchObject({ jour: '2026-11-06', heure: '07:30' });
  });

  test('rien si le rappel est désactivé', () => {
    expect(
      rappelsAPlanifier({
        maintenant: { day: '2026-11-05', time: '09:00' },
        reglages: { reminderTime: '21:00', reminderEnabled: false },
        joursClotures: [],
      }),
    ).toEqual([]);
  });

  test('les trois textes de la spec, en alternance d’un jour à l’autre', () => {
    const plan = rappelsAPlanifier({
      maintenant: { day: '2026-11-05', time: '09:00' },
      reglages,
      joursClotures: [],
    });
    expect(fr.rappels).toEqual([
      'Ta journée est-elle complète\u00a0?',
      'Un tampon t’attend ce soir.',
      'Deux minutes pour clôturer ta journée\u00a0?',
    ]);
    const textes = plan.slice(0, 6).map((r) => r.texte);
    expect(new Set(textes.slice(0, 3))).toEqual(new Set(fr.rappels));
    expect(textes.slice(3)).toEqual(textes.slice(0, 3));
    // Le texte d'un jour ne dépend que du jour : il ne change pas d'une planification à l'autre.
    const plusTard = rappelsAPlanifier({
      maintenant: { day: '2026-11-07', time: '10:00' },
      reglages,
      joursClotures: [],
    });
    expect(plusTard[0]).toEqual(plan[2]);
  });

  test('l’alternance continue d’un mois et d’une année à l’autre', () => {
    const plan = rappelsAPlanifier({
      maintenant: { day: '2026-12-30', time: '09:00' },
      reglages,
      joursClotures: [],
    });
    for (let i = 1; i < 6; i++) expect(plan[i].texte).not.toBe(plan[i - 1].texte);
    expect(plan.map((r) => r.jour).slice(0, 4)).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });
});

describe('jour du rappel touché', () => {
  test('lit le jour des données de la notification', () => {
    expect(jourDuRappel({ jour: '2026-11-05' })).toBe('2026-11-05');
  });

  test('ignore toute autre donnée', () => {
    expect(jourDuRappel(undefined)).toBeNull();
    expect(jourDuRappel(null)).toBeNull();
    expect(jourDuRappel({})).toBeNull();
    expect(jourDuRappel({ jour: 5 })).toBeNull();
    expect(jourDuRappel({ jour: '../reglages' })).toBeNull();
  });
});
