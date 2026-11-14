// Cartes de première fois de J2 (#48) : à quel moment chacune s'affiche, et lecture de
// settings.seen_explanations.
import catalogueJson from '../content/catalogue.json';
import type { Catalog } from '../domain/objets';
import type { LocalDateTime } from '../domain/scellement';
import { type AppState, createAppState } from '../domain/traitement';
import {
  EXPLICATIONS_J2,
  EXPLICATIONS_J3,
  explicationAAfficher,
  lireExplicationsVues,
  ecrireExplicationsVues,
} from './explications';

const catalogue = catalogueJson as Catalog;
const at = (day: string, time = '12:00'): LocalDateTime => ({ day, time });

/** Installation le lundi 2 novembre 2026. */
function etat(modif: Partial<AppState> = {}): AppState {
  return {
    ...createAppState({ installDay: '2026-11-02', at: at('2026-11-02'), budgets: [] }, catalogue),
    ...modif,
  };
}

describe('moment de chaque carte', () => {
  test('rien à la première ouverture : ni dépense, ni tampon, ni jour à rattraper', () => {
    expect(explicationAAfficher(etat(), at('2026-11-02'), [])).toBeNull();
  });

  test('« Première dépense » dès qu’une dépense est notée', () => {
    const e = etat({ expenses: [{ id: 'd1', day: '2026-11-02', amount: 500 }] });
    expect(explicationAAfficher(e, at('2026-11-02'), [])).toBe('first_expense');
  });

  test('« Premier tampon » dès qu’un jour est clôturé', () => {
    const e = etat({ closedDays: ['2026-11-02'] });
    expect(explicationAAfficher(e, at('2026-11-02', '21:00'), [])).toBe('first_stamp');
  });

  test('« Premier jour à rattraper » dès qu’un jour passé peut être rattrapé', () => {
    expect(explicationAAfficher(etat(), at('2026-11-03'), [])).toBe('first_catch_up');
  });

  test('plus jamais une carte déjà vue', () => {
    const e = etat({
      expenses: [{ id: 'd1', day: '2026-11-03', amount: 500 }],
      closedDays: ['2026-11-03'],
    });
    const now = at('2026-11-04');
    expect(explicationAAfficher(e, now, [])).toBe('first_expense');
    expect(explicationAAfficher(e, now, ['first_expense'])).toBe('first_stamp');
    expect(explicationAAfficher(e, now, ['first_expense', 'first_stamp'])).toBe('first_catch_up');
    expect(explicationAAfficher(e, now, [...EXPLICATIONS_J2])).toBeNull();
  });

  test('un écran peut ne proposer que certaines cartes', () => {
    const e = etat({ closedDays: ['2026-11-02'] });
    expect(explicationAAfficher(e, at('2026-11-03'), [], ['first_expense'])).toBeNull();
    const avecDepense = { ...e, expenses: [{ id: 'd1', day: '2026-11-03', amount: 500 }] };
    expect(explicationAAfficher(avecDepense, at('2026-11-03'), [], ['first_expense'])).toBe(
      'first_expense',
    );
  });

  test('un jour d’une semaine scellée n’est plus à rattraper : pas de carte', () => {
    // Installé le dimanche 8 novembre : rattrapable le lundi 9 à 11:59, plus à 12:00.
    const e = etat({ installDay: '2026-11-08' });
    expect(explicationAAfficher(e, at('2026-11-09', '11:59'), [])).toBe('first_catch_up');
    expect(explicationAAfficher(e, at('2026-11-09', '12:00'), [])).toBeNull();
  });
});

describe('cartes de J3 (#66) : leur moment vient de l’écran', () => {
  const e = etat({
    closedDays: ['2026-11-02'],
    expenses: [{ id: 'd1', day: '2026-11-02', amount: 1 }],
  });
  const now = at('2026-11-09');

  test('six cartes, dans l’ordre où elles passent', () => {
    expect([...EXPLICATIONS_J3]).toEqual([
      'first_capsule',
      'first_dust',
      'first_crack',
      'first_repair',
      'first_month_review',
      'new_room',
    ]);
  });

  test('sans moment donné par l’écran, aucune carte de J3', () => {
    expect(explicationAAfficher(e, now, [], EXPLICATIONS_J3)).toBeNull();
    expect(explicationAAfficher(e, now, [], EXPLICATIONS_J3, { first_dust: false })).toBeNull();
  });

  test('l’écran dit quel moment est venu ; la première de la liste passe d’abord', () => {
    expect(explicationAAfficher(e, now, [], EXPLICATIONS_J3, { first_crack: true })).toBe(
      'first_crack',
    );
    const deux = { first_crack: true, first_capsule: true };
    expect(explicationAAfficher(e, now, [], EXPLICATIONS_J3, deux)).toBe('first_capsule');
    expect(explicationAAfficher(e, now, ['first_capsule'], EXPLICATIONS_J3, deux)).toBe(
      'first_crack',
    );
    expect(
      explicationAAfficher(e, now, ['first_capsule', 'first_crack'], EXPLICATIONS_J3, deux),
    ).toBeNull();
  });

  test('l’accueil ne propose que les cartes de J2', () => {
    expect(explicationAAfficher(e, now, [], undefined, { first_repair: true })).toBe(
      'first_expense',
    );
    expect(
      explicationAAfficher(e, now, [...EXPLICATIONS_J2], undefined, { first_repair: true }),
    ).toBeNull();
  });
});

describe('seen_explanations', () => {
  test('se lit et s’écrit en JSON', () => {
    expect(lireExplicationsVues('[]')).toEqual([]);
    expect(lireExplicationsVues('["first_stamp"]')).toEqual(['first_stamp']);
    expect(ecrireExplicationsVues(['first_stamp', 'first_expense'])).toBe(
      '["first_stamp","first_expense"]',
    );
  });

  test('une valeur illisible compte comme vide, sans planter', () => {
    expect(lireExplicationsVues('pas du json')).toEqual([]);
    expect(lireExplicationsVues('{"a":1}')).toEqual([]);
    expect(lireExplicationsVues('[1,"first_stamp",null]')).toEqual(['first_stamp']);
  });
});
