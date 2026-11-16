// « En savoir plus » (E12, J5.7, #106) : chaque carte de première fois le propose ; il ferme la
// carte et ouvre Comprendre à la fiche qui reprend son texte.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { readFileSync } from 'fs';
import { join } from 'path';

import { fr } from '../../i18n/fr';
import { FICHE_DE_CARTE, paragraphesDeFiche } from '../../state/comprendre';
import { EXPLICATIONS_J2, EXPLICATIONS_J3 } from '../../state/explications';
import { theme } from '../theme';
import { CarteExplication, TEXTES_EXPLICATION } from './CarteExplication';
import { EnSavoirPlus } from './EnSavoirPlus';

const ce = fr.carteExplication;

describe('« En savoir plus » des cartes de première fois', () => {
  it.each([...EXPLICATIONS_J2, ...EXPLICATIONS_J3])(
    '%s : ferme la carte et ouvre Comprendre à la fiche de son texte',
    async (id) => {
      const ouvrir = jest.fn();
      const onFermer = jest.fn();
      await render(
        <EnSavoirPlus.Provider value={ouvrir}>
          <CarteExplication id={id} onFermer={onFermer} />
        </EnSavoirPlus.Provider>,
      );
      const titre = ce.titres[id];
      const b = screen.getByRole('button', { name: ce.enSavoirPlusLibelle(titre) });
      expect(b.props.accessibilityHint).toBe(ce.enSavoirPlusIndice);
      expect(b.props.style).toMatchObject({ minHeight: theme.zoneTactileMin });
      expect(screen.getByText(ce.enSavoirPlus)).toBeTruthy();
      await fireEvent.press(b);
      expect(onFermer).toHaveBeenCalledTimes(1);
      expect(ouvrir).toHaveBeenCalledWith(FICHE_DE_CARTE[id]);
      expect(paragraphesDeFiche(FICHE_DE_CARTE[id])).toContain(TEXTES_EXPLICATION[id]);
    },
  );

  it('l’appli fournit l’ouverture de Comprendre à tous ses écrans', () => {
    const layout = readFileSync(join(__dirname, '..', '..', '..', 'app', '_layout.tsx'), 'utf8');
    expect(layout).toMatch(/<EnSavoirPlus\.Provider value=\{ouvrirComprendre\}>/);
    expect(layout).toMatch(/pathname: '\/comprendre', params: \{ fiche \}/);
  });

  it('libellés en français, avec les guillemets et leurs espaces insécables', () => {
    expect(ce.enSavoirPlus).toBe('En savoir plus');
    expect(ce.enSavoirPlusLibelle('Première fêlure')).toBe(
      'En savoir plus sur «\u00a0Première fêlure\u00a0»',
    );
  });
});
