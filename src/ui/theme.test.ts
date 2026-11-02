import { theme, contrastRatio } from './theme';

describe('thème', () => {
  it('reprend les couleurs du carnet imprimable', () => {
    expect(theme.categories.essentiel.couleur).toBe('#2F4B7C');
    expect(theme.categories.envies.couleur).toBe('#B4432D');
    expect(theme.categories.culture.couleur).toBe('#52733A');
    expect(theme.categories.imprevus.couleur).toBe('#97701F');
  });

  it('donne à chaque catégorie une icône', () => {
    Object.values(theme.categories).forEach((c) => {
      expect(c.icone.length).toBeGreaterThan(0);
    });
  });

  it('respecte le contraste AA (4,5) des catégories sur le fond', () => {
    Object.values(theme.categories).forEach((c) => {
      expect(contrastRatio(c.couleur, theme.couleurs.fond)).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('respecte le contraste AA du texte sur le fond', () => {
    expect(contrastRatio(theme.couleurs.texte, theme.couleurs.fond)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(theme.couleurs.texteDiscret, theme.couleurs.fond)).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it('garde des zones tactiles de 44 points au moins', () => {
    expect(theme.zoneTactileMin).toBeGreaterThanOrEqual(44);
  });
});
