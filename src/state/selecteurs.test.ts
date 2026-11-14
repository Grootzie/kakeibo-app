// Sélecteurs de l'accueil (E2) : enveloppe et dépensé de la semaine, 7 cases, jour à rattraper.
import catalogueJson from '../content/catalogue.json';
import type { ExpenseRow } from '../data/repositories';
import type { BudgetVersion } from '../domain/budget';
import type { Catalog } from '../domain/objets';
import type { DayKey, LocalDateTime } from '../domain/scellement';
import { type AppEvent, type AppState, createAppState, process } from '../domain/traitement';
import {
  bandeauAccueil,
  bilansAAfficher,
  casesSemaine,
  enveloppeSemaine,
  estRattrapable,
  joursDepense,
  jourARattraper,
  objetsReparesEntre,
  piecesOuvertesParBilan,
  resolutionDuMois,
  vueAccueil,
  vueBilanMois,
  vueCloture,
  vueBilanSemaine,
  vueRecapitulatif,
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
const ouvrir = (t: LocalDateTime): [AppEvent, LocalDateTime] => [{ type: 'open' }, t];
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

describe('vue de la clôture (E4, #45)', () => {
  const ligne = (
    id: string,
    day: DayKey,
    amount: number,
    category: ExpenseRow['category'],
    note = '',
  ): ExpenseRow => ({
    id,
    day,
    amount,
    category,
    note,
    created_at: `${day}T12:00`,
    updated_at: `${day}T12:00`,
  });

  it('liste les dépenses du jour seulement, et propose « Rien dépensé » sans dépense', () => {
    const s = etat('2026-11-02', [depenser('2026-11-05', 900)]);
    const lignes = [ligne('a', '2026-11-05', 900, 'envies')];
    expect(vueCloture(s, lignes, '2026-11-06', at('2026-11-06'))).toEqual({
      jour: '2026-11-06',
      rattrapage: false,
      depenses: [],
      totaux: [],
      total: 0,
      validation: 'rien_depense',
      cloture: false,
      peutCloturer: true,
      peutAjouter: true,
    });
  });

  it('donne le total par catégorie, dans l’ordre des catégories, et « J’ai tout noté »', () => {
    const s = etat('2026-11-02', [
      depenser('2026-11-06', 1250),
      depenser('2026-11-06', 400),
      depenser('2026-11-06', 3000),
    ]);
    const lignes = [
      ligne('c', '2026-11-06', 1250, 'envies', 'Cinéma'),
      ligne('d', '2026-11-06', 400, 'imprevus'),
      ligne('e', '2026-11-06', 3000, 'envies'),
      ligne('f', '2026-11-05', 700, 'essentiel'),
    ];
    const vue = vueCloture(s, lignes, '2026-11-06', at('2026-11-06'));
    expect(vue.depenses.map((d) => d.id)).toEqual(['c', 'd', 'e']);
    expect(vue.totaux).toEqual([
      { categorie: 'envies', total: 4250 },
      { categorie: 'imprevus', total: 400 },
    ]);
    expect(vue.total).toBe(4650);
    expect(vue.validation).toBe('tout_note');
  });

  it('un jour clôturé de semaine ouverte ne se clôture plus, mais accepte une dépense oubliée', () => {
    const s = etat('2026-11-02', [fermer('2026-11-06', at('2026-11-06', '20:00'))]);
    expect(vueCloture(s, [], '2026-11-06', at('2026-11-06', '22:00'))).toMatchObject({
      cloture: true,
      peutCloturer: false,
      peutAjouter: true,
    });
  });

  it('un jour d’une semaine scellée n’accepte plus de dépense oubliée', () => {
    const s = etat('2026-11-02', [[{ type: 'open' }, at('2026-11-09', '12:00')]]);
    expect(vueCloture(s, [], '2026-11-06', at('2026-11-09', '12:00'))).toMatchObject({
      cloture: false,
      peutCloturer: false,
      peutAjouter: false,
    });
  });
});

describe('jour rattrapable (E5, #46)', () => {
  // Installation le lundi 2 ; mercredi 4 jamais clôturé.
  const s = () => etat('2026-11-02', [fermer('2026-11-02'), fermer('2026-11-03')]);

  it('l’est encore dimanche soir et le lundi suivant à 11:59', () => {
    expect(estRattrapable(s(), '2026-11-04', at('2026-11-08', '23:50'))).toBe(true);
    expect(estRattrapable(s(), '2026-11-04', at('2026-11-09', '11:59'))).toBe(true);
  });

  it('ne l’est plus le lundi suivant à 12:00, même avant le scellement enregistré', () => {
    expect(estRattrapable(s(), '2026-11-04', at('2026-11-09', '12:00'))).toBe(false);
    const scelle = process(s(), { type: 'open' }, at('2026-11-09', '12:00'), catalog).state;
    expect(estRattrapable(scelle, '2026-11-04', at('2026-11-09', '12:00'))).toBe(false);
  });

  it('ne concerne ni aujourd’hui, ni un jour clôturé, ni un jour futur ou avant l’installation', () => {
    expect(estRattrapable(s(), '2026-11-06', at('2026-11-06'))).toBe(false);
    expect(estRattrapable(s(), '2026-11-03', at('2026-11-06'))).toBe(false);
    expect(estRattrapable(s(), '2026-11-07', at('2026-11-06'))).toBe(false);
    expect(estRattrapable(s(), '2026-11-01', at('2026-11-06'))).toBe(false);
  });

  it('dit à l’écran de clôture qu’il s’agit d’un rattrapage', () => {
    expect(vueCloture(s(), [], '2026-11-04', at('2026-11-06')).rattrapage).toBe(true);
    expect(vueCloture(s(), [], '2026-11-06', at('2026-11-06')).rattrapage).toBe(false);
  });
});

describe('bilans à afficher (J3.1, #61)', () => {
  it('rien n’est prêt avant le premier scellement', () => {
    const s = etat('2026-11-02', [fermer('2026-11-02')]);
    expect(bilansAAfficher(s)).toEqual({ semaines: null, mois: null, chiffresMois: null });
  });

  it('une semaine scellée pas encore vue donne l’écran « une semaine »', () => {
    const s = etat('2026-11-02', [ouvrir(at('2026-11-09', '12:00'))]);
    expect(bilansAAfficher(s).semaines).toEqual({ kind: 'week', week: '2026-W45' });
  });

  it('plusieurs semaines manquées donnent un seul écran récapitulatif', () => {
    const s = etat('2026-11-02', [ouvrir(at('2026-11-17', '09:00'))]);
    expect(bilansAAfficher(s).semaines).toEqual({
      kind: 'recap',
      weeks: ['2026-W45', '2026-W46'],
    });
  });

  it('le mois terminé est proposé avec ses chiffres à partir du 1er du mois suivant', () => {
    const s = etat('2026-11-02', [
      depenser('2026-11-03', 5000),
      [{ type: 'week_reviews_seen' }, at('2026-12-01', '08:00')],
    ]);
    const bilans = bilansAAfficher(s);
    expect(bilans.mois).toBe('2026-11');
    expect(bilans.chiffresMois).toEqual({
      month: '2026-11',
      q1: 90000,
      q2: 30000,
      q3: 5000,
      realSavings: 85000,
      goalReached: true,
    });
  });
});

describe('bandeau unique de l’accueil (E2, J3.1, #61)', () => {
  // Installée le lundi 2 novembre, rien clôturé : le 1er décembre à 9:00, les semaines 45 à 48
  // sont scellées, novembre attend son bilan et lundi 30 novembre est à rattraper.
  const decembre = at('2026-12-01', '09:00');
  const tout = () => etat('2026-11-02', [ouvrir(decembre)]);
  const suite = (s: AppState, e: AppEvent, t = decembre) => process(s, e, t, catalog).state;

  it('1. le bilan de la semaine passe avant tout le reste', () => {
    const s = tout();
    expect(jourARattraper(s, decembre)).toBe('2026-11-30');
    expect(s.monthToReview).toBe('2026-11');
    expect(bandeauAccueil(s, decembre)).toEqual({
      type: 'bilan_semaine',
      ecran: { kind: 'recap', weeks: ['2026-W45', '2026-W46', '2026-W47', '2026-W48'] },
    });
  });

  it('une seule semaine prête : le bandeau ouvre l’écran « une semaine »', () => {
    const s = etat('2026-11-02', [ouvrir(at('2026-11-10', '09:00'))]);
    expect(bandeauAccueil(s, at('2026-11-10', '09:00'))).toEqual({
      type: 'bilan_semaine',
      ecran: { kind: 'week', week: '2026-W45' },
    });
  });

  it('2. puis le bilan du mois, devant le jour à rattraper', () => {
    const s = suite(tout(), { type: 'week_reviews_seen' });
    expect(bandeauAccueil(s, decembre)).toEqual({ type: 'bilan_mois', mois: '2026-11' });
  });

  it('3. puis le jour à rattraper, devant la résolution', () => {
    let s = suite(tout(), { type: 'week_reviews_seen' });
    s = suite(s, { type: 'validate_month', month: '2026-11', resolution: 'Cuisiner le soir.' });
    expect(bandeauAccueil(s, decembre)).toEqual({ type: 'jour_a_rattraper', jour: '2026-11-30' });
  });

  it('4. enfin la résolution du mois, tirée du bilan du mois précédent', () => {
    let s = suite(tout(), { type: 'week_reviews_seen' });
    s = suite(s, { type: 'validate_month', month: '2026-11', resolution: 'Cuisiner le soir.' });
    s = suite(s, { type: 'close_day', day: '2026-11-30' });
    expect(bandeauAccueil(s, decembre)).toEqual({
      type: 'resolution',
      mois: '2026-12',
      resolution: 'Cuisiner le soir.',
    });
    // Toute la durée du mois, puis plus en janvier, qui attend la résolution de décembre.
    expect(resolutionDuMois(s, at('2026-12-31', '20:00'))).toEqual({
      mois: '2026-12',
      resolution: 'Cuisiner le soir.',
    });
    expect(resolutionDuMois(s, at('2027-01-01', '20:00'))).toBeNull();
  });

  it('sans résolution écrite, ni bandeau de résolution ni bandeau vide', () => {
    let s = suite(tout(), { type: 'week_reviews_seen' });
    s = suite(s, { type: 'validate_month', month: '2026-11', resolution: '   ' });
    s = suite(s, { type: 'close_day', day: '2026-11-30' });
    expect(bandeauAccueil(s, decembre)).toBeNull();
  });

  it('la vue de l’accueil porte ce bandeau unique', () => {
    const s = tout();
    expect(vueAccueil(s, decembre).bandeau).toEqual(bandeauAccueil(s, decembre));
  });
});

describe('bilan du mois (E7, J3.4, #64)', () => {
  const ligne = (
    id: string,
    day: DayKey,
    amount: number,
    category: ExpenseRow['category'],
  ): ExpenseRow => ({
    id,
    day,
    amount,
    category,
    note: '',
    created_at: `${day}T12:00`,
    updated_at: `${day}T12:00`,
  });
  const decembre = at('2026-12-01', '09:00');

  it('scénario 17 : Q1 à Q3 du domaine et le détail par catégorie, du mois seulement', () => {
    const s = etat('2026-11-02', [
      depenser('2026-11-03', 42000),
      depenser('2026-11-20', 10000),
      ouvrir(decembre),
    ]);
    const lignes = [
      ligne('e-2026-11-03-42000', '2026-11-03', 42000, 'essentiel'),
      ligne('e-2026-11-20-10000', '2026-11-20', 10000, 'culture'),
      // Une dépense de décembre n'entre pas dans le bilan de novembre.
      ligne('e-dec', '2026-12-01', 900, 'envies'),
    ];
    expect(vueBilanMois(s, lignes)).toEqual({
      mois: '2026-11',
      chiffres: {
        month: '2026-11',
        q1: 90000,
        q2: 30000,
        q3: 52000,
        realSavings: 38000,
        goalReached: true,
      },
      parCategorie: [
        { categorie: 'essentiel', total: 42000 },
        { categorie: 'culture', total: 10000 },
      ],
    });
  });

  it('rien à faire avant le 1er du mois suivant', () => {
    const s = etat('2026-11-02', [ouvrir(at('2026-11-30', '20:00'))]);
    expect(vueBilanMois(s, [])).toBeNull();
  });

  it('nomme les pièces que la validation a ouvertes, avec la fête de leur mois', () => {
    let s = etat('2026-11-02', [ouvrir(decembre)]);
    expect(piecesOuvertesParBilan(s, '2026-11', catalog)).toEqual([]);
    s = process(
      s,
      { type: 'validate_month', month: '2026-11', resolution: '' },
      decembre,
      catalog,
    ).state;
    expect(piecesOuvertesParBilan(s, '2026-11', catalog)).toEqual([
      { mois: '2026-12', fete: 'Ōmisoka, le réveillon' },
    ]);
  });

  it('les pièces des mois sautés s’ouvrent aussi, dans l’ordre des mois', () => {
    const avril = at('2027-04-01', '09:00');
    let s = etat('2026-11-02', [ouvrir(avril)]);
    expect(s.monthToReview).toBe('2027-03');
    s = process(
      s,
      { type: 'validate_month', month: '2027-03', resolution: '' },
      avril,
      catalog,
    ).state;
    expect(piecesOuvertesParBilan(s, '2027-03', catalog).map((p) => p.mois)).toEqual([
      '2027-02',
      '2027-03',
      '2027-04',
    ]);
  });

  it('en décembre, le bilan n’ouvre aucune pièce', () => {
    const janvier = at('2027-01-04', '09:00');
    let s = etat('2026-11-02', [
      ouvrir(decembre),
      [{ type: 'validate_month', month: '2026-11', resolution: '' }, decembre],
      ouvrir(janvier),
    ]);
    expect(s.monthToReview).toBe('2026-12');
    s = process(
      s,
      { type: 'validate_month', month: '2026-12', resolution: '' },
      janvier,
      catalog,
    ).state;
    expect(piecesOuvertesParBilan(s, '2026-12', catalog)).toEqual([]);
  });
});

describe('récapitulatif après une longue absence (E6, J3.3, #63)', () => {
  const semaine45 = (montant: number): [AppEvent, LocalDateTime][] => [
    depenser('2026-11-03', montant),
    ...['02', '03', '04', '05', '06', '07', '08'].map((j) => fermer(`2026-11-${j}`)),
  ];

  it('rien quand une seule semaine attend : son bilan s’affiche seul', () => {
    const s = etat('2026-11-02', [ouvrir(at('2026-11-10', '09:00'))]);
    expect(vueRecapitulatif(s, at('2026-11-10', '09:00'), catalog)).toBeNull();
  });

  it('rien quand tous les bilans de semaine sont vus', () => {
    const t = at('2026-11-25', '09:00');
    const s = etat('2026-11-02', [ouvrir(t), [{ type: 'week_reviews_seen' }, t]]);
    expect(vueRecapitulatif(s, t, catalog)).toBeNull();
  });

  it('trois semaines d’absence : une ligne par semaine, de la plus ancienne à la plus récente', () => {
    // Semaine 45 complète et hors budget (150 € pour 140 €), puis plus aucune ouverture
    // jusqu'au mercredi 25 novembre : les semaines 45, 46 et 47 attendent leur bilan.
    const t = at('2026-11-25', '09:00');
    const s = etat('2026-11-02', [...semaine45(15000), ouvrir(t)]);
    expect(vueRecapitulatif(s, t, catalog)).toEqual({
      semaines: [
        {
          semaine: '2026-W45',
          lundi: '2026-11-02',
          tampons: 7,
          jours: 7,
          dansLeBudget: false,
          objetGagne: 'râteau porte-bonheur kumade',
          objetFele: 'échelle',
        },
        {
          semaine: '2026-W46',
          lundi: '2026-11-09',
          tampons: 0,
          jours: 7,
          dansLeBudget: true,
          objetGagne: null,
          objetFele: null,
        },
        {
          semaine: '2026-W47',
          lundi: '2026-11-16',
          tampons: 0,
          jours: 7,
          dansLeBudget: true,
          objetGagne: null,
          objetFele: null,
        },
      ],
      poussiere: { niveau: 2, joursSansCloture: true, semaineIncomplete: true },
      reparations: [{ objet: 'échelle', progression: 0 }],
    });
  });

  it('scénario 14 : semaines 46 à 48 sans capsule ni fêlure, poussière niveau 2', () => {
    const t = at('2026-12-01', '09:00');
    const s = etat('2026-11-02', [
      ...semaine45(12000),
      [{ type: 'week_reviews_seen' }, at('2026-11-08')],
      ouvrir(t),
    ]);
    const vue = vueRecapitulatif(s, t, catalog);
    expect(vue?.semaines.map((l) => l.semaine)).toEqual(['2026-W46', '2026-W47', '2026-W48']);
    expect(vue?.semaines.every((l) => l.objetGagne === null && l.objetFele === null)).toBe(true);
    expect(vue?.poussiere.niveau).toBe(2);
    expect(vue?.reparations).toEqual([]);
    // Le bilan de novembre reste proposé, et le lundi 30 novembre rattrapable.
    expect(s.monthToReview).toBe('2026-11');
    expect(estRattrapable(s, '2026-11-30', t)).toBe(true);
  });

  it('la file de réparation, dans l’ordre où les objets se sont fêlés', () => {
    // Semaine 45 hors budget : l'échelle se fêle. Semaine 46 hors budget, sans clôture : le
    // râteau gagné en semaine 45 se fêle à son tour et attend que l'échelle soit réparée.
    const t = at('2026-11-25', '09:00');
    const s = etat('2026-11-02', [...semaine45(15000), depenser('2026-11-10', 15000), ouvrir(t)]);
    expect(vueRecapitulatif(s, t, catalog)?.reparations).toEqual([
      { objet: 'échelle', progression: 0 },
      { objet: 'râteau porte-bonheur kumade', progression: 0 },
    ]);
  });

  it('la semaine d’installation ne compte que ses jours décomptés', () => {
    // Installation le mercredi 4 novembre : 5 jours décomptés en semaine 45.
    const t = at('2026-11-18', '09:00');
    const s = etat('2026-11-04', [fermer('2026-11-04'), ouvrir(t)]);
    const vue = vueRecapitulatif(s, t, catalog);
    expect(vue?.semaines[0]).toMatchObject({ lundi: '2026-11-02', tampons: 1, jours: 5 });
  });

  it('poussière : seulement le voile d’une semaine incomplète quand les derniers jours sont clôturés', () => {
    // Semaine 46 incomplète (lundi 9 oublié), puis mardi 17 et mercredi 18 clôturés.
    const t = at('2026-11-18', '22:00');
    const s = etat('2026-11-02', [
      ...semaine45(12000),
      ...['10', '11', '12', '13', '14', '15', '16', '17', '18'].map((j) => fermer(`2026-11-${j}`)),
      ouvrir(t),
    ]);
    expect(vueRecapitulatif(s, t, catalog)?.poussiere).toEqual({
      niveau: 1,
      joursSansCloture: false,
      semaineIncomplete: true,
    });
  });
});

describe('bilan d’une semaine (E6, J3.2, #62)', () => {
  const jours45 = ['02', '03', '04', '05', '06', '07', '08'].map((j) => `2026-11-${j}`);
  /** Semaine 45 : `depense` le mardi 3, chaque jour clôturé le soir sauf `sauf`. */
  const semaine45 = (depense: number, sauf: DayKey[] = []) =>
    etat('2026-11-02', [
      ...(depense > 0 ? [depenser('2026-11-03', depense)] : []),
      ...jours45.filter((j) => !sauf.includes(j)).map((j) => fermer(j)),
      ouvrir(at('2026-11-10', '09:00')),
    ]);
  const rateau = {
    id: 'rateau-porte-bonheur-kumade',
    nom: 'râteau porte-bonheur kumade',
    article: 'le',
    genre: 'm',
  };
  const echelle = { id: 'echelle', nom: 'échelle', article: "l'", genre: 'f' };

  it('tous les tampons, dans le budget : l’objet sort de sa capsule (scénario 1)', () => {
    expect(vueBilanSemaine(semaine45(12000), catalog)).toEqual({
      semaine: '2026-W45',
      lundi: '2026-11-02',
      tampons: 7,
      jours: 7,
      enveloppe: 14000,
      depense: 12000,
      dansLeBudget: true,
      complete: true,
      objet: rateau,
      enAttente: null,
      fele: null,
    });
  });

  it('tous les tampons, hors budget : l’objet sort et l’échelle se fêle (scénario 2)', () => {
    expect(vueBilanSemaine(semaine45(15000), catalog)).toMatchObject({
      complete: true,
      dansLeBudget: false,
      objet: rateau,
      fele: echelle,
    });
  });

  it('tampons manquants, dans le budget : ni objet ni fêlure (scénario 3)', () => {
    expect(vueBilanSemaine(semaine45(10000, ['2026-11-04']), catalog)).toMatchObject({
      tampons: 6,
      jours: 7,
      complete: false,
      dansLeBudget: true,
      objet: null,
      fele: null,
    });
  });

  it('tampons manquants, hors budget : pas d’objet, l’échelle se fêle (scénario 4)', () => {
    expect(vueBilanSemaine(semaine45(15000, ['2026-11-04']), catalog)).toMatchObject({
      complete: false,
      objet: null,
      fele: echelle,
    });
  });

  it('une semaine sans tampon ni dépense ne donne ni objet ni fêlure', () => {
    expect(vueBilanSemaine(semaine45(0, jours45), catalog)).toMatchObject({
      tampons: 0,
      depense: 0,
      complete: false,
      objet: null,
      fele: null,
    });
  });

  it('compte les jours décomptés la semaine de l’installation (scénario 7)', () => {
    const s = etat('2026-11-05', [
      depenser('2026-11-05', 7000),
      ...['05', '06', '07', '08'].map((j) => fermer(`2026-11-${j}`)),
      ouvrir(at('2026-11-09', '09:00')),
    ]);
    expect(vueBilanSemaine(s, catalog)).toMatchObject({
      tampons: 4,
      jours: 4,
      enveloppe: 8000,
      objet: rateau,
    });
  });

  it('dit l’objet en attente de sa pièce (scénario 18)', () => {
    const jours: DayKey[] = [];
    for (let j = 23; j <= 30; j++) jours.push(`2026-11-${j}`);
    for (let j = 1; j <= 6; j++) jours.push(`2026-12-0${j}`);
    let s = etat(
      '2026-11-23',
      jours.slice(0, 7).map((j) => fermer(j)),
    );
    s = process(s, { type: 'week_reviews_seen' }, at('2026-11-29', '21:01'), catalog).state;
    for (const j of jours.slice(7))
      s = process(s, { type: 'close_day', day: j }, at(j), catalog).state;
    expect(vueBilanSemaine(s, catalog)).toMatchObject({
      semaine: '2026-W49',
      objet: { id: 'mortier-et-maillet-a-mochi', article: 'le' },
      enAttente: { moisPiece: '2026-12', moisBilan: '2026-11' },
    });
  });

  it('rien quand aucune semaine n’attend, ou quand c’est le récapitulatif', () => {
    expect(vueBilanSemaine(etat('2026-11-02', []), catalog)).toBeNull();
    const s = etat('2026-11-02', [ouvrir(at('2026-11-18', '09:00'))]);
    expect(bilansAAfficher(s).semaines?.kind).toBe('recap');
    expect(vueBilanSemaine(s, catalog)).toBeNull();
  });
});

describe('objets réparés par une clôture (#66)', () => {
  const jours = (du: number, au: number): DayKey[] =>
    Array.from({ length: au - du + 1 }, (_, i) => `2026-11-${String(du + i).padStart(2, '0')}`);
  /** Scénario 10 : semaine 45 complète, 150 € : le 3e objet de base de novembre se fêle. */
  const felee = (): AppState =>
    etat('2026-11-02', [depenser('2026-11-02', 15000), ...jours(2, 8).map((d) => fermer(d))]);

  it('rien tant que la série n’a pas 7 jours', () => {
    let s = felee();
    for (const d of jours(9, 14)) {
      const avant = s;
      s = process(s, { type: 'close_day', day: d }, at(d), catalog).state;
      expect(objetsReparesEntre(avant, s, catalog)).toEqual([]);
    }
  });

  it('la clôture du dimanche 15 répare l’objet : il est nommé avec son article et son genre', () => {
    let s = felee();
    for (const d of jours(9, 14))
      s = process(s, { type: 'close_day', day: d }, at(d), catalog).state;
    const avant = s;
    s = process(s, { type: 'close_day', day: '2026-11-15' }, at('2026-11-15'), catalog).state;
    expect(objetsReparesEntre(avant, s, catalog)).toEqual([
      { id: 'echelle', nom: 'échelle', article: "l'", genre: 'f' },
    ]);
    // Une ouverture qui suit ne répare rien de plus.
    const apres = process(s, { type: 'open' }, at('2026-11-16', '08:00'), catalog).state;
    expect(objetsReparesEntre(s, apres, catalog)).toEqual([]);
  });

  it('une clôture de rattrapage peut compléter la série (scénario 11)', () => {
    let s = felee();
    // Mercredi 11 oublié, rattrapé le jeudi 12 au matin : la série du 9 au 15 se complète le 15.
    for (const d of [
      '2026-11-09',
      '2026-11-10',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
    ])
      s = process(s, { type: 'close_day', day: d }, at(d), catalog).state;
    const avant = s;
    s = process(
      s,
      { type: 'close_day', day: '2026-11-11' },
      at('2026-11-16', '09:00'),
      catalog,
    ).state;
    expect(objetsReparesEntre(avant, s, catalog).map((o) => o.id)).toEqual(['echelle']);
  });

  it('sans état d’avant, rien n’est annoncé', () => {
    expect(objetsReparesEntre(null, felee(), catalog)).toEqual([]);
  });
});

describe('explication de la pièce qui s’ouvre (#66)', () => {
  it('suit la fête quand le catalogue la donne', () => {
    const avecExplication: Catalog = {
      ...catalog,
      rooms: catalog.rooms.map((r) =>
        r.month === 12 ? { ...r, explanation: 'La doma est la salle en terre battue.' } : r,
      ),
    };
    const decembre = at('2026-12-01', '09:00');
    let s = etat('2026-11-02', [ouvrir(decembre)]);
    s = process(
      s,
      { type: 'validate_month', month: '2026-11', resolution: '' },
      decembre,
      avecExplication,
    ).state;
    expect(piecesOuvertesParBilan(s, '2026-11', avecExplication)).toEqual([
      {
        mois: '2026-12',
        fete: 'Ōmisoka, le réveillon',
        explication: 'La doma est la salle en terre battue.',
      },
    ]);
    expect(piecesOuvertesParBilan(s, '2026-11', catalog)[0]).not.toHaveProperty('explication');
  });
});
