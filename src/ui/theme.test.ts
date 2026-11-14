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

describe('thème de l’accueil (#43)', () => {
  const c = theme.couleurs;
  it('lit le bouton principal au contraste AA', () => {
    expect(contrastRatio(c.surPrincipal, c.principal)).toBeGreaterThanOrEqual(4.5);
  });
  it('distingue la jauge de son fond (3 pour un élément graphique)', () => {
    expect(contrastRatio(c.jauge, c.jaugeFond)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(c.jauge, c.fond)).toBeGreaterThanOrEqual(3);
  });
  it('lit les textes sur le fond discret au contraste AA', () => {
    expect(contrastRatio(c.texte, c.discret)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(c.texteDiscret, c.discret)).toBeGreaterThanOrEqual(4.5);
  });
  it('distingue les veines d’or du fond discret (3 pour un élément graphique, #66)', () => {
    expect(contrastRatio(c.or, c.discret)).toBeGreaterThanOrEqual(3);
  });

  it('n’utilise aucun rouge d’alerte pour la jauge', () => {
    expect(c.jauge).not.toBe(theme.categories.envies.couleur);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.jauge.slice(i, i + 2), 16));
    expect(r - Math.max(g, b)).toBeLessThan(40);
  });
});
