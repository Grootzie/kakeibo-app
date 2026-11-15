// Fiche d'objet (E8, J4.7, #86) : ce que la fiche montre d'un objet de la maison de l'année. Pur :
// l'état, le catalogue et l'heure lui sont passés. L'histoire vient de `owned_item` : la semaine
// où l'objet a été gagné (ou le jour où l'objet de base est arrivé), le jour de sa fêlure (le
// scellement de la semaine fautive, comme `cracked_at`) et celui de sa réparation à l'or. L'écran
// ne recalcule aucune règle : la file de réparation vient du domaine.
import type { ContentCatalog, ItemVisuals, JapaneseName } from '../content/catalogue';
import { type DayKey, weekDays } from '../domain/calendrier';
import { cracksOfYear, repairs } from '../domain/felure';
import { type ItemId, type OwnedItem, houseYear } from '../domain/objets';
import type { LocalDateTime } from '../domain/scellement';
import type { AppState } from '../domain/traitement';
import type { NomObjet } from '../i18n/fr';
import type { Reparation } from './ecranMaison';

/** Histoire d'un objet : chaque partie n'existe que si elle a eu lieu. */
export interface HistoireObjet {
  /** Objet gagné : le lundi de sa semaine ; objet de base : le jour de son arrivée. */
  arrivee: { type: 'gagne'; lundi: DayKey } | { type: 'base'; jour: DayKey };
  felure: DayKey | null;
  reparation: DayKey | null;
}

export interface VueFicheObjet {
  itemId: ItemId;
  nom: NomObjet;
  japonais: JapaneseName;
  explication: string;
  visuels: ItemVisuals;
  etat: OwnedItem['state'];
  reparation: Reparation;
  histoire: HistoireObjet;
}

/** Fiche d'un objet de la maison de l'année en cours ; null s'il n'y est pas. */
export function vueFicheObjet(
  etat: AppState,
  catalogue: ContentCatalog,
  itemId: ItemId,
  now: LocalDateTime,
): VueFicheObjet | null {
  const annee = houseYear(now.day);
  const item = catalogue.items.find((i) => i.id === itemId);
  const possede = etat.house.owned.find(
    (o) => o.year === annee && o.itemId === itemId && o.placedAt !== null,
  );
  if (item === undefined || possede === undefined) return null;

  const arrivee: HistoireObjet['arrivee'] =
    possede.source === 'weekly' && possede.week !== null
      ? { type: 'gagne', lundi: weekDays(possede.week)[0] }
      : { type: 'base', jour: (possede.placedAt ?? possede.acquiredAt).slice(0, 10) };

  const felure =
    etat.results.find((r) => r.crackedItem === itemId && Number(r.week.slice(0, 4)) === annee)
      ?.sealedAt.day ?? null;

  const file = repairs(cracksOfYear(etat.results, annee), etat.closedDays);
  const evenement = file.find((e) => e.itemId === itemId);
  const tete = file.find((e) => e.repairedOn === null);
  const reparation: Reparation =
    possede.state !== 'cracked'
      ? null
      : tete !== undefined && tete.itemId === itemId
        ? { type: 'enCours', jours: tete.progress }
        : { type: 'enAttente' };

  return {
    itemId,
    nom: { nom: item.name, article: item.article, genre: item.gender },
    japonais: item.japanese,
    explication: item.explanation,
    visuels: item.visuals,
    etat: possede.state,
    reparation,
    histoire: {
      arrivee,
      felure,
      reparation: possede.state === 'repaired' ? (evenement?.repairedOn ?? null) : null,
    },
  };
}
