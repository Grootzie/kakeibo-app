// Bienvenue (E1, #101) : quand elle s'affiche, l'aperçu du budget de l'étape « Mon mois » et
// l'heure du rappel de l'étape « Mon rappel du soir ». Fonctions pures.
import { createAppState } from '../domain/traitement';
import catalogueJson from '../content/catalogue.json';
import type { Catalog } from '../domain/objets';
import { apercuBudget, bienvenueAFaire, decalerHeure, heureValide } from './bienvenue';

const catalogue = catalogueJson as Catalog;
const euros = (n: number): number => Math.round(n * 100);
const at = { day: '2026-11-02', time: '08:00' };

describe('bienvenueAFaire', () => {
  test('vraie tant qu’aucune version du budget n’existe', () => {
    const etat = createAppState({ installDay: '2026-11-02', at, budgets: [] }, catalogue);
    expect(bienvenueAFaire(etat)).toBe(true);
  });

  test('fausse dès la première version du budget : E1 ne revient plus', () => {
    const etat = createAppState(
      {
        installDay: '2026-11-02',
        at,
        budgets: [
          {
            id: 'b1',
            month: '2026-11',
            income: euros(2000),
            fixedCosts: euros(1100),
            savingsGoal: euros(300),
            effectiveFrom: '2026-11-02',
          },
        ],
      },
      catalogue,
    );
    expect(bienvenueAFaire(etat)).toBe(false);
  });

  test('fausse tant que l’état n’est pas chargé : rien ne s’affiche trop tôt', () => {
    expect(bienvenueAFaire(null)).toBe(false);
  });
});

describe('apercuBudget (étape « Mon mois »)', () => {
  const contexte = { income: euros(2000), fixedCosts: euros(1100), savingsGoal: euros(300) };

  test('budget du mois et enveloppe d’une semaine entière de novembre (contexte des scénarios)', () => {
    expect(apercuBudget(contexte, '2026-11-02', '2026-11-02')).toEqual({
      budgetMois: euros(600),
      enveloppeSemaine: euros(140),
      peutContinuer: true,
    });
  });

  test('installation un mercredi : l’enveloppe ne compte que les jours décomptés (scénario 7)', () => {
    expect(apercuBudget(contexte, '2026-11-04', '2026-11-04').enveloppeSemaine).toBe(euros(100));
    expect(apercuBudget(contexte, '2026-11-05', '2026-11-05').enveloppeSemaine).toBe(euros(80));
  });

  test('semaine à cheval sur deux mois : la version du mois d’installation est reconduite (scénario 24)', () => {
    expect(apercuBudget(contexte, '2026-11-30', '2026-11-30').enveloppeSemaine).toBe(13613);
  });

  test('on ne continue que si le budget du mois est supérieur à zéro', () => {
    const nul = { income: euros(1000), fixedCosts: euros(700), savingsGoal: euros(300) };
    expect(apercuBudget(nul, '2026-11-02', '2026-11-02')).toEqual({
      budgetMois: 0,
      enveloppeSemaine: null,
      peutContinuer: false,
    });
    const negatif = { income: euros(1000), fixedCosts: euros(1200), savingsGoal: 0 };
    expect(apercuBudget(negatif, '2026-11-02', '2026-11-02')).toEqual({
      budgetMois: euros(-200),
      enveloppeSemaine: null,
      peutContinuer: false,
    });
  });

  test('un champ vide ou illisible empêche de continuer, sans budget affiché', () => {
    expect(apercuBudget({ ...contexte, income: null }, '2026-11-02', '2026-11-02')).toEqual({
      budgetMois: null,
      enveloppeSemaine: null,
      peutContinuer: false,
    });
  });

  test('sans charges fixes ni épargne, le budget vaut les revenus', () => {
    const seul = { income: euros(900), fixedCosts: 0, savingsGoal: 0 };
    expect(apercuBudget(seul, '2026-11-02', '2026-11-02').budgetMois).toBe(euros(900));
    expect(apercuBudget(seul, '2026-11-02', '2026-11-02').enveloppeSemaine).toBe(euros(210));
  });
});

describe('heure du rappel (étape « Mon rappel du soir »)', () => {
  test('avance et recule par quarts d’heure', () => {
    expect(decalerHeure('21:00', 15)).toBe('21:15');
    expect(decalerHeure('21:00', -15)).toBe('20:45');
    expect(decalerHeure('09:50', 15)).toBe('10:05');
  });

  test('fait le tour du cadran sans sortir de la journée', () => {
    expect(decalerHeure('23:45', 15)).toBe('00:00');
    expect(decalerHeure('00:00', -15)).toBe('23:45');
  });

  test('reconnaît une heure HH:MM valide', () => {
    expect(heureValide('21:00')).toBe(true);
    expect(heureValide('07:05')).toBe(true);
    expect(heureValide('24:00')).toBe(false);
    expect(heureValide('21:60')).toBe(false);
    expect(heureValide('9:00')).toBe(false);
    expect(heureValide('')).toBe(false);
  });
});
