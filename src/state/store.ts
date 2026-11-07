// Store de l'état de l'interface (Zustand). Les écrans ne parlent qu'à lui ; lui seul appelle
// le domaine (process) et les dépôts. L'heure vient de l'horloge (clock.ts), jamais du système.
import { createStore } from 'zustand/vanilla';

import type { DayClosureRow, ExpenseRow, Repositories } from '../data/repositories';
import { MIGRATIONS } from '../data/migrations';
import { weekDays, weekOf } from '../domain/calendrier';
import { isValidNote } from '../domain/depense';
import type { Catalog } from '../domain/objets';
import type { LocalDateTime } from '../domain/scellement';
import {
  type AppEvent,
  type AppState,
  type Refusal,
  createAppState,
  process,
} from '../domain/traitement';
import type { Horloge } from './clock';
import { type Charge, charger, persister } from './persistance';
import { estRattrapable } from './selecteurs';
import { heureLocale, instantLocal } from './temps';

export interface DependancesStore {
  depots: () => Promise<Repositories>;
  catalogue: Catalog;
  horloge: Pick<Horloge, 'now' | 'actif'>;
  nouvelId: () => string;
}

export interface NouvelleDepense {
  /** Absent pour un ajout ; l'identifiant d'une dépense existante pour la modifier. */
  id?: string;
  day: string;
  amount: number;
  category: ExpenseRow['category'];
  note: string;
}

/** Refus d'une dépense : ceux du domaine, et une note trop longue. */
export type RefusDepense = Refusal | 'note_too_long';

export interface EtatKakeibo {
  pret: boolean;
  etat: AppState | null;
  /** Dépenses complètes, dans l'ordre des jours. */
  depenses: ExpenseRow[];
  clotures: DayClosureRow[];
  /** Heure locale du dernier traitement. */
  maintenant: LocalDateTime | null;
  ouvrir(): Promise<void>;
  enregistrerDepense(depense: NouvelleDepense): Promise<RefusDepense | null>;
  /** Nouvelle dépense (E3) : rend son identifiant, pour pouvoir l'annuler. */
  noterDepense(
    depense: Omit<NouvelleDepense, 'id'>,
  ): Promise<{ id: string; refusal: RefusDepense | null }>;
  supprimerDepense(id: string): Promise<Refusal | null>;
  /**
   * Avant d'ouvrir E4 ou E5 sur un jour : traite l'ouverture à l'heure actuelle (scellements
   * compris), puis dit si ce jour s'ouvre, comme aujourd'hui ou en rattrapage. Null s'il ne
   * s'ouvre pas : jour clôturé, futur, avant l'installation ou d'une semaine scellée.
   */
  ouvrirJour(day: string): Promise<'aujourdhui' | 'rattrapage' | null>;
  /** Clôture « J'ai tout noté », ou « Rien dépensé » si le jour n'a aucune dépense. */
  cloturerJour(day: string): Promise<Refusal | null>;
  marquerBilansVus(): Promise<void>;
  /** Réglage caché des builds de développement, en attendant E1 (J5). */
  poserBudgetDemo(): Promise<boolean>;
}

/** Budget de démonstration : 1 200 € de revenus, 600 € de charges fixes, 0 € d'épargne. */
export const BUDGET_DEMO = { income: 120000, fixedCosts: 60000, savingsGoal: 0 } as const;

const parJour = (a: ExpenseRow, b: ExpenseRow): number =>
  a.day < b.day
    ? -1
    : a.day > b.day
      ? 1
      : a.created_at < b.created_at
        ? -1
        : a.created_at > b.created_at
          ? 1
          : 0;

export function createKakeiboStore(deps: DependancesStore) {
  let depots: Promise<Repositories> | null = null;
  const repos = () => (depots ??= deps.depots());
  // Une action à la fois : chaque traitement part de l'état laissé par le précédent.
  let file: Promise<unknown> = Promise.resolve();
  const enFile = <T>(f: () => Promise<T>): Promise<T> => {
    const suite = file.then(f);
    file = suite.catch(() => undefined);
    return suite;
  };

  const store = createStore<EtatKakeibo>()((set, get) => {
    /** Première ouverture : installation au jour du téléphone, sans budget (E1 viendra en J5). */
    async function installer(r: Repositories): Promise<Charge> {
      const t = deps.horloge.now();
      const maintenant = heureLocale(t);
      const settings = {
        id: 1,
        install_id: deps.nouvelId(),
        install_day: maintenant.day,
        reminder_time: '21:00',
        reminder_enabled: 1,
        trial_start: null,
        plan: 'trial' as const,
        seen_explanations: '[]',
        schema_version: MIGRATIONS.length,
      };
      const etat = createAppState(
        { installDay: maintenant.day, at: maintenant, budgets: [] },
        deps.catalogue,
      );
      await r.transaction(async () => {
        await r.settings.save(settings);
        await persister(r, null, etat, { clotures: [] });
      });
      return { settings, etat, depenses: [], clotures: [] };
    }

    /** Charge l'état au premier appel, sans traitement. */
    async function etatCourant(r: Repositories): Promise<AppState> {
      const deja = get().etat;
      if (deja !== null) return deja;
      const charge = (await charger(r, deps.catalogue)) ?? (await installer(r));
      set({ etat: charge.etat, depenses: charge.depenses, clotures: charge.clotures });
      return charge.etat;
    }

    /**
     * Applique un événement par process, puis enregistre le résultat dans une seule transaction :
     * les étapes liées au temps (scellements, réparations) même si l'événement est refusé, et
     * `ecrire` seulement s'il est accepté.
     */
    function traiter(
      evenement: AppEvent | ((etat: AppState) => AppEvent),
      ecrire?: (
        r: Repositories,
        instant: string,
        maintenant: LocalDateTime,
      ) => Promise<{
        depenses?: ExpenseRow[];
        clotures?: DayClosureRow[];
      }>,
      avantTraitement?: (etat: AppState) => AppState,
    ): Promise<Refusal | null> {
      return enFile(async () => {
        const r = await repos();
        const charge = await etatCourant(r);
        const t = deps.horloge.now();
        const maintenant = heureLocale(t);
        const avant = avantTraitement ? avantTraitement(charge) : charge;
        const ev = typeof evenement === 'function' ? evenement(avant) : evenement;
        const { state, refusal } = process(avant, ev, maintenant, deps.catalogue);
        let maj: { depenses?: ExpenseRow[]; clotures?: DayClosureRow[] } = {};
        await r.transaction(async () => {
          if (refusal === null && ecrire) maj = await ecrire(r, instantLocal(t), maintenant);
          await persister(r, charge, state, {
            clotures: refusal === null ? (maj.clotures ?? []) : [],
          });
        });
        set((s) => ({
          pret: true,
          etat: state,
          maintenant,
          depenses: maj.depenses ?? s.depenses,
          clotures: maj.clotures ? [...s.clotures, ...maj.clotures] : s.clotures,
        }));
        return refusal;
      });
    }

    return {
      pret: false,
      etat: null,
      depenses: [],
      clotures: [],
      maintenant: null,

      ouvrir: async () => {
        await traiter({ type: 'open' });
      },

      ouvrirJour: async (day) => {
        await traiter({ type: 'open' });
        const { etat, maintenant } = get();
        if (etat === null || maintenant === null) return null;
        if (day === maintenant.day) return 'aujourdhui';
        return estRattrapable(etat, day, maintenant) ? 'rattrapage' : null;
      },

      enregistrerDepense: (d) => {
        const id = d.id ?? deps.nouvelId();
        if (!isValidNote(d.note)) return Promise.resolve('note_too_long');
        return traiter(
          { type: 'save_expense', expense: { id, day: d.day, amount: d.amount } },
          async (r, instant) => {
            const ancienne = get().depenses.find((x) => x.id === id);
            const ligne: ExpenseRow = {
              id,
              day: d.day,
              amount: d.amount,
              category: d.category,
              note: d.note,
              created_at: ancienne?.created_at ?? instant,
              updated_at: instant,
            };
            await r.expenses.save(ligne);
            const autres = get().depenses.filter((x) => x.id !== id);
            return { depenses: [...autres, ligne].sort(parJour) };
          },
        );
      },

      noterDepense: async (d) => {
        const id = deps.nouvelId();
        const refusal = await get().enregistrerDepense({ ...d, id });
        return { id, refusal };
      },

      supprimerDepense: (id) =>
        traiter({ type: 'delete_expense', id }, async (r) => {
          await r.expenses.remove(id);
          return { depenses: get().depenses.filter((x) => x.id !== id) };
        }),

      cloturerJour: (day) =>
        traiter({ type: 'close_day', day }, async (_r, instant) => {
          const kind = get().depenses.some((x) => x.day === day) ? 'complete' : 'no_spend';
          return { clotures: [{ day, closed_at: instant, kind }] };
        }),

      marquerBilansVus: async () => {
        await traiter({ type: 'week_reviews_seen' });
      },

      poserBudgetDemo: async () => {
        if (!deps.horloge.actif) return false;
        let pose = false;
        await traiter({ type: 'open' }, undefined, (etat) => {
          if (etat.budgets.length > 0) return etat;
          pose = true;
          // En vigueur dès le lundi de la semaine d'installation : l'enveloppe d'une semaine
          // suit la version en vigueur le lundi 00:00, et seuls les jours décomptés comptent.
          const lundi = weekDays(weekOf(etat.installDay))[0];
          return {
            ...etat,
            budgets: [
              {
                id: deps.nouvelId(),
                month: etat.installDay.slice(0, 7),
                ...BUDGET_DEMO,
                effectiveFrom: lundi,
              },
            ],
          };
        });
        return pose;
      },
    };
  });
  return store;
}

export type KakeiboStore = ReturnType<typeof createKakeiboStore>;
