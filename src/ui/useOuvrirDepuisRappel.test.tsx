// Toucher le rappel du soir ouvre E4 sur son jour (#47).
import { act, renderHook } from '@testing-library/react-native';

import type { DayKey } from '../domain/scellement';
import { useOuvrirDepuisRappel } from './useOuvrirDepuisRappel';

function serviceSimule() {
  let ecouteur: ((jour: DayKey) => void) | null = null;
  return {
    ecouterTouches: jest.fn((f: (jour: DayKey) => void) => {
      ecouteur = f;
      return () => {
        ecouteur = null;
      };
    }),
    toucher: (jour: DayKey) => ecouteur?.(jour),
    ecoute: () => ecouteur !== null,
  };
}

describe('ouvrir E4 depuis le rappel du soir', () => {
  test('un rappel touché ouvre la clôture de son jour', async () => {
    const service = serviceSimule();
    const ouvrir = jest.fn();
    const { unmount } = await renderHook(() => useOuvrirDepuisRappel(service, ouvrir));
    await act(async () => service.toucher('2026-11-05'));
    expect(ouvrir).toHaveBeenCalledWith('2026-11-05');
    await unmount();
    expect(service.ecoute()).toBe(false);
  });

  test('ne réabonne pas l’écoute à chaque rendu, et appelle la dernière fonction reçue', async () => {
    const service = serviceSimule();
    const premiere = jest.fn();
    const seconde = jest.fn();
    const { rerender } = await renderHook(
      ({ f }: { f: (jour: DayKey) => void }) => useOuvrirDepuisRappel(service, f),
      { initialProps: { f: premiere } },
    );
    await rerender({ f: seconde });
    expect(service.ecouterTouches).toHaveBeenCalledTimes(1);
    await act(async () => service.toucher('2026-11-06'));
    expect(premiere).not.toHaveBeenCalled();
    expect(seconde).toHaveBeenCalledWith('2026-11-06');
  });
});
