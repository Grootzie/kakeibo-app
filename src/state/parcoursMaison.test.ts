// Critère de J4 (#88) : les parcours Maestro « maison » et « poussière » rejoués ici avec le vrai
// store, une base de test et l'horloge de test, aux mêmes jours et aux mêmes heures que sur
// l'émulateur. Ce que les parcours vérifient à l'écran (descriptions de la maison, libellés des
// objets dans E8, annonce de la réparation) est vérifié ici d'abord, texte pour texte.
import catalogueJson from '../content/catalogue.json';
import { migrate } from '../data/migrations';
import { createRepositories } from '../data/repositories';
import { createTestDb } from '../data/testDb';
import type { Catalog } from '../domain/objets';
import { fr } from '../i18n/fr';
import { type Horloge, createClock } from './clock';
import { vueEcranMaison } from './ecranMaison';
import { maisonAccueil } from './maison';
import { objetsReparesEntre } from './selecteurs';
import { type KakeiboStore, createKakeiboStore } from './store';

const NBSP = ' ';
const catalogue = catalogueJson as Catalog;
const KUMADE = 'rateau-porte-bonheur-kumade';

interface Parcours {
  store: KakeiboStore;
  horloge: Horloge;
}

/**
 * Comme tools/parcours-android.sh : appli effacée, téléphone au mercredi 4 novembre 2026 à 9:00 ;
 * budget de démonstration posé par le réglage caché (1 200 € de revenus, 600 € de charges fixes).
 */
async function installer(): Promise<Parcours> {
  const db = createTestDb();
  await migrate(db);
  const repos = createRepositories(db);
  const reel = new Date(2026, 10, 4, 9, 0);
  let n = 0;
  const horloge = createClock({ actif: true, reel: () => reel });
  const store = createKakeiboStore({
    depots: async () => repos,
    catalogue,
    horloge,
    nouvelId: () => `id-${++n}`,
  });
  await store.getState().ouvrir();
  expect(await store.getState().poserBudgetDemo()).toBe(true);
  return { store, horloge };
}

/** « +1 jour » de l'horloge de test : l'accueil se recharge à la nouvelle heure. */
async function plusUnJour(p: Parcours, n = 1): Promise<void> {
  for (let i = 0; i < n; i++) {
    p.horloge.avancerJours(1);
    await p.store.getState().ouvrir();
  }
}

function aujourdhui(p: Parcours): string {
  const m = p.store.getState().maintenant;
  if (m === null) throw new Error('store pas ouvert');
  return m.day;
}

/** « Clôturer ma journée » puis « Rien dépensé aujourd’hui » (ou « J’ai tout noté »). */
async function cloturer(p: Parcours): Promise<string[]> {
  const avant = p.store.getState().etat;
  expect(await p.store.getState().cloturerJour(aujourdhui(p))).toBeNull();
  const apres = p.store.getState().etat;
  if (avant === null || apres === null) throw new Error('store pas ouvert');
  return objetsReparesEntre(avant, apres, catalogue).map((o) => fr.messages.reparation(o));
}

function libellesE8(p: Parcours): string[] {
  const { etat, maintenant } = p.store.getState();
  if (etat === null || maintenant === null) throw new Error('store pas ouvert');
  return vueEcranMaison(etat, catalogue, maintenant).pieces.flatMap((piece) =>
    piece.objets.map((o) => fr.ecranMaison.objetLibelle(o.nom, o.etat, o.reparation)),
  );
}

function descriptionAccueil(p: Parcours): string {
  const { etat, maintenant } = p.store.getState();
  if (etat === null || maintenant === null) throw new Error('store pas ouvert');
  const vue = maisonAccueil(etat, catalogue, maintenant);
  if (vue === null) throw new Error('pas de maison');
  return vue.pieces[vue.courante]?.description ?? '';
}

function poussiereAccueil(p: Parcours) {
  const { etat, maintenant } = p.store.getState();
  if (etat === null || maintenant === null) throw new Error('store pas ouvert');
  return maisonAccueil(etat, catalogue, maintenant)?.poussiere;
}

describe('parcours « maison » (#88) : intact, fêlé, réparé à l’or', () => {
  it('le kumade gagné semaine du 2 novembre, fêlé le 15, réparé à l’or le 22', async () => {
    const p = await installer();

    // Semaine 45, du mercredi 4 au dimanche 8 : chaque jour clôturé, rien dépensé.
    for (let jour = 4; jour <= 8; jour++) {
      if (jour > 4) await plusUnJour(p);
      expect(aujourdhui(p)).toBe(`2026-11-0${jour}`);
      expect(await cloturer(p)).toEqual([]);
    }
    // Le bilan s'ouvre : tous les jetons, dans le budget, le kumade entre, rien ne se fêle.
    expect(p.store.getState().etat?.results.map((r) => [r.week, r.gashaponItem])).toEqual([
      ['2026-W45', KUMADE],
    ]);
    expect(libellesE8(p)).toEqual([
      'Les étagères, intactes',
      'Le coffre nagamochi, intact',
      'L’échelle, intacte',
      'Le râteau porte-bonheur kumade, intact',
    ]);
    expect(descriptionAccueil(p)).toBe(
      'Kura, la réserve, novembre 2026. Les étagères. Le coffre nagamochi. L’échelle. ' +
        'Le râteau porte-bonheur kumade. 3 emplacements libres. La maison est propre.',
    );

    // Semaine 46, du lundi 9 au dimanche 15 : 150 € notés le lundi pour une enveloppe de
    // 140 €, chaque jour clôturé.
    await plusUnJour(p);
    expect(aujourdhui(p)).toBe('2026-11-09');
    const { refusal } = await p.store
      .getState()
      .noterDepense({ day: '2026-11-09', amount: 15000, category: 'essentiel', note: '' });
    expect(refusal).toBeNull();
    for (let jour = 9; jour <= 15; jour++) {
      if (jour > 9) await plusUnJour(p);
      expect(await cloturer(p)).toEqual([]);
    }
    // Hors budget, tous les jetons : un objet entre et le kumade, le plus récent, se fêle.
    const resultat46 = p.store.getState().etat?.results.find((r) => r.week === '2026-W46');
    expect(resultat46?.inBudget).toBe(false);
    expect(resultat46?.crackedItem).toBe(KUMADE);
    expect(resultat46?.gashaponItem).toBe('chat-porte-bonheur');
    expect(libellesE8(p)).toContain(
      `Le râteau porte-bonheur kumade, fêlé, réparation${NBSP}: 0 jour sur 7`,
    );

    // Lundi 16, mardi 17, mercredi 18 : trois jours de la série, capture « fêlé ».
    for (let jour = 16; jour <= 18; jour++) {
      await plusUnJour(p);
      expect(await cloturer(p)).toEqual([]);
    }
    expect(aujourdhui(p)).toBe('2026-11-18');
    expect(libellesE8(p)).toContain(
      `Le râteau porte-bonheur kumade, fêlé, réparation${NBSP}: 3 jours sur 7`,
    );
    expect(descriptionAccueil(p)).toBe(
      'Kura, la réserve, novembre 2026. Les étagères. Le coffre nagamochi. L’échelle. ' +
        `Le râteau porte-bonheur kumade, fêlé, réparation${NBSP}: 3 jours sur 7. ` +
        'Le chat porte-bonheur. 2 emplacements libres. La maison est propre.',
    );

    // Jeudi 19 à dimanche 22 : la septième clôture répare le kumade à l'or et scelle la
    // semaine 47.
    for (let jour = 19; jour <= 21; jour++) {
      await plusUnJour(p);
      expect(await cloturer(p)).toEqual([]);
    }
    await plusUnJour(p);
    expect(aujourdhui(p)).toBe('2026-11-22');
    expect(await cloturer(p)).toEqual([
      'Réparé à l’or, le râteau porte-bonheur kumade garde la trace de cette semaine-là.',
    ]);
    expect(libellesE8(p)).toContain('Le râteau porte-bonheur kumade, réparé à l’or');
    expect(descriptionAccueil(p)).toBe(
      'Kura, la réserve, novembre 2026. Les étagères. Le coffre nagamochi. L’échelle. ' +
        'Le râteau porte-bonheur kumade, réparé à l’or. Le chat porte-bonheur. Le boulier soroban. ' +
        '1 emplacement libre. La maison est propre.',
    );
    expect(p.store.getState().etat?.results.map((r) => [r.week, r.gashaponItem])).toEqual([
      ['2026-W45', KUMADE],
      ['2026-W46', 'chat-porte-bonheur'],
      ['2026-W47', 'boulier-soroban'],
    ]);
  });
});

describe('parcours « poussière » (#88) : niveaux 0, 1 et 2, puis une clôture qui aère', () => {
  it('propre le mercredi, voile le vendredi, toile le dimanche, propre après la clôture', async () => {
    const p = await installer();
    const propre = `${fr.maison.poussiere[0]}.`;
    const voile = `${fr.maison.poussiere[1]}.`;
    const toile = `${fr.maison.poussiere[2]}.`;

    // Mercredi 4 : jour d'installation, niveau 0.
    expect(descriptionAccueil(p)).toMatch(new RegExp(`${propre}$`));
    expect(poussiereAccueil(p)).toEqual({ joursSansCloture: false, semaineIncomplete: false });

    // Jeudi 5 : mercredi sans clôture (J = 1), toujours niveau 0 ; mercredi est à rattraper.
    await plusUnJour(p);
    expect(aujourdhui(p)).toBe('2026-11-05');
    expect(descriptionAccueil(p)).toMatch(new RegExp(`${propre}$`));
    expect(poussiereAccueil(p)).toEqual({ joursSansCloture: false, semaineIncomplete: false });

    // Vendredi 6 : mercredi et jeudi sans clôture (J = 2), niveau 1.
    await plusUnJour(p);
    expect(aujourdhui(p)).toBe('2026-11-06');
    expect(descriptionAccueil(p)).toMatch(new RegExp(`${voile}$`));
    expect(poussiereAccueil(p)).toEqual({ joursSansCloture: true, semaineIncomplete: false });

    // Dimanche 8 : quatre jours sans clôture (J = 4), niveau 2.
    await plusUnJour(p, 2);
    expect(aujourdhui(p)).toBe('2026-11-08');
    expect(descriptionAccueil(p)).toMatch(new RegExp(`${toile}$`));
    expect(poussiereAccueil(p)).toEqual({ joursSansCloture: true, semaineIncomplete: false });

    // Clôturer aujourd'hui remet la maison à 0 : la semaine n'est pas encore scellée.
    await cloturer(p);
    expect(descriptionAccueil(p)).toMatch(new RegExp(`${propre}$`));
    expect(poussiereAccueil(p)).toEqual({ joursSansCloture: false, semaineIncomplete: false });
  });
});
