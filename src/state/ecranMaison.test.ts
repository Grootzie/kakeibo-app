// La maison (E8, J4.6, #85) : pièces débloquées de l'année, objets à leur place avec leur état et
// leur réparation, emplacements libres, objets qui attendent leur pièce.
import catalogueJson from '../content/catalogue.json';
import type { BudgetVersion } from '../domain/budget';
import { addDays } from '../domain/calendrier';
import type { Catalog } from '../domain/objets';
import type { DayKey, LocalDateTime } from '../domain/scellement';
import { type AppEvent, type AppState, createAppState, process } from '../domain/traitement';
import { vueEcranMaison } from './ecranMaison';

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

function etat(evenements: [AppEvent, LocalDateTime][]): AppState {
  let s = createAppState(
    { installDay: '2026-11-02', at: at('2026-11-02', '08:00'), budgets: [novembre] },
    catalog,
  );
  for (const [e, t] of evenements) s = process(s, e, t, catalog).state;
  return s;
}
const fermerDu = (debut: DayKey, fin: DayKey, sauf: DayKey[] = []): [AppEvent, LocalDateTime][] => {
  const out: [AppEvent, LocalDateTime][] = [];
  for (let j = debut; j <= fin; j = addDays(j, 1))
    if (!sauf.includes(j)) out.push([{ type: 'close_day', day: j }, at(j)]);
  return out;
};
const depenser = (day: DayKey, amount: number): [AppEvent, LocalDateTime] => [
  { type: 'save_expense', expense: { id: `e-${day}-${amount}`, day, amount } },
  at(day, '12:00'),
];

describe('vueEcranMaison', () => {
  it('maison neuve : la pièce du mois, ses 3 objets de base intacts, 4 emplacements libres', () => {
    const vue = vueEcranMaison(etat([]), catalog, at('2026-11-02', '09:00'));
    expect(vue.annee).toBe(2026);
    expect(vue.pieces).toHaveLength(1);
    const [kura] = vue.pieces;
    expect(kura.vue.scene.room).toBe('room-11');
    expect(kura.vue.description).toMatch(/^Kura, la réserve, novembre 2026\./);
    expect(kura.libres).toBe(4);
    expect(kura.objets.map((o) => [o.nom.nom, o.etat, o.reparation])).toEqual([
      ['étagères', 'intact', null],
      ['coffre nagamochi', 'intact', null],
      ['échelle', 'intact', null],
    ]);
    expect(kura.objets[0].nom).toEqual({ nom: 'étagères', article: 'les', genre: 'f' });
    expect(vue.enAttente).toEqual([]);
  });

  it('objet fêlé en tête de file : « x jours sur 7 » ; fêlé en attente de son tour : sans chiffre', () => {
    // Semaine 45 hors budget : le kumade entre, l'échelle se fêle (départ lundi 9). Semaine 46
    // hors budget et incomplète : le kumade se fêle à son tour et attend que l'échelle soit réparée.
    const s = etat([
      depenser('2026-11-03', 15000),
      ...fermerDu('2026-11-02', '2026-11-08'),
      depenser('2026-11-10', 15000),
      ...fermerDu('2026-11-09', '2026-11-15', ['2026-11-11']),
      [{ type: 'open' }, at('2026-11-16', '13:00')],
    ]);
    const [kura] = vueEcranMaison(s, catalog, at('2026-11-16', '13:00')).pieces;
    const parId = new Map(kura.objets.map((o) => [o.itemId, o]));
    const echelle = kura.objets.find((o) => o.nom.nom === 'échelle');
    const kumade = kura.objets.find((o) => o.nom.nom === 'râteau porte-bonheur kumade');
    expect(echelle?.etat).toBe('cracked');
    expect(echelle?.reparation).toEqual({ type: 'enCours', jours: 4 });
    expect(kumade?.etat).toBe('cracked');
    expect(kumade?.reparation).toEqual({ type: 'enAttente' });
    expect(parId.size).toBe(4);
    expect(kura.libres).toBe(3);
  });

  it('la valeur de la réparation vient du modèle de scène', () => {
    const s = etat([depenser('2026-11-03', 15000), ...fermerDu('2026-11-02', '2026-11-11')]);
    const [kura] = vueEcranMaison(s, catalog, at('2026-11-11')).pieces;
    const scene = kura.vue.scene.items.find((i) => i.state === 'cracked');
    const echelle = kura.objets.find((o) => o.itemId === scene?.itemId);
    expect(scene?.repairDays).toBe(3);
    expect(echelle?.reparation).toEqual({ type: 'enCours', jours: 3 });
  });

  it('objet réparé à l’or : plus de réparation', () => {
    const s = etat([depenser('2026-11-03', 15000), ...fermerDu('2026-11-02', '2026-11-15')]);
    const [kura] = vueEcranMaison(s, catalog, at('2026-11-15')).pieces;
    const echelle = kura.objets.find((o) => o.nom.nom === 'échelle');
    expect(echelle?.etat).toBe('repaired');
    expect(echelle?.reparation).toBeNull();
  });

  it('un objet gagné avant le déblocage de sa pièce attend, avec le bilan qui l’ouvrira', () => {
    // Toutes les journées clôturées jusqu'au dimanche 6 décembre, sans bilan de novembre : la
    // semaine 49 (jeudi 3 décembre) apporte un objet de décembre, qui attend sa pièce.
    const s = etat([...fermerDu('2026-11-02', '2026-12-06')]);
    const vue = vueEcranMaison(s, catalog, at('2026-12-06'));
    expect(vue.pieces.map((p) => p.vue.scene.room)).toEqual(['room-11']);
    expect(vue.pieces[0].libres).toBe(0);
    expect(vue.enAttente).toEqual([
      {
        itemId: expect.any(String),
        nom: { nom: 'mortier et maillet à mochi', article: 'le', genre: 'm' },
        moisPiece: '2026-12',
        moisBilan: '2026-11',
      },
    ]);

    // Le bilan de novembre validé : la pièce de décembre s'ouvre avec son objet, plus rien n'attend.
    const valide = process(
      s,
      { type: 'validate_month', month: '2026-11', resolution: '' },
      at('2026-12-07', '09:00'),
      catalog,
    ).state;
    const apres = vueEcranMaison(valide, catalog, at('2026-12-07', '09:00'));
    expect(apres.pieces.map((p) => p.vue.scene.room)).toEqual(['room-11', 'room-12']);
    expect(apres.pieces[1].objets).toHaveLength(4);
    expect(apres.enAttente).toEqual([]);
  });

  it('nouvelle année : seule la maison de l’année en cours, la précédente est dans l’album', () => {
    const s = etat([
      ...fermerDu('2026-11-02', '2026-11-08'),
      [{ type: 'open' }, at('2027-01-08', '09:00')],
    ]);
    const vue = vueEcranMaison(s, catalog, at('2027-01-08', '09:00'));
    expect(vue.annee).toBe(2027);
    expect(vue.pieces.map((p) => p.vue.scene.room)).toEqual(['room-01']);
  });
});
