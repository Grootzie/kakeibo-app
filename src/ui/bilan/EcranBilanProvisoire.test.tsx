// Routes des bilans posées en attendant E6 (J3.2) et E7 (J3.4) : titre annoncé et retour.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { fr } from '../../i18n/fr';
import { EcranBilanProvisoire } from './EcranBilanProvisoire';

describe('écran de bilan provisoire', () => {
  it('annonce son titre et ramène à l’accueil', async () => {
    const onRetour = jest.fn();
    await render(
      <EcranBilanProvisoire
        testID="ecran-bilan-mois"
        titre={fr.bilan.titreMois('2026-11')}
        onRetour={onRetour}
      />,
    );
    expect(screen.getByRole('header', { name: 'Bilan de novembre' })).toBeOnTheScreen();
    const retour = screen.getByRole('button', { name: 'Retour à l’accueil' });
    expect(StyleSheet.flatten(retour.props.style).minHeight).toBeGreaterThanOrEqual(44);
    await fireEvent.press(retour);
    expect(onRetour).toHaveBeenCalledTimes(1);
  });
});
