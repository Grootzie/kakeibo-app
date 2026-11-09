// Réglage caché des builds de développement : en attendant E1 (J5), il demande l'autorisation
// du rappel du soir (#47).
import { fireEvent, render, screen } from '@testing-library/react-native';

import { fr } from '../i18n/fr';
import { HorlogeDev } from './HorlogeDev';

const mockDemanderAutorisation = jest.fn<Promise<boolean>, []>();
const mockMarquerBilansVus = jest.fn<Promise<void>, []>(async () => undefined);
jest.mock('../state/appStore', () => ({
  kakeibo: {
    getState: () => ({
      demanderAutorisationRappel: mockDemanderAutorisation,
      ouvrir: async () => undefined,
      poserBudgetDemo: async () => false,
      marquerBilansVus: mockMarquerBilansVus,
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

describe('réglage caché : bilans de semaine vus, en attendant E6 (J3.2)', () => {
  test('marque les bilans de semaine vus et le dit', async () => {
    await render(<HorlogeDev />);
    await fireEvent.press(screen.getByRole('button', { name: fr.dev.bilansVus }));
    expect(await screen.findByText(fr.dev.bilansVusFait)).toBeTruthy();
    expect(mockMarquerBilansVus).toHaveBeenCalledTimes(1);
  });
});
