// Passage entre les lignes de la base (src/data) et l'état du domaine (AppState).
// Seul l'état appelle les dépôts ; les écrans ne voient jamais ni la base ni ce fichier.
import type {
  BudgetVersionRow,
  DayClosureRow,
  ExpenseRow,
  OwnedItemRow,
  Repositories,
  SettingsRow,
  WeekResultRow,
} from '../data/repositories';
import { monthReviewOf } from '../domain/bilanMois';
import type { BudgetVersion } from '../domain/budget';
import type { Catalog, OwnedItem } from '../domain/objets';
import type { LocalDateTime, WeekResult } from '../domain/scellement';
import type { AppState } from '../domain/traitement';

/** Ce que l'état garde de la base, en plus de l'état du domaine. */
export interface Charge {
  settings: SettingsRow;
  etat: AppState;
  /** Dépenses complètes (catégorie, note), pour le carnet et la clôture. */
  depenses: ExpenseRow[];
  clotures: DayClosureRow[];
}

const versInstant = (t: LocalDateTime): string => `${t.day}T${t.time}`;
const depuisInstant = (s: string): LocalDateTime => ({
  day: s.slice(0, 10),
  time: s.slice(11, 16),
});

export const budgetDepuisLigne = (r: BudgetVersionRow): BudgetVersion => ({
  id: r.id,
  month: r.month,
  income: r.income,
  fixedCosts: r.fixed_costs,
  savingsGoal: r.savings_goal,
  effectiveFrom: r.effective_from,
});

export const budgetVersLigne = (b: BudgetVersion): BudgetVersionRow => ({
  id: b.id,
  month: b.month,
  income: b.income,
  fixed_costs: b.fixedCosts,
  savings_goal: b.savingsGoal,
  effective_from: b.effectiveFrom,
});

const resultatDepuisLigne = (r: WeekResultRow): WeekResult => ({
  week: r.week,
  sealedAt: depuisInstant(r.sealed_at),
  countedDays: r.counted_days,
  stamps: r.stamps,
  envelope: r.envelope,
  spent: r.spent,
  inBudget: r.in_budget === 1,
  complete: r.complete === 1,
  gashaponItem: r.gashapon_item,
  crackedItem: r.cracked_item,
});

const resultatVersLigne = (r: WeekResult, vu: boolean): WeekResultRow => ({
  week: r.week,
  sealed_at: versInstant(r.sealedAt),
  counted_days: r.countedDays,
  stamps: r.stamps,
  envelope: r.envelope,
  spent: r.spent,
  in_budget: r.inBudget ? 1 : 0,
  complete: r.complete ? 1 : 0,
  gashapon_item: r.gashaponItem,
  cracked_item: r.crackedItem,
  ceremony_seen: vu ? 1 : 0,
});

function objetVersLigne(o: OwnedItem, etat: AppState): OwnedItemRow {
  const felure = etat.results.find(
    (r) => r.crackedItem === o.itemId && Number(r.week.slice(0, 4)) === o.year,
  );
  const reparation = etat.repairs.find((e) => e.itemId === o.itemId && e.repairedOn !== null);
  return {
    year: o.year,
    item_id: o.itemId,
    acquired_at: o.acquiredAt,
    week: o.week,
    source: o.source,
    placed_at: o.placedAt,
    state: o.state,
    cracked_at: felure === undefined ? null : versInstant(felure.sealedAt),
    cracked_week: felure === undefined ? null : felure.week,
    // La file de réparation ne couvre que l'année en cours : le dépôt garde un jour déjà connu.
    repaired_at: o.state === 'repaired' ? (reparation?.repairedOn ?? null) : null,
  };
}

/** Charge l'état depuis la base ; null tant que l'appli n'est pas installée. */
export async function charger(repos: Repositories, catalogue: Catalog): Promise<Charge | null> {
  const settings = await repos.settings.get();
  if (settings === null) return null;
  const [budgets, depenses, clotures, resultats, objets, pieces, bilans] = await Promise.all([
    repos.budgetVersions.all(),
    repos.expenses.all(),
    repos.dayClosures.all(),
    repos.weekResults.all(),
    repos.ownedItems.all(),
    repos.unlockedRooms.all(),
    repos.monthReviews.all(),
  ]);
  const rang = new Map(catalogue.items.map((item, i) => [item.id, i]));
  const piece = new Map(catalogue.items.map((item) => [item.id, item.room]));
  // Ordre d'obtention, puis ordre du catalogue : celui dans lequel le domaine les a ajoutés.
  const ordonnes = [...objets].sort(
    (a, b) =>
      a.year - b.year ||
      (a.acquired_at < b.acquired_at ? -1 : a.acquired_at > b.acquired_at ? 1 : 0) ||
      (rang.get(a.item_id) ?? 0) - (rang.get(b.item_id) ?? 0),
  );
  const etat: AppState = {
    installDay: settings.install_day,
    budgets: budgets.map(budgetDepuisLigne),
    expenses: depenses.map((d) => ({ id: d.id, day: d.day, amount: d.amount })),
    closedDays: clotures.map((c) => c.day),
    results: resultats.map(resultatDepuisLigne),
    house: {
      owned: ordonnes.map((o) => ({
        year: o.year,
        room: piece.get(o.item_id) ?? '',
        itemId: o.item_id,
        source: o.source,
        week: o.week,
        acquiredAt: o.acquired_at,
        placedAt: o.placed_at,
        state: o.state,
      })),
      unlocked: pieces.map((p) => ({ year: p.year, room: p.room_id, unlockedAt: p.unlocked_at })),
    },
    reviews: bilans.map((b) => ({
      month: b.month,
      resolution: b.resolution ?? '',
      validatedAt: b.completed_at,
    })),
    unseenWeeks: resultats.filter((r) => r.ceremony_seen === 0).map((r) => r.week),
    // Recalculés par process à l'ouverture.
    repairs: [],
    dust: 0,
    monthToReview: null,
    monthReview: null,
  };
  return { settings, etat, depenses: [...depenses], clotures: [...clotures] };
}

const cleObjet = (o: { year: number; itemId: string }) => `${o.year}/${o.itemId}`;

/**
 * Enregistre ce que le traitement a changé entre `avant` et `apres`. À appeler dans une
 * transaction des dépôts. Les clôtures, versions du budget, résultats, pièces et bilans ne
 * font que s'ajouter ; les objets s'ajoutent ou changent d'état.
 */
export async function persister(
  repos: Repositories,
  avant: AppState | null,
  apres: AppState,
  ecriture: { clotures: DayClosureRow[] },
): Promise<void> {
  const budgets = new Set(avant?.budgets.map((b) => b.id));
  for (const b of apres.budgets)
    if (!budgets.has(b.id)) await repos.budgetVersions.add(budgetVersLigne(b));

  for (const c of ecriture.clotures) await repos.dayClosures.add(c);

  const semaines = new Set(avant?.results.map((r) => r.week));
  for (const r of apres.results) {
    if (!semaines.has(r.week)) {
      await repos.weekResults.add(resultatVersLigne(r, !apres.unseenWeeks.includes(r.week)));
    }
  }
  const vues = (avant?.unseenWeeks ?? []).filter(
    (w) => semaines.has(w) && !apres.unseenWeeks.includes(w),
  );
  if (vues.length > 0) await repos.weekResults.markCeremonySeen(vues);

  const objets = new Map(avant?.house.owned.map((o) => [cleObjet(o), JSON.stringify(o)]));
  for (const o of apres.house.owned) {
    if (objets.get(cleObjet(o)) !== JSON.stringify(o)) {
      await repos.ownedItems.save(objetVersLigne(o, apres));
    }
  }

  const pieces = new Set(avant?.house.unlocked.map((p) => `${p.year}/${p.room}`));
  for (const p of apres.house.unlocked) {
    if (!pieces.has(`${p.year}/${p.room}`)) {
      await repos.unlockedRooms.add({ year: p.year, room_id: p.room, unlocked_at: p.unlockedAt });
    }
  }

  const bilans = new Set(avant?.reviews.map((r) => r.month));
  for (const r of apres.reviews) {
    if (bilans.has(r.month)) continue;
    const chiffres = monthReviewOf(r.month, apres.budgets, apres.expenses);
    await repos.monthReviews.add({
      month: r.month,
      completed_at: r.validatedAt,
      q1: chiffres === null ? null : String(chiffres.q1),
      q2: chiffres === null ? null : String(chiffres.q2),
      q3: chiffres === null ? null : String(chiffres.q3),
      real_savings: chiffres?.realSavings ?? null,
      resolution: r.resolution,
    });
  }
}
