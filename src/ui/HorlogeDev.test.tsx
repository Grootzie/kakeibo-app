// Réglage caché des builds de développement : en attendant E1 (J5), il demande l'autorisation
// du rappel du soir (#47).
import { fireEvent, render, screen } from '@testing-library/react-native';

import { fr } from '../i18n/fr';
import { HorlogeDev } from './HorlogeDev';

const mockDemanderAutorisation = jest.fn<Promise<boolean>, []>();
jest.mock('../state/appStore', () => ({
  kakeibo: {
    getState: () => ({
      demanderAutorisationRappel: mockDemanderAutorisation,
      ouvrir: async () => undefined,
      poserBudgetDemo: async () => false,
    }),
  },
}));

describe('réglage caché : rappel du soir', () => {
  test('demande l’autorisation et dit si elle est accordée', async () => {
    mockDemanderAutorisation.mockResolvedValueOnce(true);
    await render(<HorlogeDev />);
    await fireEvent.press(screen.getByRole('button', { name: fr.dev.autoriserRappelLibelle }));
    expect(await screen.findByText(fr.dev.rappelAutorise)).toBeTruthy();
    expect(mockDemanderAutorisation).toHaveBeenCalledTimes(1);
  });

  test('un refus est dit sans rien bloquer', async () => {
    mockDemanderAutorisation.mockResolvedValueOnce(false);
    await render(<HorlogeDev />);
    await fireEvent.press(screen.getByRole('button', { name: fr.dev.autoriserRappelLibelle }));
    expect(await screen.findByText(fr.dev.rappelRefuse)).toBeTruthy();
    expect(screen.getByRole('button', { name: fr.dev.plusUnJour })).toBeTruthy();
  });
});
