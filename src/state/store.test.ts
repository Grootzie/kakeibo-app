// Store de l'état (J2.1) : charge l'état depuis les dépôts, appelle process(état, événement, heure)
// à l'ouverture, à chaque dépense ajoutée, modifiée ou supprimée et à chaque clôture, puis enregistre.
import { readFileSync } from 'fs';
import { join } from 'path';

import catalogueJson from '../content/catalogue.json';
import { migrate } from '../data/migrations';
import { type Repositories, createRepositories } from '../data/repositories';
import { createTestDb } from '../data/testDb';
import { addDays } from '../domain/calendrier';
import type { Catalog } from '../domain/objets';
import { createClock } from './clock';
import { casesSemaine, enveloppeSemaine } from './selecteurs';
import { type DependancesStore, createKakeiboStore } from './store';

const catalogue = catalogueJson as Catalog;
const baseNovembre = catalogue.items.filter((i) => i.room === 'room-11' && i.source === 'base');
const gainsNovembre = catalogue.items.filter((i) => i.room === 'room-11' && i.source === 'weekly');

/** Heure locale du téléphone, réglable par le test. */
function telephone(debut: Date) {
  let reel = debut;
  const horloge = createClock({ actif: true, reel: () => reel });
  return {
    horloge,
    regler: (annee: number, mois: number, jour: number, h = 21, m = 0) => {
      horloge.reinitialiser();
      reel = new Date(annee, mois - 1, jour, h, m);
    },
  };
}

const budgetNovembre = (repos: Repositories) =>
  repos.budgetVersions.add({
    id: 'b-nov',
    month: '2026-11',
    income: 200000,
    fixed_costs: 110000,
    savings_goal: 30000,
    effective_from: '2026-11-02',
  });

async function monter(options: { dev?: boolean; debut?: Date; budget?: boolean } = {}) {
  const db = createTestDb();
  await migrate(db);
  const repos = createRepositories(db);
  const tel = telephone(options.debut ?? new Date(2026, 10, 2, 8, 0));
  let n = 0;
  const deps: DependancesStore = {
    depots: async () => repos,
    catalogue,
    horloge:
      options.dev === false
        ? createClock({ actif: false, reel: () => tel.horloge.now() })
        : tel.horloge,
    nouvelId: () => `id-${++n}`,
  };
  /** Un second store sur la même base : ce qu'on retrouve à la prochaine ouverture. */
  const rouvrir = async () => {
    const autre = createKakeiboStore(deps);
    await autre.getState().ouvrir();
    return autre;
  };
  let store = createKakeiboStore(deps);
  if (options.budget === true) {
    // Installation, puis budget de novembre posé avant la prochaine ouverture.
    await store.getState().ouvrir();
    await budgetNovembre(repos);
    store = await rouvrir();
  }
  return { store, repos, tel, rouvrir };
}

describe('store de l’état', () => {
  test('à la première ouverture, installe l’appli au jour du téléphone et l’enregistre', async () => {
    const { store, repos } = await monter();
    await store.getState().ouvrir();
    expect(store.getState().pret).toBe(true);
    expect(await repos.settings.get()).toMatchObject({
      install_day: '2026-11-02',
      install_id: 'id-1',
      reminder_time: '21:00',
      plan: 'trial',
    });
    expect(await repos.unlockedRooms.all()).toEqual([
      { year: 2026, room_id: 'room-11', unlocked_at: '2026-11-02T08:00' },
    ]);
    expect((await repos.ownedItems.all()).map((o) => o.item_id).sort()).toEqual(
      baseNovembre.map((i) => i.id).sort(),
    );
    expect(store.getState().etat?.installDay).toBe('2026-11-02');
  });

  test('une nouvelle ouverture retrouve exactement le même état', async () => {
    const { store, rouvrir } = await monter();
    await store.getState().ouvrir();
    const autre = await rouvrir();
    expect(autre.getState().etat).toEqual(store.getState().etat);
  });

  test('ajouter, modifier et supprimer une dépense passe par process et s’enregistre', async () => {
    const { store, repos, tel } = await monter({ budget: true });
    tel.regler(2026, 11, 3, 12, 30);
    const refus = await store
      .getState()
      .enregistrerDepense({ day: '2026-11-03', amount: 1250, category: 'essentiel', note: 'pain' });
    expect(refus).toBeNull();
    const [ligne] = await repos.expenses.all();
    expect(ligne).toMatchObject({ id: 'id-2', day: '2026-11-03', amount: 1250, note: 'pain' });
    expect(store.getState().depenses).toEqual([ligne]);
    expect(enveloppeSemaine(store.getState().etat!, store.getState().maintenant!)).toMatchObject({
      enveloppe: 14000,
      depense: 1250,
      reste: 12750,
    });

    tel.regler(2026, 11, 3, 18, 0);
    await store.getState().enregistrerDepense({
      id: 'id-2',
      day: '2026-11-03',
      amount: 990,
      category: 'envies',
      note: '',
    });
    const [modifiee] = await repos.expenses.all();
    expect(modifiee).toMatchObject({
      amount: 990,
      category: 'envies',
      created_at: ligne.created_at,
    });
    expect(modifiee.updated_at).not.toBe(ligne.updated_at);
    expect(store.getState().etat?.expenses).toEqual([
      { id: 'id-2', day: '2026-11-03', amount: 990 },
    ]);

    expect(await store.getState().supprimerDepense('id-2')).toBeNull();
    expect(await repos.expenses.all()).toEqual([]);
    expect(store.getState().depenses).toEqual([]);
    expect(store.getState().etat?.expenses).toEqual([]);
  });

  test('une dépense refusée par le domaine n’est pas enregistrée', async () => {
    const { store, repos, tel } = await monter();
    await store.getState().ouvrir();
    tel.regler(2026, 11, 9, 10, 0);
    const avant = await store
      .getState()
      .enregistrerDepense({ day: '2026-10-29', amount: 500, category: 'envies', note: '' });
    const futur = await store
      .getState()
      .enregistrerDepense({ day: '2026-11-10', amount: 500, category: 'envies', note: '' });
    expect([avant, futur]).toEqual(['before_install', 'future_day']);
    expect(await repos.expenses.all()).toEqual([]);
    expect(await store.getState().supprimerDepense('inconnue')).toBe('unknown_expense');
  });

  test('noter une dépense rend son identifiant, pour pouvoir l’annuler', async () => {
    const { store, repos, tel } = await monter({ budget: true });
    tel.regler(2026, 11, 3, 12, 30);
    const r = await store
      .getState()
      .noterDepense({ day: '2026-11-03', amount: 1250, category: 'culture', note: 'livre' });
    expect(r).toEqual({ id: 'id-2', refusal: null });
    expect(await repos.expenses.all()).toMatchObject([{ id: 'id-2', category: 'culture' }]);
    expect(await store.getState().supprimerDepense(r.id)).toBeNull();
    expect(await repos.expenses.all()).toEqual([]);
  });

  test('une note de plus de 80 caractères ou un montant hors bornes ne s’enregistrent pas', async () => {
    const { store, repos, tel } = await monter({ budget: true });
    tel.regler(2026, 11, 3, 12, 30);
    const note = await store
      .getState()
      .noterDepense({ day: '2026-11-03', amount: 100, category: 'envies', note: 'a'.repeat(81) });
    const montant = await store
      .getState()
      .noterDepense({ day: '2026-11-03', amount: 0, category: 'envies', note: '' });
    expect([note.refusal, montant.refusal]).toEqual(['note_too_long', 'invalid_amount']);
    expect(await repos.expenses.all()).toEqual([]);
    expect(store.getState().etat?.expenses).toEqual([]);
  });

  test('la clôture s’enregistre, avec « rien dépensé » quand le jour n’a aucune dépense', async () => {
    const { store, repos, tel } = await monter();
    await store.getState().ouvrir();
    tel.regler(2026, 11, 2, 21, 0);
    await store
      .getState()
      .enregistrerDepense({ day: '2026-11-02', amount: 800, category: 'culture', note: '' });
    expect(await store.getState().cloturerJour('2026-11-02')).toBeNull();
    tel.regler(2026, 11, 3, 21, 0);
    expect(await store.getState().cloturerJour('2026-11-03')).toBeNull();
    expect(await store.getState().cloturerJour('2026-11-03')).toBe('already_closed');
    const clotures = await repos.dayClosures.all();
    expect(clotures.map((c) => [c.day, c.kind])).toEqual([
      ['2026-11-02', 'complete'],
      ['2026-11-03', 'no_spend'],
    ]);
    expect(clotures[1].closed_at).toMatch(/^2026-11-03T21:00:00/);
    expect(casesSemaine(store.getState().etat!, store.getState().maintenant!).slice(0, 3)).toEqual([
      { jour: '2026-11-02', statut: 'cloturee' },
      { jour: '2026-11-03', statut: 'cloturee' },
      { jour: '2026-11-04', statut: 'a_venir' },
    ]);
  });

  test('la 7e clôture scelle la semaine et enregistre résultat et capsule (scénario 1)', async () => {
    const { store, repos, tel, rouvrir } = await monter({ budget: true });
    tel.regler(2026, 11, 2, 12, 0);
    await store
      .getState()
      .enregistrerDepense({ day: '2026-11-02', amount: 12000, category: 'essentiel', note: '' });
    for (let j = '2026-11-02'; j <= '2026-11-08'; j = addDays(j, 1)) {
      const [a, m, d] = j.split('-').map(Number);
      tel.regler(a, m, d, 21, 0);
      expect(await store.getState().cloturerJour(j)).toBeNull();
    }
    expect(await repos.weekResults.all()).toEqual([
      expect.objectContaining({
        week: '2026-W45',
        stamps: 7,
        spent: 12000,
        envelope: 14000,
        complete: 1,
        gashapon_item: gainsNovembre[0].id,
        cracked_item: null,
        ceremony_seen: 0,
      }),
    ]);
    expect(await repos.ownedItems.all()).toContainEqual(
      expect.objectContaining({ item_id: gainsNovembre[0].id, source: 'weekly', week: '2026-W45' }),
    );
    expect((await rouvrir()).getState().etat).toEqual(store.getState().etat);
  });

  test('l’ouverture après le lundi 12:00 scelle la semaine, avec l’horloge avancée (scénario 3)', async () => {
    const { store, repos, tel } = await monter({ budget: true });
    for (const j of [
      '2026-11-02',
      '2026-11-03',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]) {
      const [a, m, d] = j.split('-').map(Number);
      tel.regler(a, m, d, 21, 0);
      await store.getState().cloturerJour(j);
    }
    expect(await repos.weekResults.all()).toEqual([]);
    tel.horloge.avancerJours(1); // lundi 9, 21:00
    await store.getState().ouvrir();
    expect(await repos.weekResults.all()).toEqual([
      expect.objectContaining({
        week: '2026-W45',
        sealed_at: '2026-11-09T12:00',
        stamps: 6,
        complete: 0,
      }),
    ]);
    expect(store.getState().etat?.unseenWeeks).toEqual(['2026-W45']);
  });

  test('fêlure puis réparation enregistrées et relues à l’identique (scénarios 2 et 10)', async () => {
    const { store, repos, tel, rouvrir } = await monter({ budget: true });
    tel.regler(2026, 11, 2, 12, 0);
    await store
      .getState()
      .enregistrerDepense({ day: '2026-11-02', amount: 15000, category: 'envies', note: '' });
    for (let j = '2026-11-02'; j <= '2026-11-15'; j = addDays(j, 1)) {
      const [a, m, d] = j.split('-').map(Number);
      tel.regler(a, m, d, 21, 0);
      expect(await store.getState().cloturerJour(j)).toBeNull();
      if (j === '2026-11-08') {
        expect(await repos.ownedItems.all()).toContainEqual(
          expect.objectContaining({
            item_id: baseNovembre[2].id,
            state: 'cracked',
            cracked_week: '2026-W45',
            cracked_at: '2026-11-08T21:00',
          }),
        );
      }
    }
    expect(await repos.ownedItems.all()).toContainEqual(
      expect.objectContaining({
        item_id: baseNovembre[2].id,
        state: 'repaired',
        cracked_week: '2026-W45',
        repaired_at: '2026-11-15',
      }),
    );
    expect((await rouvrir()).getState().etat).toEqual(store.getState().etat);
  });

  test('les bilans de semaine vus sont enregistrés', async () => {
    const { store, repos, tel, rouvrir } = await monter();
    await store.getState().ouvrir();
    tel.regler(2026, 11, 10, 9, 0);
    await store.getState().ouvrir();
    expect(store.getState().etat?.unseenWeeks).toEqual(['2026-W45']);
    await store.getState().marquerBilansVus();
    expect(await repos.weekResults.all()).toEqual([expect.objectContaining({ ceremony_seen: 1 })]);
    expect((await rouvrir()).getState().etat?.unseenWeeks).toEqual([]);
  });

  test('les actions simultanées s’enregistrent toutes, l’une après l’autre', async () => {
    const { store, repos, tel } = await monter();
    await store.getState().ouvrir();
    tel.regler(2026, 11, 3, 12, 0);
    const s = store.getState();
    await Promise.all(
      [100, 200, 300].map((amount) =>
        s.enregistrerDepense({ day: '2026-11-03', amount, category: 'envies', note: '' }),
      ),
    );
    expect((await repos.expenses.all()).map((e) => e.amount).sort()).toEqual([100, 200, 300]);
    expect(store.getState().etat?.expenses).toHaveLength(3);
  });

  describe('budget de démonstration', () => {
    test('pose 1 200 € de revenus, 600 € de charges fixes et 0 € d’épargne dès l’installation', async () => {
      const { store, repos } = await monter({ debut: new Date(2026, 10, 6, 9, 0) });
      await store.getState().ouvrir();
      expect(await store.getState().poserBudgetDemo()).toBe(true);
      expect(await repos.budgetVersions.all()).toEqual([
        {
          id: expect.any(String),
          month: '2026-11',
          income: 120000,
          fixed_costs: 60000,
          savings_goal: 0,
          effective_from: '2026-11-02',
        },
      ]);
      // 600 € par mois, 20 € par jour décompté : vendredi, samedi et dimanche.
      expect(enveloppeSemaine(store.getState().etat!, store.getState().maintenant!)).toMatchObject({
        enveloppe: 6000,
      });
    });

    test('ne se pose qu’une fois : un budget existant n’est jamais remplacé', async () => {
      const { store, repos } = await monter();
      await store.getState().ouvrir();
      expect(await store.getState().poserBudgetDemo()).toBe(true);
      expect(await store.getState().poserBudgetDemo()).toBe(false);
      expect(await repos.budgetVersions.all()).toHaveLength(1);
    });

    test('est inactif dans un build publié', async () => {
      const { store, repos } = await monter({ dev: false });
      await store.getState().ouvrir();
      expect(await store.getState().poserBudgetDemo()).toBe(false);
      expect(await repos.budgetVersions.all()).toEqual([]);
    });
  });

  describe('ouvrir un jour à rattraper (E5, #46)', () => {
    /** Installation le lundi 2 ; le mercredi 4 reste sans tampon. */
    async function sansMercredi() {
      const m = await monter({ budget: true });
      for (const j of ['2026-11-02', '2026-11-03']) {
        const [a, mo, d] = j.split('-').map(Number);
        m.tel.regler(a, mo, d, 21, 0);
        await m.store.getState().cloturerJour(j);
      }
      return m;
    }

    test('dimanche soir et lundi 11:59, le mercredi s’ouvre en rattrapage', async () => {
      const { store, tel } = await sansMercredi();
      tel.regler(2026, 11, 8, 23, 50);
      expect(await store.getState().ouvrirJour('2026-11-04')).toBe('rattrapage');
      tel.regler(2026, 11, 9, 11, 59);
      expect(await store.getState().ouvrirJour('2026-11-04')).toBe('rattrapage');
      expect(store.getState().maintenant).toEqual({ day: '2026-11-09', time: '11:59' });
    });

    test('lundi 12:00, il ne s’ouvre plus : l’ouverture scelle d’abord la semaine', async () => {
      const { store, repos, tel } = await sansMercredi();
      tel.regler(2026, 11, 9, 12, 0);
      expect(await store.getState().ouvrirJour('2026-11-04')).toBeNull();
      expect(await repos.weekResults.all()).toEqual([
        expect.objectContaining({ week: '2026-W45', stamps: 2 }),
      ]);
    });

    test('aujourd’hui s’ouvre en clôture du jour ; un jour clôturé ou futur ne s’ouvre pas', async () => {
      const { store, tel } = await sansMercredi();
      tel.regler(2026, 11, 6, 21, 0);
      expect(await store.getState().ouvrirJour('2026-11-06')).toBe('aujourdhui');
      expect(await store.getState().ouvrirJour('2026-11-03')).toBeNull();
      expect(await store.getState().ouvrirJour('2026-11-07')).toBeNull();
    });
  });

  test('l’heure vient uniquement de l’horloge de src/state/clock.ts', () => {
    for (const f of ['store.ts', 'selecteurs.ts', 'persistance.ts']) {
      const source = readFileSync(join(__dirname, f), 'utf8');
      expect({ f, horlogeSysteme: /new Date\(\)|Date\.now/.test(source) }).toEqual({
        f,
        horlogeSysteme: false,
      });
    }
  });
});
