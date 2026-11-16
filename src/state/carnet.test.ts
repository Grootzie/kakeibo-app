// Carnet (E9, J5.3, #102) : semaines, jours, totaux par catégorie, filtre par mois, résultat des
// semaines scellées, et requête de moins de 50 ms avec un an de données.
import catalogueJson from '../content/catalogue.json';
import { migrate } from '../data/migrations';
import type { ExpenseRow } from '../data/repositories';
import { createRepositories } from '../data/repositories';
import { createTestDb } from '../data/testDb';
import { addDays } from '../domain/calendrier';
import type { Catalog } from '../domain/objets';
import type { WeekResult } from '../domain/scellement';
import { moisCourantDuCarnet, moisDuCarnet, vueCarnet } from './carnet';
import { createClock } from './clock';
import { createKakeiboStore } from './store';

const ligne = (
  id: string,
  day: string,
  amount: number,
  category: ExpenseRow['category'],
  note = '',
): ExpenseRow => ({
  id,
  day,
  amount,
  category,
  note,
  created_at: `${day}T12:00:00+01:00`,
  updated_at: `${day}T12:00:00+01:00`,
});

const resultat45: WeekResult = {
  week: '2026-W45',
  sealedAt: { day: '2026-11-08', time: '21:00' },
  countedDays: 7,
  stamps: 7,
  envelope: 14000,
  spent: 12000,
  inBudget: true,
  complete: true,
  gashaponItem: 'rateau-porte-bonheur-kumade',
  crackedItem: null,
};

const lundi16 = { day: '2026-11-16', time: '09:00' };

describe('vueCarnet', () => {
  const depenses = [
    ligne('a', '2026-11-03', 5000, 'essentiel', 'courses'),
    ligne('b', '2026-11-03', 2000, 'envies'),
    ligne('c', '2026-11-05', 5000, 'culture'),
    ligne('d', '2026-11-10', 1250, 'envies', 'cinéma'),
    ligne('e', '2026-11-16', 800, 'imprevus'),
  ];

  it('range les dépenses par semaine, de la plus récente à la plus ancienne, puis par jour', () => {
    const vue = vueCarnet(depenses, [resultat45], '2026-11-02', lundi16, '2026-11');
    expect(vue.semaines.map((s) => s.semaine)).toEqual(['2026-W47', '2026-W46', '2026-W45']);
    const s45 = vue.semaines[2];
    expect([s45.lundi, s45.dimanche]).toEqual(['2026-11-02', '2026-11-08']);
    expect(s45.jours.map((j) => j.jour)).toEqual(['2026-11-05', '2026-11-03']);
    expect(s45.jours[1]).toEqual({
      jour: '2026-11-03',
      total: 7000,
      depenses: [
        { id: 'a', montant: 5000, categorie: 'essentiel', note: 'courses' },
        { id: 'b', montant: 2000, categorie: 'envies', note: '' },
      ],
    });
  });

  it('donne les totaux des quatre catégories, dans l’ordre fixe, et le total de la semaine', () => {
    const s45 = vueCarnet(depenses, [], '2026-11-02', lundi16, '2026-11').semaines[2];
    expect(s45.totaux).toEqual([
      { categorie: 'essentiel', total: 5000 },
      { categorie: 'envies', total: 2000 },
      { categorie: 'culture', total: 5000 },
      { categorie: 'imprevus', total: 0 },
    ]);
    expect(s45.total).toBe(12000);
  });

  it('une semaine scellée affiche son résultat ; une semaine ouverte, aucun', () => {
    const vue = vueCarnet(depenses, [resultat45], '2026-11-02', lundi16, '2026-11');
    expect(vue.semaines[2].resultat).toEqual({
      tampons: 7,
      joursDecomptes: 7,
      enveloppe: 14000,
      depense: 12000,
      dansLeBudget: true,
    });
    expect(vue.semaines[0].resultat).toBeNull();
    expect(vue.semaines[1].resultat).toBeNull();
  });

  it('une semaine sans dépense reste affichée, sans jour', () => {
    const vue = vueCarnet([], [], '2026-11-02', lundi16, '2026-11');
    expect(vue.semaines).toHaveLength(3);
    expect(vue.semaines.every((s) => s.jours.length === 0 && s.total === 0)).toBe(true);
  });

  it('filtre par mois : une semaine appartient au mois de son jeudi, et reste entière', () => {
    // Semaine 49, du lundi 30 novembre au dimanche 6 décembre : son jeudi 3 est en décembre.
    const lignes = [
      ligne('n', '2026-11-27', 1000, 'envies'),
      ligne('x', '2026-11-30', 2000, 'essentiel'),
      ligne('y', '2026-12-02', 3000, 'culture'),
    ];
    const jeudi3 = { day: '2026-12-03', time: '09:00' };
    const novembre = vueCarnet(lignes, [], '2026-11-02', jeudi3, '2026-11');
    expect(novembre.semaines.map((s) => s.semaine)).toEqual([
      '2026-W48',
      '2026-W47',
      '2026-W46',
      '2026-W45',
    ]);
    expect(novembre.semaines[0].total).toBe(1000);
    const decembre = vueCarnet(lignes, [], '2026-11-02', jeudi3, '2026-12');
    expect(decembre.semaines.map((s) => s.semaine)).toEqual(['2026-W49']);
    expect(decembre.semaines[0].jours.map((j) => j.jour)).toEqual(['2026-12-02', '2026-11-30']);
    expect(decembre.semaines[0].total).toBe(5000);
  });

  it('ne montre ni les semaines avant l’installation ni les semaines à venir', () => {
    // Installation le jeudi 5 novembre, aujourd'hui le mercredi 11 : semaines 45 et 46.
    const vue = vueCarnet([], [], '2026-11-05', { day: '2026-11-11', time: '09:00' }, '2026-11');
    expect(vue.semaines.map((s) => s.semaine)).toEqual(['2026-W46', '2026-W45']);
  });

  it('propose les mois de l’installation à aujourd’hui, en passant l’année', () => {
    expect(moisDuCarnet('2026-11-02', '2027-02-10')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
    // Le dimanche 1er novembre 2026 est dans la semaine 44, celle du jeudi 29 octobre.
    expect(moisDuCarnet('2026-11-01', '2026-11-01')).toEqual(['2026-10']);
    expect(vueCarnet([], [], '2026-11-02', lundi16, '2026-11').moisDisponibles).toEqual([
      '2026-11',
    ]);
  });

  it('ouvre par défaut le mois de la semaine en cours', () => {
    expect(moisCourantDuCarnet('2026-11-16')).toBe('2026-11');
    expect(moisCourantDuCarnet('2026-11-30')).toBe('2026-12');
    expect(moisCourantDuCarnet('2027-01-02')).toBe('2026-12');
  });
});

describe('carnet et store', () => {
  it('scénario 15 : une dépense de la semaine 45 modifiée le mardi 10, résultat inchangé, nouveau montant affiché', async () => {
    const db = createTestDb();
    await migrate(db);
    const repos = createRepositories(db);
    let reel = new Date(2026, 10, 2, 8, 0);
    let n = 0;
    const deps = {
      depots: async () => repos,
      catalogue: catalogueJson as Catalog,
      horloge: createClock({ actif: true, reel: () => reel }),
      nouvelId: () => `id-${++n}`,
    };
    await createKakeiboStore(deps).getState().ouvrir();
    await repos.budgetVersions.add({
      id: 'b-nov',
      month: '2026-11',
      income: 200000,
      fixed_costs: 110000,
      savings_goal: 30000,
      effective_from: '2026-11-02',
    });
    const store = createKakeiboStore(deps);
    reel = new Date(2026, 10, 3, 12, 0);
    const { id } = await store
      .getState()
      .noterDepense({ day: '2026-11-03', amount: 12000, category: 'essentiel', note: '' });
    for (let j = 2; j <= 8; j++) {
      reel = new Date(2026, 10, j, 21, 0);
      expect(await store.getState().cloturerJour(`2026-11-${String(j).padStart(2, '0')}`)).toBe(
        null,
      );
    }
    reel = new Date(2026, 10, 10, 9, 0);
    await store.getState().ouvrir();
    expect(
      await store.getState().enregistrerDepense({
        id,
        day: '2026-11-03',
        amount: 15000,
        category: 'essentiel',
        note: '',
      }),
    ).toBe(null);

    const { depenses, etat, maintenant } = store.getState();
    if (etat === null || maintenant === null) throw new Error('état non chargé');
    const s45 = vueCarnet(depenses, etat.results, etat.installDay, maintenant, '2026-11')
      .semaines[1];
    expect(s45.semaine).toBe('2026-W45');
    expect(s45.resultat).toEqual({
      tampons: 7,
      joursDecomptes: 7,
      enveloppe: 14000,
      depense: 12000,
      dansLeBudget: true,
    });
    expect(s45.jours[0].depenses[0].montant).toBe(15000);
    expect(s45.totaux[0]).toEqual({ categorie: 'essentiel', total: 15000 });
  });
});

describe('performance du carnet', () => {
  it('répond en moins de 50 ms avec un an de données (3 000 dépenses, 52 semaines scellées)', () => {
    const categories: ExpenseRow['category'][] = ['essentiel', 'envies', 'culture', 'imprevus'];
    const depenses: ExpenseRow[] = [];
    for (let i = 0; i < 3000; i++) {
      const jour = addDays('2025-11-17', Math.floor((i * 365) / 3000));
      depenses.push(ligne(`e-${i}`, jour, 100 + i, categories[i % 4], 'note de test'));
    }
    const resultats: WeekResult[] = Array.from({ length: 52 }, (_, i) => ({
      ...resultat45,
      week: `2026-W${String(i + 1).padStart(2, '0')}`,
    }));
    const maintenant = { day: '2026-11-16', time: '09:00' };
    const mesurer = (mois: string): number => {
      vueCarnet(depenses, resultats, '2025-11-17', maintenant, mois);
      const debut = performance.now();
      const vue = vueCarnet(depenses, resultats, '2025-11-17', maintenant, mois);
      const duree = performance.now() - debut;
      expect(vue.semaines.length).toBeGreaterThan(0);
      return duree;
    };
    for (const mois of ['2025-11', '2026-05', '2026-11'])
      expect({ mois, rapide: mesurer(mois) < 50 }).toEqual({ mois, rapide: true });
    // Toutes les dépenses du mois sont là : rien ne se perd au filtre.
    const juin = vueCarnet(depenses, resultats, '2025-11-17', maintenant, '2026-06');
    const attendu = depenses
      .filter((d) => d.day >= juin.semaines.at(-1)!.lundi && d.day <= juin.semaines[0].dimanche)
      .reduce((s, d) => s + d.amount, 0);
    expect(juin.semaines.reduce((s, x) => s + x.total, 0)).toBe(attendu);
  });
});
