// Rappel du soir (voir « Notifications » dans docs/spec.md) : une notification locale par jour au
// plus, à l'heure choisie, seulement si la journée n'est pas encore clôturée ; annulée dès la
// clôture ; toucher la notification ouvre E4. Ce fichier calcule quoi planifier, sans horloge ni
// service : l'heure lui est passée, et le service du téléphone (notifications.ts) planifie.
import { addDays } from '../domain/calendrier';
import type { DayKey, LocalDateTime } from '../domain/scellement';
import { fr } from '../i18n/fr';

/**
 * Jours planifiés d'avance : les rappels continuent même si l'appli n'est pas rouverte, et chaque
 * ouverture ou clôture les replanifie. Bien sous la limite d'iOS (64 notifications en attente).
 */
export const JOURS_PLANIFIES = 30;

export interface ReglagesRappel {
  /** Heure HH:MM (reminder_time). */
  reminderTime: string;
  /** reminder_enabled. */
  reminderEnabled: boolean;
}

export interface Rappel {
  jour: DayKey;
  /** Heure HH:MM, à l'heure locale du téléphone. */
  heure: string;
  texte: string;
}

/** Ce que le téléphone planifie : un rappel et son instant réel. */
export interface RappelPlanifie {
  jour: DayKey;
  quand: Date;
  texte: string;
}

/** Service de notifications du téléphone, simulé dans les tests. Aucun serveur, aucun jeton. */
export interface ServiceRappels {
  /** L'autorisation des notifications est-elle accordée ? Ne la demande pas. */
  autorise(): Promise<boolean>;
  /** Demande l'autorisation (E1, en attendant le réglage caché des builds de développement). */
  demanderAutorisation(): Promise<boolean>;
  /** Annule tous les rappels planifiés, puis planifie ceux-ci (aucun : tout est annulé). */
  remplacer(rappels: RappelPlanifie[]): Promise<void>;
}

const numeroDuJour = (day: DayKey): number =>
  Math.round(
    Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) /
      86_400_000,
  );

/** Les trois textes de la spec, en alternance : le texte d'un jour ne dépend que du jour. */
export const texteDuRappel = (day: DayKey): string =>
  fr.rappels[numeroDuJour(day) % fr.rappels.length];

/**
 * Rappels des JOURS_PLANIFIES prochains jours, un par jour : aujourd'hui seulement si la journée
 * n'est pas clôturée et que l'heure n'est pas passée. Rien si le rappel est désactivé.
 */
export function rappelsAPlanifier(input: {
  maintenant: LocalDateTime;
  reglages: ReglagesRappel;
  joursClotures: readonly DayKey[];
}): Rappel[] {
  const { maintenant, reglages } = input;
  if (!reglages.reminderEnabled) return [];
  const heure = reglages.reminderTime;
  const aujourdhuiOuvert = !input.joursClotures.includes(maintenant.day) && maintenant.time < heure;
  const premier = aujourdhuiOuvert ? maintenant.day : addDays(maintenant.day, 1);
  return Array.from({ length: JOURS_PLANIFIES }, (_, i) => {
    const jour = addDays(premier, i);
    return { jour, heure, texte: texteDuRappel(jour) };
  });
}

/** Jour d'un rappel touché, depuis les données de la notification ; null sinon. */
export function jourDuRappel(data: unknown): DayKey | null {
  if (typeof data !== 'object' || data === null || !('jour' in data)) return null;
  const { jour } = data;
  return typeof jour === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(jour) ? jour : null;
}
