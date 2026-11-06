// Ordre de traitement : enchaînement des règles et retour après une longue absence (J1.8).
// Contexte commun : installation le lundi 2 novembre 2026, budget de 600 € par mois (2 000 € de
// revenus, 1 100 € de charges fixes, 300 € d'épargne visée), chaque jour clôturé le soir même.
import catalogueJson from '../content/catalogue.json';
import { type BudgetVersion } from './budget';
import { addDays } from './calendrier';
import { type Catalog } from './objets';
import { type DayKey, type LocalDateTime } from './scellement';
import {
  type AppEvent,
  type AppState,
  type ProcessResult,
  createAppState,
  process,
  weekReviewScreen,
} from './traitement';

const catalog: Catalog = catalogueJson as Catalog;
const INSTALL = '2026-11-02';
const euros = (n: number): number => Math.round(n * 100);
const at = (day: DayKey, time = '21:00'): LocalDateTime => ({ day, time });

const novembre: BudgetVersion = {
  id: 'b-nov',
  month: '2026-11',
  income: euros(2000),
  fixedCosts: euros(1100),
  savingsGoal: euros(300),
  effectiveFrom: INSTALL,
};

const baseNovembre = catalog.items.filter((i) => i.room === 'room-11' && i.source === 'base');
const gainsNovembre = catalog.items.filter((i) => i.room === 'room-11' && i.source === 'weekly');
const gainsDecembre = catalog.items.filter((i) => i.room === 'room-12' && i.source === 'weekly');
const baseJanvier = catalog.items.filter((i) => i.room === 'room-01' && i.source === 'base');

const depart = (): AppState =>
  createAppState({ installDay: INSTALL, at: at(INSTALL, '08:00'), budgets: [novembre] }, catalog);

/** Applique un événement et exige qu'il soit accepté. */
function ok(state: AppState, event: AppEvent, now: LocalDateTime): AppState {
  const r: ProcessResult = process(state, event, now, catalog);
  expect(r.refusal).toBeNull();
  return r.state;
}

const fermer = (state: AppState, day: DayKey, now: LocalDateTime = at(day)): AppState =>
  ok(state, { type: 'close_day', day }, now);

const depenser = (state: AppState, day: DayKey, montant: number, id = `e-${day}`): AppState =>
  ok(
    state,
    { type: 'save_expense', expense: { id, day, amount: euros(montant) } },
    at(day, '12:00'),
  );

/** Clôture chaque jour de `debut` à `fin`, le soir même. */
function fermerDu(state: AppState, debut: DayKey, fin: DayKey): AppState {
  let s = state;
  for (let j = debut; j <= fin; j = addDays(j, 1)) s = fermer(s, j);
  return s;
}

const resultat = (state: AppState, week: string) => state.results.find((r) => r.week === week);
const objet = (state: AppState, year: number, itemId: string) =>
  state.house.owned.find((o) => o.year === year && o.itemId === itemId);

describe('ordre de traitement', () => {
  test('scénario 14 : aucune ouverture entre le lundi 9 novembre et le mardi 1er décembre au matin ; semaines 46 à 48 scellées sans capsule ni fêlure, un seul écran récapitulatif, poussière niveau 2, bilan de novembre proposé, le lundi 30 novembre reste rattrapable', () => {
    let s = depenser(depart(), '2026-11-04', 120);
    s = fermerDu(s, '2026-11-02', '2026-11-08');
    s = ok(s, { type: 'open' }, at('2026-11-09', '09:00'));
    expect(weekReviewScreen(s)).toEqual({ kind: 'week', week: '2026-W45' });
    s = ok(s, { type: 'week_reviews_seen' }, at('2026-11-09', '09:01'));

    s = ok(s, { type: 'open' }, at('2026-12-01', '08:00'));

    for (const w of ['2026-W46', '2026-W47', '2026-W48']) {
      expect(resultat(s, w)).toMatchObject({
        stamps: 0,
        complete: false,
        gashaponItem: null,
        crackedItem: null,
      });
    }
    // Scellées à leur délai, de la plus ancienne à la plus récente.
    expect(s.results.map((r) => [r.week, r.sealedAt])).toEqual([
      ['2026-W45', at('2026-11-08')],
      ['2026-W46', at('2026-11-16', '12:00')],
      ['2026-W47', at('2026-11-23', '12:00')],
      ['2026-W48', at('2026-11-30', '12:00')],
    ]);
    expect(weekReviewScreen(s)).toEqual({
      kind: 'recap',
      weeks: ['2026-W46', '2026-W47', '2026-W48'],
    });
    expect(s.house.owned.every((o) => o.state === 'intact')).toBe(true);
    expect(s.dust).toBe(2);
    expect(s.monthToReview).toBe('2026-11');

    // La semaine 49 est ouverte : le lundi 30 novembre se rattrape.
    expect(resultat(s, '2026-W49')).toBeUndefined();
    s = fermer(s, '2026-11-30', at('2026-12-01', '08:05'));
    expect(s.closedDays).toContain('2026-11-30');
  });

  test('par process, scénario 15 rejoué : une dépense de la semaine 45 modifiée le mardi 10 ne change pas son résultat', () => {
    let s = depenser(depart(), '2026-11-04', 120);
    s = fermerDu(s, '2026-11-02', '2026-11-08');
    const fige = structuredClone(resultat(s, '2026-W45'));
    expect(fige).toMatchObject({ spent: euros(120), inBudget: true });

    s = ok(
      s,
      {
        type: 'save_expense',
        expense: { id: 'e-2026-11-04', day: '2026-11-04', amount: euros(200) },
      },
      at('2026-11-10', '09:00'),
    );
    expect(resultat(s, '2026-W45')).toEqual(fige);
    expect(s.expenses).toEqual([{ id: 'e-2026-11-04', day: '2026-11-04', amount: euros(200) }]);
    // Pas de fêlure à retardement.
    expect(s.house.owned.every((o) => o.state === 'intact')).toBe(true);
  });

  test('une nouvelle dépense dans une semaine scellée ou dans le futur est refusée', () => {
    let s = fermerDu(depart(), '2026-11-02', '2026-11-08');
    const scellee = process(
      s,
      { type: 'save_expense', expense: { id: 'n', day: '2026-11-05', amount: 100 } },
      at('2026-11-10', '09:00'),
      catalog,
    );
    expect(scellee.refusal).toBe('week_sealed');
    expect(scellee.state.expenses).toEqual([]);

    const future = process(
      s,
      { type: 'save_expense', expense: { id: 'n', day: '2026-11-11', amount: 100 } },
      at('2026-11-10', '09:00'),
      catalog,
    );
    expect(future.refusal).toBe('future_day');
    s = future.state;
    expect(s.expenses).toEqual([]);
  });

  test('par process, scénario 1 : scellée à la clôture du dimanche 8, la capsule du 1er objet à gagner, rien ne se fêle', () => {
    let s = depenser(depart(), '2026-11-04', 120);
    s = fermerDu(s, '2026-11-02', '2026-11-07');
    expect(resultat(s, '2026-W45')).toBeUndefined();
    s = fermer(s, '2026-11-08');
    expect(resultat(s, '2026-W45')).toMatchObject({
      sealedAt: at('2026-11-08'),
      stamps: 7,
      gashaponItem: gainsNovembre[0].id,
      crackedItem: null,
    });
    expect(objet(s, 2026, gainsNovembre[0].id)).toMatchObject({
      state: 'intact',
      week: '2026-W45',
    });
  });

  test('par process, scénario 2 : avec 150 € dépensés, le 3e objet de base de novembre se fêle', () => {
    let s = depenser(depart(), '2026-11-04', 150);
    s = fermerDu(s, '2026-11-02', '2026-11-08');
    expect(resultat(s, '2026-W45')).toMatchObject({
      gashaponItem: gainsNovembre[0].id,
      crackedItem: baseNovembre[2].id,
    });
    expect(objet(s, 2026, baseNovembre[2].id)?.state).toBe('cracked');
    expect(s.repairs).toEqual([
      expect.objectContaining({ itemId: baseNovembre[2].id, startDay: '2026-11-09', progress: 0 }),
    ]);
  });

  test(
    'par process, scénario 6 : le dimanche 8 clôturé le lundi 9 à 10:00 est accepté et scelle la semaine ; ' +
      'à 12:01, la semaine est d’abord scellée à 12:00 avec 6 tampons, puis la clôture est refusée',
    () => {
      const avant = fermerDu(depart(), '2026-11-02', '2026-11-07');

      const accepte = fermer(avant, '2026-11-08', at('2026-11-09', '10:00'));
      expect(resultat(accepte, '2026-W45')).toMatchObject({
        sealedAt: at('2026-11-09', '10:00'),
        stamps: 7,
        gashaponItem: gainsNovembre[0].id,
      });

      const r = process(
        avant,
        { type: 'close_day', day: '2026-11-08' },
        at('2026-11-09', '12:01'),
        catalog,
      );
      expect(r.refusal).toBe('week_sealed');
      expect(r.state.closedDays).not.toContain('2026-11-08');
      expect(resultat(r.state, '2026-W45')).toMatchObject({
        sealedAt: at('2026-11-09', '12:00'),
        stamps: 6,
        gashaponItem: null,
      });
      expect(weekReviewScreen(r.state)).toEqual({ kind: 'week', week: '2026-W45' });
    },
  );

  test(
    'par process, scénario 12 : A fêlé en semaine 45, B en semaine 46 ; A réparé à la clôture du ' +
      'dimanche 15, avant le scellement de la semaine 46, B réparé le dimanche 22',
    () => {
      let s = depenser(depart(), '2026-11-04', 150);
      s = fermerDu(s, '2026-11-02', '2026-11-08');
      const A = resultat(s, '2026-W45')?.crackedItem;
      expect(A).toBe(baseNovembre[2].id);

      s = depenser(s, '2026-11-11', 150);
      s = fermerDu(s, '2026-11-09', '2026-11-15');
      // Les réparations (étape 3) passent avant le scellement (étape 4) : A est déjà réparé
      // quand la semaine 46 choisit l'objet qui se fêle.
      expect(objet(s, 2026, A as string)?.state).toBe('repaired');
      const B = resultat(s, '2026-W46')?.crackedItem;
      expect(B).toBe(gainsNovembre[0].id);
      expect(objet(s, 2026, B as string)?.state).toBe('cracked');

      s = fermerDu(s, '2026-11-16', '2026-11-21');
      expect(objet(s, 2026, B as string)?.state).toBe('cracked');
      expect(s.repairs[1]).toMatchObject({ itemId: B, startDay: '2026-11-16', progress: 6 });
      s = fermer(s, '2026-11-22');
      expect(objet(s, 2026, B as string)?.state).toBe('repaired');
      expect(s.repairs[1]).toMatchObject({ repairedOn: '2026-11-22', progress: 7 });
    },
  );

  test(
    'par process, scénarios 17 et 18 : l’objet de la semaine 49 attend sa pièce, puis y entre à la ' +
      'validation du bilan de novembre',
    () => {
      let s = fermerDu(depart(), '2026-11-02', '2026-12-06');
      const w49 = resultat(s, '2026-W49');
      expect(w49?.gashaponItem).toBe(gainsDecembre[0].id);
      expect(objet(s, 2026, gainsDecembre[0].id)).toMatchObject({
        room: 'room-12',
        placedAt: null,
      });
      expect(s.monthToReview).toBe('2026-11');

      const tropLong = process(
        s,
        { type: 'validate_month', month: '2026-11', resolution: 'x'.repeat(141) },
        at('2026-12-07', '09:00'),
        catalog,
      );
      expect(tropLong.refusal).toBe('resolution_too_long');

      const autreMois = process(
        s,
        { type: 'validate_month', month: '2026-10', resolution: '' },
        at('2026-12-07', '09:00'),
        catalog,
      );
      expect(autreMois.refusal).toBe('month_not_proposed');

      s = ok(
        s,
        { type: 'validate_month', month: '2026-11', resolution: 'Cuisiner plus' },
        at('2026-12-07', '09:00'),
      );
      expect(s.reviews).toEqual([
        { month: '2026-11', resolution: 'Cuisiner plus', validatedAt: '2026-12-07T09:00' },
      ]);
      expect(s.house.unlocked.some((u) => u.year === 2026 && u.room === 'room-12')).toBe(true);
      expect(objet(s, 2026, gainsDecembre[0].id)?.placedAt).toBe('2026-12-07T09:00');
      expect(s.monthToReview).toBeNull();
    },
  );

  test(
    'par process, scénario 21 : semaine 53 complète, dimanche 3 janvier rattrapé le lundi 4 à 10:00 ; ' +
      'la maison 2027 a démarré le lundi 4 à 00:00 et l’objet de la semaine 53 entre dans l’album',
    () => {
      let s = fermerDu(depart(), '2026-11-02', '2026-11-30');
      s = ok(
        s,
        { type: 'validate_month', month: '2026-11', resolution: '' },
        at('2026-12-01', '08:00'),
      );
      s = fermerDu(s, '2026-12-01', '2027-01-02');
      expect(resultat(s, '2026-W53')).toBeUndefined();

      s = fermer(s, '2027-01-03', at('2027-01-04', '10:00'));
      const w53 = resultat(s, '2026-W53');
      expect(w53).toMatchObject({ stamps: 7, sealedAt: at('2027-01-04', '10:00') });
      const gagne = objet(s, 2026, w53?.gashaponItem as string);
      expect(gagne).toMatchObject({ room: 'room-12', week: '2026-W53' });
      expect(gagne?.placedAt).not.toBeNull();

      expect(s.house.unlocked.filter((u) => u.year === 2027)).toEqual([
        { year: 2027, room: 'room-01', unlockedAt: '2027-01-04T00:00' },
      ]);
      expect(s.house.owned.filter((o) => o.year === 2027).map((o) => o.itemId)).toEqual(
        baseJanvier.map((i) => i.id),
      );
      expect(s.repairs).toEqual([]);
    },
  );

  test('la file de réparation repart à zéro avec la nouvelle année : un objet fêlé en 2026 reste fêlé dans l’album', () => {
    let s = fermerDu(depart(), '2026-11-02', '2026-11-30');
    s = ok(
      s,
      { type: 'validate_month', month: '2026-11', resolution: '' },
      at('2026-12-01', '08:00'),
    );
    s = fermerDu(s, '2026-12-01', '2026-12-29');
    s = depenser(s, '2026-12-30', 500);
    s = fermerDu(s, '2026-12-30', '2027-01-10');
    const fele = resultat(s, '2026-W53')?.crackedItem as string;
    expect(fele).not.toBeNull();
    // Sept jours clôturés après la semaine fautive (4 au 10 janvier), mais en 2027.
    expect(objet(s, 2026, fele)?.state).toBe('cracked');
    expect(s.repairs).toEqual([]);
  });

  test('une fêlure de 2027 touche l’objet de 2027, jamais celui de l’album 2026 qui a le même identifiant', () => {
    let s = depart();
    for (let j = INSTALL; j <= '2027-11-07'; j = addDays(j, 1)) {
      if (j.endsWith('-01') && j !== INSTALL) {
        s = ok(s, { type: 'open' }, at(j, '08:00'));
        const mois = s.monthToReview;
        if (mois !== null) {
          s = ok(s, { type: 'validate_month', month: mois, resolution: '' }, at(j, '08:00'));
        }
      }
      if (j === '2027-11-03') s = depenser(s, j, 500);
      s = fermer(s, j);
    }
    // Semaine 2027-W44 (1er au 7 novembre 2027, jeudi 4) : complète et hors budget.
    const w44 = resultat(s, '2027-W44');
    expect(w44?.gashaponItem).toBe(gainsNovembre[0].id);
    expect(w44?.crackedItem).toBe(baseNovembre[2].id);
    expect(objet(s, 2027, baseNovembre[2].id)?.state).toBe('cracked');
    expect(objet(s, 2026, baseNovembre[2].id)?.state).toBe('intact');
  });

  test('poussière, bilans et réparations sont recalculés à chaque ouverture', () => {
    let s = fermerDu(depart(), '2026-11-02', '2026-11-04');
    expect(s.dust).toBe(0);
    s = ok(s, { type: 'open' }, at('2026-11-07', '09:00'));
    expect(s.dust).toBe(1);
    s = ok(s, { type: 'open' }, at('2026-11-09', '09:00'));
    expect(s.dust).toBe(2);
    expect(s.monthToReview).toBeNull();
  });

  test('process ne modifie jamais l’état reçu', () => {
    const s = fermerDu(depart(), '2026-11-02', '2026-11-07');
    const copie = structuredClone(s);
    process(s, { type: 'open' }, at('2026-11-20', '09:00'), catalog);
    process(s, { type: 'close_day', day: '2026-11-08' }, at('2026-11-08'), catalog);
    expect(s).toEqual(copie);
  });

  test('à l’installation, la pièce du mois s’ouvre et rien n’est à afficher', () => {
    const s = depart();
    expect(s.house.unlocked).toEqual([
      { year: 2026, room: 'room-11', unlockedAt: '2026-11-02T08:00' },
    ]);
    expect(weekReviewScreen(s)).toBeNull();
    expect(s.results).toEqual([]);
    expect(s.dust).toBe(0);
  });
});
