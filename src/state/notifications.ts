// Service de notifications du téléphone (expo-notifications), en local uniquement : aucun serveur,
// aucun jeton de notification demandé ni envoyé. Seul l'état l'appelle (rappel du soir), et le
// routeur de l'appli l'écoute pour ouvrir E4 quand on touche le rappel.
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import type { DayKey } from '../domain/scellement';
import { fr } from '../i18n/fr';
import { type ServiceRappels, jourDuRappel } from './rappel';

/** Canal Android du rappel du soir. */
export const CANAL_RAPPEL = 'rappel-du-soir';

async function creerCanal(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANAL_RAPPEL, {
    name: fr.notifications.canalRappel,
    importance: AndroidImportance.DEFAULT,
  });
}

export interface ServiceRappelsTelephone extends ServiceRappels {
  /**
   * Appelle `ouvrir` avec le jour d'un rappel touché : celui qui a lancé l'appli, puis chacun des
   * suivants. Rend la fonction qui arrête l'écoute.
   */
  ecouterTouches(ouvrir: (jour: DayKey) => void): () => void;
}

const inactif: ServiceRappelsTelephone = {
  autorise: async () => false,
  demanderAutorisation: async () => false,
  remplacer: async () => undefined,
  ecouterTouches: () => () => undefined,
};

const telephone: ServiceRappelsTelephone = {
  autorise: async () => (await Notifications.getPermissionsAsync()).granted,

  demanderAutorisation: async () => {
    // Android 13 et plus : le canal doit exister avant la demande.
    await creerCanal();
    const reponse = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return reponse.granted;
  },

  remplacer: async (rappels) => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (rappels.length === 0) return;
    await creerCanal();
    for (const r of rappels) {
      await Notifications.scheduleNotificationAsync({
        identifier: `rappel-${r.jour}`,
        content: { body: r.texte, data: { jour: r.jour } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: r.quand,
          channelId: CANAL_RAPPEL,
        },
      });
    }
  },

  ecouterTouches: (ouvrir) => {
    const toucher = (reponse: Notifications.NotificationResponse | null) => {
      if (reponse === null) return;
      if (reponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const jour = jourDuRappel(reponse.notification.request.content.data);
      // Une seule fois : la réponse ne doit pas rouvrir E4 à la prochaine ouverture.
      Notifications.clearLastNotificationResponse();
      if (jour !== null) ouvrir(jour);
    };
    toucher(Notifications.getLastNotificationResponse());
    const abonnement = Notifications.addNotificationResponseReceivedListener(toucher);
    return () => abonnement.remove();
  },
};

/** Le service de l'appli : inactif sur le web, où le rappel du soir n'existe pas. */
export const serviceRappels: ServiceRappelsTelephone = Platform.OS === 'web' ? inactif : telephone;
