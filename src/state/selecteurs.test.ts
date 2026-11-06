// Sélecteurs de l'accueil (E2) : enveloppe et dépensé de la semaine, 7 cases, jour à rattraper.
import catalogueJson from '../content/catalogue.json';
import type { BudgetVersion } from '../domain/budget';
import type { Catalog } from '../domain/objets';
import type { DayKey, LocalDateTime } from '../domain/scellement';
import { type AppEvent, type AppState, createAppState, process } from '../domain/traitement';
import {
  casesSemaine,
  enveloppeSemaine,
  joursDepense,
  jourARattraper,
  vueAccueil,
} from './selecteurs';

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
const fermer = (day: DayKey, t = at(day)): [AppEvent, LocalDateTime] => [
  { type: 'close_day', day },
  t,
];
const depenser = (day: DayKey, amount: number): [AppEvent, LocalDateTime] => [
  { type: 'save_expense', expense: { id: `e-${day}-${amount}`, day, amount } },
  at(day, '12:00'),
];

describe('enveloppe de la semaine', () => {
  it('donne l’enveloppe, le dépensé et le reste de la semaine en cours', () => {
    const s = etat('2026-11-02', [depenser('2026-11-03', 5000), depenser('2026-11-04', 2700)]);
    expect(enveloppeSemaine(s, at('2026-11-04', '18:00'))).toEqual({
      semaine: '2026-W45',
      enveloppe: 14000,
      depense: 7700,
      reste: 6300,
      dansLeBudget: true,
    });
  });

  it('a un reste négatif en cas de dépassement', () => {
    const s = etat('2026-11-02', [depenser('2026-11-03', 15200)]);
    expect(enveloppeSemaine(s, at('2026-11-05'))).toMatchObject({
      reste: -1200,
      dansLeBudget: false,
    });
  });

  it('ne compte que les jours décomptés la semaine de l’installation (scénario 7)', () => {
    const s = etat('2026-11-05', []);
    expect(enveloppeSemaine(s, at('2026-11-05'))).toMatchObject({ enveloppe: 8000, depense: 0 });
  });
});

describe('cases de tampons', () => {
  it('donnent les 7 jours du lundi au dimanche avec leur statut', () => {
    const s = etat('2026-11-03', [fermer('2026-11-03'), fermer('2026-11-05')]);
    expect(casesSemaine(s, at('2026-11-06', '09:00'))).toEqual([
      { jour: '2026-11-02', statut: 'hors_decompte' },
      { jour: '2026-11-03', statut: 'cloturee' },
      { jour: '2026-11-04', statut: 'rattrapable' },
      { jour: '2026-11-05', statut: 'cloturee' },
      { jour: '2026-11-06', statut: 'a_cloturer' },
      { jour: '2026-11-07', statut: 'a_venir' },
      { jour: '2026-11-08', statut: 'a_venir' },
    ]);
  });

  it('montrent aujourd’hui clôturé une fois la journée clôturée', () => {
    const s = etat('2026-11-02', [fermer('2026-11-02')]);
    expect(casesSemaine(s, at('2026-11-02', '22:00'))[0]).toEqual({
      jour: '2026-11-02',
      statut: 'cloturee',
    });
  });
});

describe('jour à rattraper', () => {
  it('est le plus ancien jour passé non clôturé d’une semaine ouverte', () => {
    const s = etat('2026-11-02', [fermer('2026-11-02'), fermer('2026-11-05')]);
    expect(jourARattraper(s, at('2026-11-06', '09:00'))).toBe('2026-11-03');
  });

  it('inclut la semaine précédente jusqu’au lundi 12:00', () => {
    const jours = [
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
    ];
    const s = etat(
      '2026-11-02',
      jours.map((j) => fermer(j)),
    );
    expect(jourARattraper(s, at('2026-11-09', '10:00'))).toBe('2026-11-08');
    const apres = process(s, { type: 'open' }, at('2026-11-09', '12:01'), catalog).state;
    expect(jourARattraper(apres, at('2026-11-09', '12:01'))).toBeNull();
  });

  it('ignore aujourd’hui et les jours avant l’installation', () => {
    const s = etat('2026-11-04', []);
    expect(jourARattraper(s, at('2026-11-04'))).toBeNull();
    expect(jourARattraper(s, at('2026-11-05'))).toBe('2026-11-04');
  });

  it('n’existe pas quand tout est clôturé', () => {
    const s = etat('2026-11-02', [fermer('2026-11-02'), fermer('2026-11-03')]);
    expect(jourARattraper(s, at('2026-11-04', '08:00'))).toBeNull();
  });
});

describe('vue de l’accueil (E2, #43)', () => {
  it('rassemble le jour, l’enveloppe, les 7 cases et le bandeau', () => {
    const s = etat('2026-11-02', [fermer('2026-11-02'), depenser('2026-11-03', 5000)]);
    const vue = vueAccueil(s, at('2026-11-04', '18:00'));
    expect(vue.jour).toBe('2026-11-04');
    expect(vue.enveloppe).toEqual(enveloppeSemaine(s, at('2026-11-04', '18:00')));
    expect(vue.cases).toHaveLength(7);
    expect(vue.aujourdhuiCloture).toBe(false);
    expect(vue.bandeau).toEqual({ type: 'jour_a_rattraper', jour: '2026-11-03' });
  });

  it('marque la journée clôturée une fois aujourd’hui clôturé', () => {
    const s = etat('2026-11-02', [fermer('2026-11-02')]);
    expect(vueAccueil(s, at('2026-11-02', '22:00')).aujourdhuiCloture).toBe(true);
  });

  it('n’a aucun bandeau sans jour à rattraper', () => {
    const s = etat('2026-11-02', [fermer('2026-11-02')]);
    expect(vueAccueil(s, at('2026-11-03', '09:00')).bandeau).toBeNull();
  });
});

describe('jours proposés pour noter une dépense (E3)', () => {
  it('les jours des semaines ouvertes jusqu’à aujourd’hui, clôturés compris, du plus récent au plus ancien', () => {
    const s = etat('2026-11-04', [fermer('2026-11-04'), fermer('2026-11-05')]);
    expect(joursDepense(s, at('2026-11-06', '10:00'))).toEqual([
      '2026-11-06',
      '2026-11-05',
      '2026-11-04',
    ]);
  });

  it('sans la semaine précédente une fois le lundi 12:00 passé', () => {
    const s = etat('2026-11-04', []);
    expect(joursDepense(s, at('2026-11-09', '11:00'))[0]).toBe('2026-11-09');
    expect(joursDepense(s, at('2026-11-09', '11:00'))).toHaveLength(6);
    expect(joursDepense(s, at('2026-11-09', '12:00'))).toEqual(['2026-11-09']);
  });
});
