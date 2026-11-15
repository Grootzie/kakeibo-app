// Sélecteurs de la maison (J4.1, #80) : scène, description pour le lecteur d'écran, pièces, album.
import catalogueJson from '../content/catalogue.json';
import type { BudgetVersion } from '../domain/budget';
import { addDays } from '../domain/calendrier';
import type { Catalog } from '../domain/objets';
import type { DayKey, LocalDateTime } from '../domain/scellement';
import { type AppEvent, type AppState, createAppState, process } from '../domain/traitement';
import { anneesAlbum, piecesDeLAnnee, vueAlbum, vueMaison } from './maison';

const catalog = catalogueJson as Catalog;
const NBSP = '\u00a0';
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

describe('vueMaison', () => {
  it('maison neuve : description de la pièce, des objets et de la poussière', () => {
    const vue = vueMaison(etat([]), catalog, 2026, 'room-11', at('2026-11-02', '09:00'));
    expect(vue?.scene.items).toHaveLength(3);
    expect(vue?.description).toBe(
      'Kura, la réserve, novembre 2026. Les étagères. Le coffre nagamochi. L’échelle. ' +
        '4 emplacements libres. La maison est propre.',
    );
  });

  it('objet fêlé en réparation, objet fêlé en attente, accord en genre', () => {
    const s = etat([
      depenser('2026-11-03', 15000),
      ...fermerDu('2026-11-02', '2026-11-08'),
      depenser('2026-11-10', 15000),
      ...fermerDu('2026-11-09', '2026-11-15', ['2026-11-11']),
      [{ type: 'open' }, at('2026-11-16', '13:00')],
    ]);
    expect(vueMaison(s, catalog, 2026, 'room-11', at('2026-11-16', '13:00'))?.description).toBe(
      'Kura, la réserve, novembre 2026. Les étagères. Le coffre nagamochi. ' +
        `L’échelle, fêlée, réparation${NBSP}: 4 jours sur 7. ` +
        'Le râteau porte-bonheur kumade, fêlé. 3 emplacements libres. Un voile de poussière.',
    );
  });

  it('objet réparé à l’or, une seule journée de réparation au singulier, poussière forte', () => {
    const repare = etat([depenser('2026-11-03', 15000), ...fermerDu('2026-11-02', '2026-11-15')]);
    expect(vueMaison(repare, catalog, 2026, 'room-11', at('2026-11-15'))?.description).toContain(
      'L’échelle, réparée à l’or.',
    );

    const unJour = etat([depenser('2026-11-03', 15000), ...fermerDu('2026-11-02', '2026-11-09')]);
    expect(vueMaison(unJour, catalog, 2026, 'room-11', at('2026-11-09'))?.description).toContain(
      `réparation${NBSP}: 1 jour sur 7.`,
    );

    const poussiere = vueMaison(etat([]), catalog, 2026, 'room-11', at('2026-11-07', '09:00'));
    expect(poussiere?.scene.dust).toBe(2);
    expect(poussiere?.description).toMatch(
      /De la poussière, une toile d’araignée et la lumière baissée\.$/,
    );
  });

  it('aucun emplacement libre : rien n’est dit des emplacements', () => {
    const s = etat([
      ...fermerDu('2026-11-02', '2026-11-29'),
      [{ type: 'open' }, at('2026-11-30', '13:00')],
    ]);
    const vue = vueMaison(s, catalog, 2026, 'room-11', at('2026-11-30', '13:00'));
    expect(vue?.scene.freeSlots).toEqual([]);
    expect(vue?.description).not.toMatch(/emplacement/);
    expect(vue?.description).toContain('Les sucres d’orge chitose-ame.');
  });

  it('un emplacement libre au singulier', () => {
    const s = etat([...fermerDu('2026-11-02', '2026-11-22')]);
    expect(vueMaison(s, catalog, 2026, 'room-11', at('2026-11-22'))?.description).toContain(
      '1 emplacement libre.',
    );
  });

  it('pièce non débloquée : pas de vue', () => {
    expect(vueMaison(etat([]), catalog, 2026, 'room-12', at('2026-11-02'))).toBeNull();
  });

  it('pièces de l’année et années de l’album', () => {
    const s = etat([[{ type: 'open' }, at('2027-01-04', '09:00')]]);
    expect(piecesDeLAnnee(s, catalog, 2026)).toEqual(['room-11']);
    expect(piecesDeLAnnee(s, catalog, 2027)).toEqual(['room-01']);
    expect(anneesAlbum(s, at('2027-01-04', '09:00'))).toEqual([2026]);
    expect(anneesAlbum(s, at('2027-01-03', '09:00'))).toEqual([]);
  });
});

describe('vueAlbum (#87)', () => {
  // Semaine 45 complète et hors budget : le kumade entre, l'échelle se fêle. Semaine 46 : 4 jours
  // clôturés d'affilée, la réparation en est à 4 jours sur 7 quand l'année se termine.
  const fin2026 = (): [AppEvent, LocalDateTime][] => [
    depenser('2026-11-03', 15000),
    ...fermerDu('2026-11-02', '2026-11-08'),
    ...fermerDu('2026-11-09', '2026-11-12'),
  ];

  it('album vide tant que l’année de la maison n’est pas finie', () => {
    const s = etat(fin2026());
    expect(vueAlbum(s, catalog, at('2026-12-31', '09:00'))).toEqual([]);
    // Le dimanche 3 janvier 2027 appartient encore à la semaine 2026-W53.
    expect(vueAlbum(s, catalog, at('2027-01-03', '09:00'))).toEqual([]);
  });

  it('la nouvelle année range la maison de 2026 telle quelle, sans poussière ni réparation en cours', () => {
    const s = etat([...fin2026(), [{ type: 'open' }, at('2027-01-04', '09:00')]]);
    const album = vueAlbum(s, catalog, at('2027-01-04', '09:00'));
    expect(album.map((a) => a.annee)).toEqual([2026]);
    const [kura] = album[0].pieces;
    expect(album[0].pieces).toHaveLength(1);
    expect(kura.scene.room).toBe('room-11');
    expect(kura.scene.dust).toBe(0);
    expect(kura.scene.items.map((i) => [i.itemId, i.state, i.repairDays])).toEqual([
      ['etageres', 'intact', null],
      ['coffre-nagamochi', 'intact', null],
      ['echelle', 'cracked', null],
      ['rateau-porte-bonheur-kumade', 'intact', null],
    ]);
    expect(kura.description).toBe(
      'Kura, la réserve, novembre 2026. Les étagères. Le coffre nagamochi. L’échelle, fêlée. ' +
        'Le râteau porte-bonheur kumade. 3 emplacements libres. La maison est propre.',
    );
  });

  it('les clôtures de la nouvelle année ne réparent pas un objet de l’album', () => {
    const s = etat([...fin2026(), ...fermerDu('2027-01-04', '2027-01-17')]);
    const echelle = vueAlbum(s, catalog, at('2027-01-17'))[0].pieces[0].scene.items[2];
    expect(echelle).toMatchObject({ itemId: 'echelle', state: 'cracked', repairDays: null });
  });

  it('chaque pièce débloquée de l’année, dans l’ordre des mois, une vignette par année', () => {
    // Bilan de novembre validé : la pièce de décembre s'ouvre en 2026.
    const s = etat([
      ...fin2026(),
      [{ type: 'open' }, at('2026-12-01', '09:00')],
      [{ type: 'validate_month', month: '2026-11', resolution: '' }, at('2026-12-01', '09:05')],
      [{ type: 'open' }, at('2028-01-03', '09:00')],
    ]);
    const album = vueAlbum(s, catalog, at('2028-01-03', '09:00'));
    expect(album.map((a) => a.annee)).toEqual([2026, 2027]);
    expect(album[0].pieces.map((p) => p.scene.room)).toEqual(['room-11', 'room-12']);
    expect(album[1].pieces.map((p) => p.scene.room)).toEqual(['room-01']);
  });
});
