// Service de notifications du téléphone (#47) : expo-notifications en local uniquement, simulé.
import { readFileSync } from 'fs';
import { join } from 'path';

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { fr } from '../i18n/fr';
import { CANAL_RAPPEL, serviceRappels } from './notifications';

jest.mock('expo-notifications', () => {
  const ecouteurs: ((r: unknown) => void)[] = [];
  return {
    AndroidImportance: { DEFAULT: 3 },
    SchedulableTriggerInputTypes: { DATE: 'date' },
    DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
    getPermissionsAsync: jest.fn(async () => ({ granted: true })),
    requestPermissionsAsync: jest.fn(async () => ({ granted: false })),
    setNotificationChannelAsync: jest.fn(async () => null),
    cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
    scheduleNotificationAsync: jest.fn(async () => 'id'),
    getLastNotificationResponse: jest.fn(() => null),
    clearLastNotificationResponse: jest.fn(),
    addNotificationResponseReceivedListener: jest.fn((f: (r: unknown) => void) => {
      ecouteurs.push(f);
      return { remove: () => ecouteurs.splice(ecouteurs.indexOf(f), 1) };
    }),
    __toucher: (r: unknown) => ecouteurs.forEach((f) => f(r)),
    __ecouteurs: ecouteurs,
  };
});

const N = Notifications as unknown as {
  [k: string]: jest.Mock;
} & { __toucher: (r: unknown) => void; __ecouteurs: unknown[] };

const reponse = (data: unknown, action = 'expo.modules.notifications.actions.DEFAULT') => ({
  actionIdentifier: action,
  notification: { request: { content: { data } } },
});

beforeEach(() => {
  jest.clearAllMocks();
  // Le rappel du soir a son canal sur Android : on joue la version Android du service.
  Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });
});

describe('service de notifications du téléphone', () => {
  test('planifie chaque rappel en local, à sa date, sur le canal du rappel du soir', async () => {
    const quand = new Date(2026, 10, 5, 21, 0);
    await serviceRappels.remplacer([{ jour: '2026-11-05', quand, texte: fr.rappels[0] }]);
    expect(N.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(N.setNotificationChannelAsync).toHaveBeenCalledWith(CANAL_RAPPEL, {
      name: 'Rappel du soir',
      importance: 3,
    });
    expect(N.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'rappel-2026-11-05',
      content: { body: fr.rappels[0], data: { jour: '2026-11-05' } },
      trigger: { type: 'date', date: quand, channelId: CANAL_RAPPEL },
    });
  });

  test('remplacer par aucun rappel annule tout', async () => {
    await serviceRappels.remplacer([]);
    expect(N.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test('lit l’autorisation sans la demander ; la demande rend le refus', async () => {
    expect(await serviceRappels.autorise()).toBe(true);
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(await serviceRappels.demanderAutorisation()).toBe(false);
    // Android 13 et plus : le canal existe avant la demande.
    expect(N.setNotificationChannelAsync).toHaveBeenCalled();
  });

  test('toucher le rappel ouvre son jour, une seule fois', () => {
    const ouvrir = jest.fn();
    const arreter = serviceRappels.ecouterTouches(ouvrir);
    N.__toucher(reponse({ jour: '2026-11-05' }));
    expect(ouvrir).toHaveBeenCalledWith('2026-11-05');
    expect(N.clearLastNotificationResponse).toHaveBeenCalled();
    N.__toucher(reponse({ autre: 1 }));
    N.__toucher(reponse({ jour: '2026-11-05' }, 'expo.modules.notifications.actions.DISMISSED'));
    expect(ouvrir).toHaveBeenCalledTimes(1);
    arreter();
    expect(N.__ecouteurs).toHaveLength(0);
  });

  test('le rappel qui a lancé l’appli ouvre aussi son jour', () => {
    N.getLastNotificationResponse.mockReturnValueOnce(reponse({ jour: '2026-11-06' }));
    const ouvrir = jest.fn();
    serviceRappels.ecouterTouches(ouvrir)();
    expect(ouvrir).toHaveBeenCalledWith('2026-11-06');
  });

  test('en local uniquement : aucun jeton de notification demandé ni envoyé', () => {
    const racine = join(__dirname, '..', '..');
    const sources = [
      join(racine, 'src', 'state', 'notifications.ts'),
      join(racine, 'app', '_layout.tsx'),
    ].map((f) => readFileSync(f, 'utf8'));
    for (const s of sources) {
      expect(s).not.toMatch(
        /PushToken|setAutoServerRegistrationEnabledAsync|registerTaskAsync|projectId/,
      );
    }
  });
});
