// Message « Annuler » après une dépense notée (E3, #44) : visible 5 secondes.
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { fr } from '../../i18n/fr';
import { DUREE_ANNULER_MS, MessageAnnuler } from './MessageAnnuler';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

async function monter() {
  const onAnnuler = jest.fn();
  const onFin = jest.fn();
  await render(
    <MessageAnnuler montant={1250} categorie="envies" onAnnuler={onAnnuler} onFin={onFin} />,
  );
  return { onAnnuler, onFin };
}

describe('message « Annuler »', () => {
  it('dit ce qui vient d’être noté, avec un bouton « Annuler »', async () => {
    await monter();
    expect(screen.getByText('12,50 € noté en Envies.')).toBeOnTheScreen();
    const bouton = screen.getByRole('button', { name: fr.depense.annulerLibelle });
    expect(bouton).toBeEnabled();
    expect(screen.getByText(fr.depense.annuler)).toBeOnTheScreen();
    expect(screen.getByTestId('message-annuler').props.accessibilityLiveRegion).toBe('polite');
  });

  it('reste visible 5 secondes, puis s’efface', async () => {
    const { onFin } = await monter();
    expect(DUREE_ANNULER_MS).toBe(5000);
    await act(() => jest.advanceTimersByTime(4999));
    expect(onFin).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(1));
    expect(onFin).toHaveBeenCalledTimes(1);
  });

  it('annule la dépense quand on le touche', async () => {
    const { onAnnuler } = await monter();
    await fireEvent.press(screen.getByRole('button', { name: fr.depense.annulerLibelle }));
    expect(onAnnuler).toHaveBeenCalledTimes(1);
  });
});
