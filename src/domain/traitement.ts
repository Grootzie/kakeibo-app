// Ordre de traitement : enchaînement des règles à chaque ouverture et à chaque clôture (J1.8).
// Pur : l'heure courante et le catalogue sont passés en paramètre ; l'état reçu n'est jamais modifié.
import { type MonthReview, isValidResolution, monthReviewOf, monthToReview } from './bilanMois';
import { type BudgetVersion, type Expense } from './budget';
import { type MonthKey, type WeekId, weekDays } from './calendrier';
import {
  type RepairEvent,
  applyCrack,
  applyRepairs,
  cracksOfYear,
  crackTarget,
  repairs,
} from './felure';
import {
  type Catalog,
  type HouseState,
  type Instant,
  type MonthReviewValidation,
  awardWeeklyItem,
  houseYear,
  installHouse,
  openNewYear,
  validateMonthReview,
} from './objets';
import { type DustLevel, dustLevel } from './poussiere';
import {
  type DayKey,
  type LocalDateTime,
  type RefusalReason,
  type WeekResult,
  canAddExpense,
  canCloseDay,
  sealWeek,
  weeksToSeal,
} from './scellement';

export interface ValidatedReview {
  month: MonthKey;
  /** Q4, de 0 à 140 caractères. */
  resolution: string;
  validatedAt: Instant;
}

export interface AppState {
  installDay: DayKey;
  budgets: BudgetVersion[];
  /** Dépenses saisies, telles que le carnet les affiche. */
  expenses: Expense[];
  closedDays: DayKey[];
  /** Résultats des semaines scellées, figés, de la plus ancienne à la plus récente. */
  results: WeekResult[];
  house: HouseState;
  reviews: ValidatedReview[];
  /** Semaines scellées dont le bilan (E6) n'a pas encore été affiché. */
  unseenWeeks: WeekId[];
  /** Recalculés à chaque traitement. */
  repairs: RepairEvent[];
  dust: DustLevel;
  monthToReview: MonthKey | null;
  /** Chiffres du bilan proposé (Q1 à Q3), avec la version du budget reconduite au besoin. */
  monthReview: MonthReview | null;
}

export type AppEvent =
  | { type: 'open' }
  | { type: 'close_day'; day: DayKey }
  /** Ajout, ou modification si l'identifiant existe déjà. */
  | { type: 'save_expense'; expense: Expense }
  /** Suppression depuis le carnet, même dans une semaine scellée : le résultat reste figé. */
  | { type: 'delete_expense'; id: string }
  | { type: 'week_reviews_seen' }
  | { type: 'validate_month'; month: MonthKey; resolution: string };

export type Refusal =
  RefusalReason | 'month_not_proposed' | 'resolution_too_long' | 'unknown_expense';

export interface ProcessResult {
  state: AppState;
  /** Raison du refus de l'événement ; les étapes liées au temps sont appliquées quand même. */
  refusal: Refusal | null;
}

const instant = (t: LocalDateTime): Instant => `${t.day}T${t.time}`;

const lastValidated = (reviews: ValidatedReview[]): MonthKey | null =>
  reviews.reduce<MonthKey | null>(
    (max, r) => (max === null || r.month > max ? r.month : max),
    null,
  );

/** Applique `f` aux seuls objets d'une année : un même identifiant peut exister dans l'album. */
function inYear(house: HouseState, year: number, f: (h: HouseState) => HouseState): HouseState {
  const indices = house.owned.flatMap((o, i) => (o.year === year ? [i] : []));
  const sub = f({ ...house, owned: indices.map((i) => house.owned[i]) });
  const owned = [...house.owned];
  indices.forEach((i, k) => {
    owned[i] = sub.owned[k];
  });
  return { ...house, owned };
}

/** Nouvelle année : le lundi de la semaine 1, à 00:00, la pièce de janvier s'ouvre. */
function openNewYears(catalog: Catalog, state: AppState, now: LocalDateTime): AppState {
  let house = state.house;
  for (let y = houseYear(state.installDay) + 1; y <= houseYear(now.day); y++) {
    const lundi = weekDays(`${String(y).padStart(4, '0')}-W01`)[0];
    house = openNewYear(catalog, house, y, `${lundi}T00:00`);
  }
  return house === state.house ? state : { ...state, house };
}

/** Scelle, de la plus ancienne à la plus récente, les semaines arrivées à leur moment de scellement. */
function sealDue(catalog: Catalog, state: AppState, now: LocalDateTime): AppState {
  let s = state;
  for (const p of weeksToSeal({
    now,
    installDay: s.installDay,
    closedDays: s.closedDays,
    results: s.results,
  })) {
    const year = Number(p.week.slice(0, 4));
    const at = instant(p.sealedAt);
    const award = awardWeeklyItem(catalog, s.house, p.week, at);
    const result = sealWeek({
      week: p.week,
      installDay: s.installDay,
      sealedAt: p.sealedAt,
      closedDays: s.closedDays,
      expenses: s.expenses,
      budgets: s.budgets,
      nextItem: award.itemId,
      crackTarget: crackTarget(catalog, s.house.owned, year, award.itemId),
    });
    let house = result.gashaponItem !== null ? award.state : s.house;
    const fele = result.crackedItem;
    if (fele !== null) house = inYear(house, year, (h) => applyCrack(h, fele));
    s = {
      ...s,
      house,
      results: [...s.results, result],
      unseenWeeks: [...s.unseenWeeks, p.week],
    };
  }
  return s;
}

/** Réparations de l'année en cours : la file repart à zéro avec chaque nouvelle année. */
function applyRepairStep(state: AppState, now: LocalDateTime): AppState {
  const year = houseYear(now.day);
  const events = repairs(cracksOfYear(state.results, year), state.closedDays);
  return {
    ...state,
    house: inYear(state.house, year, (h) => applyRepairs(h, events)),
  };
}

/** Ce qui se lit après chaque traitement : file de réparation, poussière et bilan du mois proposé. */
function derive(state: AppState, now: LocalDateTime): AppState {
  const mois = monthToReview(now.day, state.installDay, lastValidated(state.reviews));
  return {
    ...state,
    // Relu après le scellement : la fêlure d'aujourd'hui entre dans la file affichée.
    repairs: repairs(cracksOfYear(state.results, houseYear(now.day)), state.closedDays),
    dust: dustLevel(now.day, state.closedDays, state.results, state.installDay),
    monthToReview: mois,
    monthReview: mois === null ? null : monthReviewOf(mois, state.budgets, state.expenses),
  };
}

function record(
  catalog: Catalog,
  state: AppState,
  event: AppEvent,
  now: LocalDateTime,
): { state: AppState; refusal: Refusal | null } {
  const ctx = {
    installDay: state.installDay,
    closedDays: state.closedDays,
    sealedWeeks: state.results.map((r) => r.week),
  };
  switch (event.type) {
    case 'open':
      return { state, refusal: null };
    case 'close_day': {
      const check = canCloseDay(event.day, now, ctx);
      if (!check.ok) return { state, refusal: check.reason };
      return { state: { ...state, closedDays: [...state.closedDays, event.day] }, refusal: null };
    }
    case 'save_expense': {
      const e = event.expense;
      const ancienne = state.expenses.find((x) => x.id === e.id);
      // Une dépense existante reste modifiable dans le carnet, même dans une semaine scellée.
      if (ancienne === undefined || ancienne.day !== e.day) {
        const check = canAddExpense(e.day, now, ctx);
        if (!check.ok) return { state, refusal: check.reason };
      }
      const expenses =
        ancienne === undefined
          ? [...state.expenses, { ...e }]
          : state.expenses.map((x) => (x.id === e.id ? { ...e } : x));
      return { state: { ...state, expenses }, refusal: null };
    }
    case 'delete_expense': {
      if (!state.expenses.some((x) => x.id === event.id)) {
        return { state, refusal: 'unknown_expense' };
      }
      const expenses = state.expenses.filter((x) => x.id !== event.id);
      return { state: { ...state, expenses }, refusal: null };
    }
    case 'week_reviews_seen':
      return { state: { ...state, unseenWeeks: [] }, refusal: null };
    case 'validate_month': {
      const propose = monthToReview(now.day, state.installDay, lastValidated(state.reviews));
      if (event.month !== propose) return { state, refusal: 'month_not_proposed' };
      if (!isValidResolution(event.resolution)) return { state, refusal: 'resolution_too_long' };
      const at = instant(now);
      const validation: MonthReviewValidation = {
        month: event.month,
        previousReview: lastValidated(state.reviews),
        installDay: state.installDay,
        at,
      };
      return {
        state: {
          ...state,
          house: validateMonthReview(catalog, state.house, validation),
          reviews: [
            ...state.reviews,
            { month: event.month, resolution: event.resolution, validatedAt: at },
          ],
        },
        refusal: null,
      };
    }
  }
}

/**
 * Applique l'ordre de traitement de la spec :
 * 1. sceller les semaines dont le délai est dépassé, de la plus ancienne à la plus récente ;
 * 2. enregistrer l'événement (clôture, dépense, bilan) ;
 * 3. calculer les réparations ;
 * 4. sceller la semaine si tous ses jours décomptés sont clôturés ;
 * 5. enregistrer les résultats et préparer les bilans à afficher.
 * La nouvelle année (lundi de la semaine 1 à 00:00) s'ouvre avant tout scellement.
 */
export function process(
  state: AppState,
  event: AppEvent,
  now: LocalDateTime,
  catalog: Catalog,
): ProcessResult {
  let s = openNewYears(catalog, state, now);
  s = sealDue(catalog, s, now);
  const recorded = record(catalog, s, event, now);
  s = applyRepairStep(recorded.state, now);
  s = sealDue(catalog, s, now);
  return { state: derive(s, now), refusal: recorded.refusal };
}

/** État à l'installation : la pièce du mois de la semaine en cours s'ouvre avec ses objets de base. */
export function createAppState(
  input: { installDay: DayKey; at: LocalDateTime; budgets: BudgetVersion[] },
  catalog: Catalog,
): AppState {
  const state: AppState = {
    installDay: input.installDay,
    budgets: [...input.budgets],
    expenses: [],
    closedDays: [],
    results: [],
    house: installHouse(catalog, input.installDay, instant(input.at)),
    reviews: [],
    unseenWeeks: [],
    repairs: [],
    dust: 0,
    monthToReview: null,
    monthReview: null,
  };
  return derive(state, input.at);
}

export type WeekReviewScreen = { kind: 'week'; week: WeekId } | { kind: 'recap'; weeks: WeekId[] };

/** Bilan de semaine à afficher : un seul écran, récapitulatif quand plusieurs semaines attendent. */
export function weekReviewScreen(state: AppState): WeekReviewScreen | null {
  if (state.unseenWeeks.length === 0) return null;
  if (state.unseenWeeks.length === 1) return { kind: 'week', week: state.unseenWeeks[0] };
  return { kind: 'recap', weeks: [...state.unseenWeeks] };
}
