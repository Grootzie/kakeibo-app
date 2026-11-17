// Store de l'état de l'interface (Zustand). Les écrans ne parlent qu'à lui ; lui seul appelle
// le domaine (process) et les dépôts. L'heure vient de l'horloge (clock.ts), jamais du système.
import { createStore } from 'zustand/vanilla';

import type {
  DayClosureRow,
  ExpenseRow,
  RecurringChargeRow,
  Repositories,
} from '../data/repositories';
import { MIGRATIONS } from '../data/migrations';
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
import { fr } from '../i18n/fr';
import { heureValide } from './bienvenue';
import { type IdExplication, ecrireExplicationsVues, lireExplicationsVues } from './explications';
import { type Charge, chargeDepuisLigne, charger, persister } from './persistance';
import { type ReglagesRappel, type ServiceRappels, rappelsAPlanifier } from './rappel';
import { estRattrapable } from './selecteurs';
import { dateLocale, heureLocale, instantLocal } from './temps';

export interface DependancesStore {
  depots: () => Promise<Repositories>;
  catalogue: Catalog;
  horloge: Pick<Horloge, 'now' | 'actif' | 'decalageMs'>;
  nouvelId: () => string;
  /** Notifications locales du téléphone (rappel du soir) ; absent, aucun rappel. */
  rappels?: ServiceRappels;
}

export interface NouvelleDepense {
  /** Absent pour un ajout ; l'identifiant d'une dépense existante pour la modifier. */
  id?: string;
  day: string;
  amount: number;
  category: ExpenseRow['category'];
  note: string;
}

/** Revenus, charges fixes et épargne visée d'un mois, en centimes. */
export interface MontantsBudget {
  income: number;
  fixedCosts: number;
  savingsGoal: number;
}

/** Dépense récurrente saisie (E10, E9) : elle commence le jour de sa saisie. */
export interface NouvelleCharge {
  label: string;
  /** Montant d'une échéance, en centimes. */
  amount: number;
  frequency: RecurringChargeRow['frequency'];
  /** Jour de la semaine (1 = lundi … 7 = dimanche) ou du mois (1 à 31). */
  day: number;
}

/** Refus d'un changement de dépense récurrente : ceux du domaine, et une charge absente ou arrêtée. */
export type RefusCharge = Refusal | 'unknown_charge' | 'charge_stopped';

/** Refus d'une dépense : ceux du domaine, et une note trop longue. */
export type RefusDepense = Refusal | 'note_too_long';

/** Refus de la fin de la bienvenue (E1) : ceux du budget, et une heure de rappel illisible. */
export type RefusBienvenue = Refusal | 'invalid_reminder_time';

/** Ce que la bienvenue (E1) enregistre à la fin de ses quatre étapes. */
export interface FinBienvenue {
  budget: MontantsBudget;
  /** Heure du rappel du soir, HH:MM. */
  heureRappel: string;
}

/** Ce qu'une écriture acceptée change dans l'état de l'interface. */
interface MiseAJour {
  depenses?: ExpenseRow[];
  clotures?: DayClosureRow[];
  charges?: RecurringChargeRow[];
}

export interface EtatKakeibo {
  pret: boolean;
  /** Catalogue des pièces et des objets livré avec l'appli, pour nommer ce que l'état montre. */
  catalogue: Catalog;
  etat: AppState | null;
  /** Dépenses complètes, dans l'ordre des jours. */
  depenses: ExpenseRow[];
  clotures: DayClosureRow[];
  /** Dépenses récurrentes, arrêtées comprises (ends_on), dans l'ordre de leur début. */
  charges: RecurringChargeRow[];
  /** Heure locale du dernier traitement. */
  maintenant: LocalDateTime | null;
  /** Rappel du soir : reminder_time et reminder_enabled des réglages. */
  reglagesRappel: ReglagesRappel | null;
  /** Cartes de première fois déjà vues (settings.seen_explanations). */
  explicationsVues: string[];
  /** Horloge de test active : build de développement (réglages cachés des parcours). */
  horlogeTest: boolean;
  /** Bienvenue passée par le réglage caché des builds de développement, le temps d'une session. */
  bienvenuePassee: boolean;
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
  /** Les bilans de semaine affichés (E6) sont vus : week_result.ceremony_seen passe à vrai. */
  marquerBilansVus(): Promise<void>;
  /**
   * Valide le bilan du mois proposé (E7) avec sa résolution (Q4, 140 caractères au plus) :
   * month_review et la pièce débloquée s'enregistrent dans une seule transaction.
   */
  validerBilanMois(resolution: string): Promise<Refusal | null>;
  /**
   * Confirme le budget du nouveau mois (E7), après le bilan : sans changement, rien ne s'ajoute ;
   * sinon une nouvelle version du budget, jamais une modification.
   */
  confirmerBudget(montants: MontantsBudget): Promise<Refusal | null>;
  /**
   * Budget de la bienvenue (E1), une seule fois : les charges fixes saisies deviennent une
   * première charge mensuelle « Charges fixes » (le 1er, depuis le début du mois d'installation),
   * et la première version du budget vaut dès le lundi de la semaine d'installation.
   */
  poserBudgetInitial(montants: MontantsBudget): Promise<Refusal | null>;
  /**
   * Ajoute une dépense récurrente, qui commence aujourd'hui, et une version du budget : elle
   * s'applique à l'enveloppe à partir de la semaine suivante. Rend son identifiant.
   */
  ajouterCharge(charge: NouvelleCharge): Promise<{ id: string; refusal: RefusCharge | null }>;
  /** Modifie une dépense récurrente en cours, et ajoute une version du budget. */
  modifierCharge(id: string, charge: NouvelleCharge): Promise<RefusCharge | null>;
  /** Arrête une dépense récurrente aujourd'hui (ends_on) : la ligne reste, une version s'ajoute. */
  arreterCharge(id: string): Promise<RefusCharge | null>;
  /** Une carte de première fois s'affiche : elle ne reviendra plus, même après redémarrage. */
  marquerExplicationVue(id: IdExplication): Promise<void>;
  /**
   * Demande l'autorisation des notifications (fin de E1, et réglage caché des builds de
   * développement), puis replanifie le rappel du soir. Rend vrai si elle est accordée.
   */
  demanderAutorisationRappel(): Promise<boolean>;
  /** Réglage caché des builds de développement : budget de démonstration pour les parcours. */
  poserBudgetDemo(): Promise<boolean>;
  /** Rappel du soir : heure HH:MM et activé ou non, enregistrés, puis rappels replanifiés. */
  reglerRappel(reglages: ReglagesRappel): Promise<'invalid_reminder_time' | null>;
  /**
   * Fin de la bienvenue (E1) : première version du budget et charge « Charges fixes », réglages
   * du rappel, puis demande d'autorisation des notifications. Un refus d'autorisation n'empêche
   * rien ; un budget refusé n'enregistre rien et ne demande rien.
   */
  terminerBienvenue(fin: FinBienvenue): Promise<RefusBienvenue | null>;
  /**
   * Réglage caché des builds de développement : passe la bienvenue pour cette session, sans
   * budget, afin que les parcours existants partent de l'accueil. Faux sans l'horloge de test.
   */
  passerBienvenue(): boolean;
  /**
   * Revenus et épargne visée changés dans les réglages (E10) : une nouvelle version du budget,
   * en vigueur demain, donc à l'enveloppe à partir de la semaine suivante. Les charges fixes
   * viennent des dépenses récurrentes en cours. Sans aucun changement, rien ne s'ajoute.
   */
  reviserBudget(montants: { income: number; savingsGoal: number }): Promise<Refusal | null>;
  /** L'autorisation des notifications est-elle accordée ? Ne la demande pas (E10). */
  autorisationRappel(): Promise<boolean>;
  /**
   * Tout effacer (E10), après double confirmation : la base est vidée dans une seule transaction,
   * les rappels annulés, puis l'appli s'installe de nouveau, le jour même, sans budget : la
   * bienvenue (E1) s'affiche.
   */
  toutEffacer(): Promise<void>;
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

/** Heure du rappel par défaut (Décisions ouvertes : 21:00, Validé). */
export const HEURE_RAPPEL_DEFAUT = '21:00';

const reglagesDepuis = (s: Charge['settings']): ReglagesRappel => ({
  reminderTime: s.reminder_time ?? HEURE_RAPPEL_DEFAUT,
  reminderEnabled: s.reminder_enabled === 1,
});

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
    /** Première ouverture : installation au jour du téléphone, sans budget : E1 le pose. */
    async function installer(r: Repositories): Promise<Charge> {
      const t = deps.horloge.now();
      const maintenant = heureLocale(t);
      const settings = {
        id: 1,
        install_id: deps.nouvelId(),
        install_day: maintenant.day,
        reminder_time: HEURE_RAPPEL_DEFAUT,
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
      return { settings, etat, depenses: [], clotures: [], charges: [] };
    }

    /** Charge l'état au premier appel, sans traitement. */
    async function etatCourant(r: Repositories): Promise<AppState> {
      const deja = get().etat;
      if (deja !== null) return deja;
      const charge = (await charger(r, deps.catalogue)) ?? (await installer(r));
      set({
        etat: charge.etat,
        depenses: charge.depenses,
        clotures: charge.clotures,
        charges: charge.charges,
        reglagesRappel: reglagesDepuis(charge.settings),
        explicationsVues: lireExplicationsVues(charge.settings.seen_explanations),
      });
      return charge.etat;
    }

    /** Dernière planification réussie, pour ne pas tout replanifier à chaque action. */
    let dernierPlan: string | null = null;

    /**
     * Rappel du soir : après chaque traitement, planifie un rappel par jour à reminder_time, sauf
     * aujourd'hui si la journée est clôturée ; rien sans autorisation ou si le rappel est désactivé.
     * Un échec du téléphone n'empêche rien : la prochaine ouverture réessaie.
     */
    async function planifierRappels(): Promise<void> {
      const service = deps.rappels;
      const { etat, maintenant, reglagesRappel } = get();
      if (service === undefined || etat === null || maintenant === null || reglagesRappel === null)
        return;
      try {
        const autorise = await service.autorise();
        const plan = autorise
          ? rappelsAPlanifier({
              maintenant,
              reglages: reglagesRappel,
              joursClotures: etat.closedDays,
            })
          : [];
        // L'horloge de test décale l'heure de l'appli : le téléphone, lui, planifie en heure réelle.
        const decalage = deps.horloge.decalageMs();
        const planifies = plan.map((p) => ({
          jour: p.jour,
          texte: p.texte,
          quand: new Date(dateLocale(p.jour, p.heure).getTime() - decalage),
        }));
        const signature = JSON.stringify(planifies);
        if (signature === dernierPlan) return;
        await service.remplacer(planifies);
        dernierPlan = signature;
      } catch (erreur: unknown) {
        dernierPlan = null;
        if (__DEV__) console.warn(erreur);
      }
    }

    /**
     * Applique un événement par process, puis enregistre le résultat dans une seule transaction :
     * les étapes liées au temps (scellements, réparations) même si l'événement est refusé, et
     * `ecrire` seulement s'il est accepté.
     */
    function traiter(
      evenement: AppEvent | ((etat: AppState, maintenant: LocalDateTime) => AppEvent),
      ecrire?: (r: Repositories, instant: string, maintenant: LocalDateTime) => Promise<MiseAJour>,
    ): Promise<Refusal | null> {
      return enFile(async () => {
        const r = await repos();
        const charge = await etatCourant(r);
        const t = deps.horloge.now();
        const maintenant = heureLocale(t);
        const ev = typeof evenement === 'function' ? evenement(charge, maintenant) : evenement;
        const { state, refusal } = process(charge, ev, maintenant, deps.catalogue);
        let maj: MiseAJour = {};
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
          charges: maj.charges ?? s.charges,
        }));
        await planifierRappels();
        return refusal;
      });
    }

    /**
     * Enregistre une dépense récurrente (ajout ou changement) avec la version du budget qu'elle
     * entraîne, dans une seule transaction ; rien ne s'écrit si le domaine refuse.
     */
    function changerCharge(
      ligne: (maintenant: LocalDateTime) => RecurringChargeRow,
    ): Promise<Refusal | null> {
      let nouvelle: RecurringChargeRow | null = null;
      return traiter(
        (_etat, maintenant) => {
          const l = ligne(maintenant);
          nouvelle = l;
          const autres = get().charges.filter((c) => c.id !== l.id);
          return {
            type: 'revise_fixed_costs',
            id: deps.nouvelId(),
            charges: [...autres, l].map(chargeDepuisLigne),
          };
        },
        async (r) => {
          const l = nouvelle;
          if (l === null) return {};
          await r.recurringCharges.save(l);
          const charges = get().charges;
          return {
            charges: charges.some((c) => c.id === l.id)
              ? charges.map((c) => (c.id === l.id ? l : c))
              : [...charges, l],
          };
        },
      );
    }

    /** La charge à changer, une fois l'état chargé et les actions en cours terminées. */
    async function chargeEnCours(id: string): Promise<RecurringChargeRow | RefusCharge> {
      await enFile(async () => etatCourant(await repos()));
      const c = get().charges.find((x) => x.id === id);
      if (c === undefined) return 'unknown_charge';
      return c.ends_on === null ? c : 'charge_stopped';
    }

    const champsCharge = (c: NouvelleCharge) => ({
      label: c.label.trim(),
      amount: c.amount,
      frequency: c.frequency,
      day: c.day,
    });

    return {
      pret: false,
      catalogue: deps.catalogue,
      etat: null,
      depenses: [],
      clotures: [],
      charges: [],
      maintenant: null,
      reglagesRappel: null,
      explicationsVues: [],
      horlogeTest: deps.horloge.actif,
      bienvenuePassee: false,

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

      // Le mois validé est celui que E7 affiche : s'il n'est plus proposé, le domaine refuse.
      validerBilanMois: (resolution) =>
        traiter((etat) => ({
          type: 'validate_month',
          month: etat.monthToReview ?? '',
          resolution,
        })),

      confirmerBudget: (montants) =>
        traiter({ type: 'confirm_budget', id: deps.nouvelId(), ...montants }),

      poserBudgetInitial: (m) => {
        if (!Number.isSafeInteger(m.fixedCosts) || m.fixedCosts < 0) {
          return Promise.resolve('invalid_budget');
        }
        let ligne: RecurringChargeRow | null = null;
        return traiter(
          (etat) => {
            ligne =
              m.fixedCosts === 0
                ? null
                : {
                    id: deps.nouvelId(),
                    label: fr.budget.chargesFixes,
                    amount: m.fixedCosts,
                    frequency: 'monthly',
                    day: 1,
                    starts_on: `${etat.installDay.slice(0, 7)}-01`,
                    ends_on: null,
                  };
            return {
              type: 'set_initial_budget',
              id: deps.nouvelId(),
              income: m.income,
              savingsGoal: m.savingsGoal,
              charges: ligne === null ? [] : [chargeDepuisLigne(ligne)],
            };
          },
          async (r) => {
            const l: RecurringChargeRow | null = ligne;
            if (l === null) return {};
            await r.recurringCharges.save(l);
            return { charges: [...get().charges, l] };
          },
        );
      },

      ajouterCharge: async (c) => {
        const id = deps.nouvelId();
        const refusal = await changerCharge((maintenant) => ({
          id,
          ...champsCharge(c),
          starts_on: maintenant.day,
          ends_on: null,
        }));
        return { id, refusal };
      },

      modifierCharge: async (id, c) => {
        const actuelle = await chargeEnCours(id);
        if (typeof actuelle === 'string') return actuelle;
        return changerCharge(() => ({ ...actuelle, ...champsCharge(c) }));
      },

      arreterCharge: async (id) => {
        const actuelle = await chargeEnCours(id);
        if (typeof actuelle === 'string') return actuelle;
        return changerCharge((maintenant) => ({ ...actuelle, ends_on: maintenant.day }));
      },

      marquerExplicationVue: (id) =>
        enFile(async () => {
          const r = await repos();
          await etatCourant(r);
          const settings = await r.settings.get();
          if (settings === null) return;
          const vues = lireExplicationsVues(settings.seen_explanations);
          if (!vues.includes(id)) {
            vues.push(id);
            await r.settings.save({ ...settings, seen_explanations: ecrireExplicationsVues(vues) });
          }
          set({ explicationsVues: vues });
        }),

      demanderAutorisationRappel: async () => {
        const service = deps.rappels;
        let accordee = false;
        if (service !== undefined) {
          try {
            accordee = await service.demanderAutorisation();
          } catch (erreur: unknown) {
            if (__DEV__) console.warn(erreur);
          }
        }
        await traiter({ type: 'open' });
        return accordee;
      },

      reglerRappel: (reglages) => {
        if (!heureValide(reglages.reminderTime)) return Promise.resolve('invalid_reminder_time');
        return enFile(async () => {
          const r = await repos();
          await etatCourant(r);
          const settings = await r.settings.get();
          if (settings !== null) {
            await r.settings.save({
              ...settings,
              reminder_time: reglages.reminderTime,
              reminder_enabled: reglages.reminderEnabled ? 1 : 0,
            });
          }
          set({ reglagesRappel: { ...reglages } });
          await planifierRappels();
          return null;
        });
      },

      terminerBienvenue: async ({ budget, heureRappel }) => {
        if (!heureValide(heureRappel)) return 'invalid_reminder_time';
        const refus = await get().poserBudgetInitial(budget);
        if (refus !== null) return refus;
        await get().reglerRappel({ reminderTime: heureRappel, reminderEnabled: true });
        await get().demanderAutorisationRappel();
        return null;
      },

      passerBienvenue: () => {
        if (!deps.horloge.actif) return false;
        set({ bienvenuePassee: true });
        return true;
      },

      reviserBudget: ({ income, savingsGoal }) =>
        traiter(() => ({
          type: 'revise_budget',
          id: deps.nouvelId(),
          income,
          savingsGoal,
          charges: get().charges.map(chargeDepuisLigne),
        })),

      autorisationRappel: async () => {
        const service = deps.rappels;
        if (service === undefined) return false;
        try {
          return await service.autorise();
        } catch (erreur: unknown) {
          if (__DEV__) console.warn(erreur);
          return false;
        }
      },

      toutEffacer: async () => {
        await enFile(async () => {
          const r = await repos();
          await r.eraseAll();
          // L'état de l'interface repart de zéro : la prochaine lecture réinstalle l'appli.
          dernierPlan = null;
          set({
            etat: null,
            depenses: [],
            clotures: [],
            charges: [],
            maintenant: null,
            reglagesRappel: null,
            explicationsVues: [],
            bienvenuePassee: false,
          });
        });
        // Installation du jour, puis rappels replanifiés depuis elle (tous remplacés).
        await traiter({ type: 'open' });
      },

      // Même chemin que la bienvenue (E1) : une première charge « Charges fixes », puis la
      // première version du budget, en vigueur dès le lundi de la semaine d'installation.
      poserBudgetDemo: async () => {
        if (!deps.horloge.actif) return false;
        return (await get().poserBudgetInitial(BUDGET_DEMO)) === null;
      },
    };
  });
  return store;
}

export type KakeiboStore = ReturnType<typeof createKakeiboStore>;
