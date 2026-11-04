// Clôture des jours, scellement et résultat d'une semaine (J1.3).
// Contexte commun : installation le lundi 2 novembre 2026, semaine 45 du lundi 2 au dimanche 8,
// enveloppe de 140 €, chaque jour clôturé le soir même sauf mention contraire.
import { type BudgetVersion, type Expense } from './budget';
import {
  type DayKey,
  type LocalDateTime,
  type WeekResult,
  canAddExpense,
  canCloseDay,
  sealDeadline,
  sealWeek,
  sealingTrigger,
  weeksToSeal,
} from './scellement';

const INSTALL = '2026-11-02';
const SEMAINE = '2026-W45';
const euros = (n: number): number => Math.round(n * 100);
const at = (day: DayKey, time: string): LocalDateTime => ({ day, time });

const novembre: BudgetVersion = {
  id: 'b-nov',
  month: '2026-11',
  income: euros(2000),
  fixedCosts: euros(1100),
  savingsGoal: euros(300),
  effectiveFrom: '2026-11-02',
};

const JOURS_45: DayKey[] = [
  '2026-11-02',
  '2026-11-03',
  '2026-11-04',
  '2026-11-05',
  '2026-11-06',
  '2026-11-07',
  '2026-11-08',
];
const sans = (jours: DayKey[], retire: DayKey): DayKey[] => jours.filter((j) => j !== retire);

const depense = (day: DayKey, montant: number): Expense => ({
  id: `e-${day}`,
  day,
  amount: euros(montant),
});

// Objets que le reste du domaine (J1.4 et J1.6) désigne : ici, des identifiants de test.
const OBJET_A_GAGNER = 'kura-gain-1';
const OBJET_A_FELER = 'kura-base-3';

function sceller(
  closedDays: DayKey[],
  spent: number,
  sealedAt: LocalDateTime,
  installDay: DayKey = INSTALL,
): WeekResult {
  return sealWeek({
    week: SEMAINE,
    installDay,
    sealedAt,
    closedDays,
    expenses: [depense('2026-11-04', spent)],
    budgets: [novembre],
    nextItem: OBJET_A_GAGNER,
    crackTarget: OBJET_A_FELER,
  });
}

describe('clôture et scellement', () => {
  test('le délai de grâce court jusqu’au lundi suivant à 12:00', () => {
    expect(sealDeadline(SEMAINE)).toEqual(at('2026-11-09', '12:00'));
  });

  test(
    'scénario 1 : semaine 45 avec 7 clôtures et 120 € dépensés, scellée à la clôture du dimanche 8 ; ' +
      'le 1er objet à gagner de la pièce de novembre sort de sa capsule, rien ne se fêle',
    () => {
      const avantDimanche = JOURS_45.slice(0, 6);
      expect(sealingTrigger(SEMAINE, INSTALL, avantDimanche, at('2026-11-07', '21:00'))).toBeNull();
      expect(sealingTrigger(SEMAINE, INSTALL, JOURS_45, at('2026-11-08', '21:00'))).toBe(
        'all_closed',
      );

      const resultat = sceller(JOURS_45, 120, at('2026-11-08', '21:00'));
      expect(resultat).toMatchObject({
        week: SEMAINE,
        sealedAt: at('2026-11-08', '21:00'),
        countedDays: 7,
        stamps: 7,
        envelope: euros(140),
        spent: euros(120),
        inBudget: true,
        complete: true,
        gashaponItem: OBJET_A_GAGNER,
        crackedItem: null,
      });
    },
  );

  test('7 tampons et hors budget : la capsule tombe et l’objet désigné se fêle (scénario 2)', () => {
    const resultat = sceller(JOURS_45, 150, at('2026-11-08', '21:00'));
    expect(resultat).toMatchObject({
      inBudget: false,
      complete: true,
      gashaponItem: OBJET_A_GAGNER,
      crackedItem: OBJET_A_FELER,
    });
  });

  test('hors budget sans aucun objet à fêler : rien ne se fêle (scénario 13)', () => {
    const resultat = sealWeek({
      week: SEMAINE,
      installDay: INSTALL,
      sealedAt: at('2026-11-08', '21:00'),
      closedDays: JOURS_45,
      expenses: [depense('2026-11-04', 150)],
      budgets: [novembre],
      nextItem: OBJET_A_GAGNER,
      crackTarget: null,
    });
    expect(resultat.crackedItem).toBeNull();
    expect(resultat.gashaponItem).toBe(OBJET_A_GAGNER);
  });

  test(
    'scénario 3 : semaine 45, mercredi 4 jamais clôturé, 100 € dépensés ; scellée le lundi 9 à 12:00 ' +
      'avec 6 tampons, pas de capsule, la poussière reste au moins au niveau 1 jusqu’à la prochaine ' +
      'semaine complète',
    () => {
      const fermes = sans(JOURS_45, '2026-11-04');
      expect(sealingTrigger(SEMAINE, INSTALL, fermes, at('2026-11-09', '11:59'))).toBeNull();
      expect(sealingTrigger(SEMAINE, INSTALL, fermes, at('2026-11-09', '12:00'))).toBe('deadline');

      const resultat = sceller(fermes, 100, sealDeadline(SEMAINE));
      expect(resultat).toMatchObject({
        sealedAt: at('2026-11-09', '12:00'),
        stamps: 6,
        countedDays: 7,
        inBudget: true,
        // Semaine incomplète : c'est ce drapeau que la règle de la poussière (J1.5) lit pour
        // garder au moins le niveau 1.
        complete: false,
        gashaponItem: null,
        crackedItem: null,
      });
    },
  );

  test('semaine incomplète et hors budget : pas de capsule, mais un objet se fêle (scénario 4)', () => {
    const resultat = sceller(sans(JOURS_45, '2026-11-04'), 150, sealDeadline(SEMAINE));
    expect(resultat).toMatchObject({
      complete: false,
      gashaponItem: null,
      crackedItem: OBJET_A_FELER,
    });
  });

  test('une semaine sans tampon ni dépense ne donne rien et ne fêle rien', () => {
    const resultat = sealWeek({
      week: SEMAINE,
      installDay: INSTALL,
      sealedAt: sealDeadline(SEMAINE),
      closedDays: [],
      expenses: [],
      budgets: [novembre],
      nextItem: OBJET_A_GAGNER,
      crackTarget: OBJET_A_FELER,
    });
    expect(resultat).toMatchObject({
      stamps: 0,
      spent: 0,
      complete: false,
      gashaponItem: null,
      crackedItem: null,
    });
  });

  test(
    'scénario 5 : mercredi 4 rattrapé le jeudi 5 à 8:00, les autres jours clôturés le soir ; ' +
      '7 tampons, même résultat que le scénario 1 ou 2 selon le dépensé',
    () => {
      const ctx = {
        installDay: INSTALL,
        closedDays: sans(JOURS_45, '2026-11-04'),
        sealedWeeks: [],
      };
      expect(canCloseDay('2026-11-04', at('2026-11-05', '08:00'), ctx)).toEqual({ ok: true });

      // Le rattrapage ne scelle pas encore : il reste le jeudi 5 au dimanche 8 à clôturer.
      const ouvert = [...JOURS_45.slice(0, 2), '2026-11-04'];
      expect(sealingTrigger(SEMAINE, INSTALL, ouvert, at('2026-11-05', '08:00'))).toBeNull();

      const dansLeBudget = sceller(JOURS_45, 120, at('2026-11-08', '21:00'));
      expect(dansLeBudget).toMatchObject({ stamps: 7, complete: true, crackedItem: null });
      expect(dansLeBudget.gashaponItem).toBe(OBJET_A_GAGNER);

      const horsBudget = sceller(JOURS_45, 150, at('2026-11-08', '21:00'));
      expect(horsBudget).toMatchObject({ stamps: 7, complete: true });
      expect(horsBudget.crackedItem).toBe(OBJET_A_FELER);
    },
  );

  test(
    'scénario 6 : dimanche 8 clôturé le lundi 9 à 10:00, accepté (7 tampons, scellement à cette ' +
      'clôture) ; à 12:01 la même clôture est refusée, semaine déjà scellée à 12:00 avec 6 tampons',
    () => {
      const fermes = JOURS_45.slice(0, 6);
      const ctx = { installDay: INSTALL, closedDays: fermes, sealedWeeks: [] };

      expect(canCloseDay('2026-11-08', at('2026-11-09', '10:00'), ctx)).toEqual({ ok: true });
      expect(sealingTrigger(SEMAINE, INSTALL, JOURS_45, at('2026-11-09', '10:00'))).toBe(
        'all_closed',
      );
      expect(sceller(JOURS_45, 120, at('2026-11-09', '10:00'))).toMatchObject({
        stamps: 7,
        complete: true,
      });

      expect(canCloseDay('2026-11-08', at('2026-11-09', '12:01'), ctx)).toEqual({
        ok: false,
        reason: 'week_sealed',
      });
      expect(sealingTrigger(SEMAINE, INSTALL, fermes, at('2026-11-09', '12:01'))).toBe('deadline');
      expect(sceller(fermes, 120, sealDeadline(SEMAINE))).toMatchObject({
        sealedAt: at('2026-11-09', '12:00'),
        stamps: 6,
        complete: false,
      });
    },
  );

  test(
    'scénario 7 : installation le jeudi 5 novembre, 4 clôtures, 70 € dépensés ; 4 jours décomptés, ' +
      'enveloppe de 80 €, le 1er objet à gagner de novembre sort de sa capsule',
    () => {
      const installation = '2026-11-05';
      const fermes = JOURS_45.slice(3);
      expect(sealingTrigger(SEMAINE, installation, fermes, at('2026-11-08', '21:00'))).toBe(
        'all_closed',
      );
      const resultat = sceller(fermes, 70, at('2026-11-08', '21:00'), installation);
      expect(resultat).toMatchObject({
        countedDays: 4,
        stamps: 4,
        envelope: euros(80),
        spent: euros(70),
        inBudget: true,
        complete: true,
        gashaponItem: OBJET_A_GAGNER,
        crackedItem: null,
      });
    },
  );

  test(
    'scénario 15 : une dépense de la semaine 45 modifiée le mardi 10 ; résultat de la semaine 45 ' +
      'inchangé, le carnet affiche le nouveau montant',
    () => {
      const scellee = sceller(JOURS_45, 120, at('2026-11-08', '21:00'));
      const copie = structuredClone(scellee);

      // Le mardi 10, la dépense passe de 120 € à 200 € : le carnet lit les dépenses…
      const modifiees = [depense('2026-11-04', 200)];
      expect(modifiees[0].amount).toBe(euros(200));

      // … mais la semaine scellée n'est jamais recalculée, et le résultat enregistré reste figé.
      const aSceller = weeksToSeal({
        now: at('2026-11-10', '09:00'),
        installDay: INSTALL,
        closedDays: JOURS_45,
        results: [scellee],
      });
      expect(aSceller).toEqual([]);
      expect(scellee).toEqual(copie);
      expect(scellee.spent).toBe(euros(120));
      expect(scellee.inBudget).toBe(true);
    },
  );

  test(
    'scénario 19 : le lundi 9, clôture du mardi 10 refusée (jour futur) et dépense datée du jeudi ' +
      '29 octobre refusée (jour avant l’installation)',
    () => {
      const ctx = { installDay: INSTALL, closedDays: JOURS_45.slice(0, 6), sealedWeeks: [] };
      const lundi9 = at('2026-11-09', '09:00');

      expect(canCloseDay('2026-11-10', lundi9, ctx)).toEqual({ ok: false, reason: 'future_day' });
      expect(canAddExpense('2026-10-29', lundi9, ctx)).toEqual({
        ok: false,
        reason: 'before_install',
      });
    },
  );

  test('autres refus de clôture : avant l’installation, déjà clôturé, semaine scellée', () => {
    const ctx = { installDay: '2026-11-05', closedDays: ['2026-11-05'], sealedWeeks: [] };
    const jeudi5 = at('2026-11-05', '21:00');
    expect(canCloseDay('2026-11-04', jeudi5, ctx)).toEqual({
      ok: false,
      reason: 'before_install',
    });
    expect(canCloseDay('2026-11-05', jeudi5, ctx)).toEqual({
      ok: false,
      reason: 'already_closed',
    });
    // Une semaine enregistrée comme scellée refuse, même avant son délai de 12:00.
    expect(
      canCloseDay('2026-11-06', at('2026-11-08', '21:00'), { ...ctx, sealedWeeks: [SEMAINE] }),
    ).toEqual({ ok: false, reason: 'week_sealed' });
    // Le jour d'installation et le jour même sont acceptés.
    expect(canCloseDay('2026-11-06', at('2026-11-06', '21:00'), ctx)).toEqual({ ok: true });
  });

  test('une dépense est acceptée un jour décompté d’une semaine ouverte, refusée sinon', () => {
    const ctx = { installDay: INSTALL, closedDays: [], sealedWeeks: [] };
    expect(canAddExpense('2026-11-04', at('2026-11-09', '11:59'), ctx)).toEqual({ ok: true });
    expect(canAddExpense('2026-11-04', at('2026-11-09', '12:00'), ctx)).toEqual({
      ok: false,
      reason: 'week_sealed',
    });
    expect(canAddExpense('2026-11-10', at('2026-11-09', '09:00'), ctx)).toEqual({
      ok: false,
      reason: 'future_day',
    });
  });

  test('semaines à sceller : les échues, de la plus ancienne à la plus récente', () => {
    const aSceller = weeksToSeal({
      now: at('2026-11-30', '13:00'),
      installDay: INSTALL,
      closedDays: [],
      results: [],
    });
    expect(aSceller.map((s) => s.week)).toEqual(['2026-W45', '2026-W46', '2026-W47', '2026-W48']);
    expect(aSceller.every((s) => s.trigger === 'deadline')).toBe(true);
    expect(aSceller[0].sealedAt).toEqual(at('2026-11-09', '12:00'));
  });
});
