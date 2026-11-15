// Fiche d'objet (E8, J4.7, #86) : ce que la fiche montre d'un objet de la maison de l'année, et
// son histoire tirée de `owned_item` : arrivée, fêlure, réparation à l'or.
import { catalogue } from '../content/catalogue';
import type { BudgetVersion } from '../domain/budget';
import { addDays } from '../domain/calendrier';
import type { Catalog } from '../domain/objets';
import type { DayKey, LocalDateTime } from '../domain/scellement';
import { type AppEvent, type AppState, createAppState, process } from '../domain/traitement';
import { vueFicheObjet } from './ficheObjet';

const catalog: Catalog = catalogue;
const at = (day: DayKey, time = '21:00'): LocalDateTime => ({ day, time });
const budget = (month: string, effectiveFrom: DayKey): BudgetVersion => ({
  id: `b-${month}`,
  month,
  income: 200000,
  fixedCosts: 110000,
  savingsGoal: 30000,
  effectiveFrom,
});

function etat(installDay: DayKey, evenements: [AppEvent, LocalDateTime][]): AppState {
  let s = createAppState(
    {
      installDay,
      at: at(installDay, '08:00'),
      budgets: [
        budget('2026-10', '2026-10-01'),
        budget('2026-11', '2026-11-01'),
        budget('2026-12', '2026-12-01'),
      ],
    },
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

describe('vueFicheObjet', () => {
  it('objet de base intact : noms, explication, visuels, arrivée à l’installation', () => {
    const vue = vueFicheObjet(
      etat('2026-11-02', []),
      catalogue,
      'echelle',
      at('2026-11-02', '09:00'),
    );
    expect(vue).toEqual({
      itemId: 'echelle',
      nom: { nom: 'échelle', article: "l'", genre: 'f' },
      japonais: { kanji: '梯子', romaji: 'hashigo' },
      explication:
        'Le kura a souvent un étage, où l’on monte par une échelle raide. Les objets les plus précieux y attendent leur saison.',
      visuels: {
        base: 'items/echelle/base',
        crack: 'items/echelle/crack',
        gold: 'items/echelle/gold',
      },
      etat: 'intact',
      reparation: null,
      histoire: { arrivee: { type: 'base', jour: '2026-11-02' }, felure: null, reparation: null },
    });
  });

  it('objet gagné, fêlé puis réparé à l’or : la semaine gagnée, le jour de la fêlure et celui de la réparation', () => {
    // Semaine 45 complète et dans le budget : le kumade entre. Semaine 46 complète et hors budget :
    // le kumade se fêle. Semaine 47 toute clôturée : réparé à l'or le dimanche 22.
    const s = etat('2026-11-02', [
      ...fermerDu('2026-11-02', '2026-11-08'),
      [{ type: 'open' }, at('2026-11-09', '13:00')],
      depenser('2026-11-10', 15000),
      ...fermerDu('2026-11-09', '2026-11-15'),
      [{ type: 'open' }, at('2026-11-16', '13:00')],
      ...fermerDu('2026-11-16', '2026-11-22'),
    ]);
    const vue = vueFicheObjet(
      s,
      catalogue,
      'rateau-porte-bonheur-kumade',
      at('2026-11-23', '09:00'),
    );
    expect(vue?.etat).toBe('repaired');
    expect(vue?.reparation).toBeNull();
    expect(vue?.histoire).toEqual({
      arrivee: { type: 'gagne', lundi: '2026-11-02' },
      felure: '2026-11-15',
      reparation: '2026-11-22',
    });
  });

  it('fêlé, réparation en cours : la fêlure seule et « x jours sur 7 »', () => {
    const s = etat('2026-11-02', [
      depenser('2026-11-03', 15000),
      ...fermerDu('2026-11-02', '2026-11-08'),
      [{ type: 'open' }, at('2026-11-09', '13:00')],
      ...fermerDu('2026-11-09', '2026-11-12'),
    ]);
    const vue = vueFicheObjet(s, catalogue, 'echelle', at('2026-11-13', '09:00'));
    expect(vue?.etat).toBe('cracked');
    expect(vue?.reparation).toEqual({ type: 'enCours', jours: 4 });
    expect(vue?.histoire.felure).toBe('2026-11-08');
    expect(vue?.histoire.reparation).toBeNull();
  });

  it('fêlé derrière un autre objet dans la file : réparation en attente', () => {
    const s = etat('2026-11-02', [
      depenser('2026-11-03', 15000),
      ...fermerDu('2026-11-02', '2026-11-08'),
      depenser('2026-11-10', 15000),
      ...fermerDu('2026-11-09', '2026-11-15', ['2026-11-11']),
      [{ type: 'open' }, at('2026-11-16', '13:00')],
    ]);
    const vue = vueFicheObjet(
      s,
      catalogue,
      'rateau-porte-bonheur-kumade',
      at('2026-11-16', '13:00'),
    );
    expect(vue?.etat).toBe('cracked');
    expect(vue?.reparation).toEqual({ type: 'enAttente' });
  });

  it('objet absent de la maison de l’année ou inconnu : null', () => {
    const s = etat('2026-11-02', []);
    expect(
      vueFicheObjet(s, catalogue, 'rateau-porte-bonheur-kumade', at('2026-11-02', '09:00')),
    ).toBeNull();
    expect(vueFicheObjet(s, catalogue, 'inconnu', at('2026-11-02', '09:00'))).toBeNull();
  });
});
