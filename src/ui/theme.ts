// Thème neutre : couleurs des catégories (celles du carnet imprimable) et jetons de base.
// La couleur ne porte jamais seule l'information : chaque catégorie a aussi une icône et un nom (fr.ts).

export type CategorieId = 'essentiel' | 'envies' | 'culture' | 'imprevus';

export interface StyleCategorie {
  readonly couleur: string;
  /** Identifiant d'icône ; le dessin vient avec les visuels. */
  readonly icone: string;
  /** Signe provisoire de l'icône (caractère typographique, pas un emoji), en attendant les visuels. */
  readonly signe: string;
}

export const theme = {
  couleurs: {
    fond: '#FFFFFF',
    texte: '#1F1B16',
    texteDiscret: '#5C5348',
    /** Bouton principal et jauge : encre, jamais de rouge d'alerte. */
    principal: '#1F1B16',
    surPrincipal: '#FFFFFF',
    jauge: '#1F1B16',
    jaugeFond: '#E7E1D8',
    /** Fond du bandeau et des cases hors décompte. */
    discret: '#F3EFE9',
    /** Voile derrière une feuille qui monte du bas. */
    voile: 'rgba(31, 27, 22, 0.4)',
    /** Veines d'or d'un objet réparé (dessin provisoire, #66). */
    or: '#8A6516',
  },
  categories: {
    essentiel: { couleur: '#2F4B7C', icone: 'maison', signe: '\u2302' },
    envies: { couleur: '#B4432D', icone: 'etoile', signe: '\u2605' },
    culture: { couleur: '#52733A', icone: 'livre', signe: '\u25A4' },
    imprevus: { couleur: '#97701F', icone: 'eclair', signe: '\u03DF' },
  } satisfies Record<CategorieId, StyleCategorie>,
  /** Zone tactile minimale, en points. */
  zoneTactileMin: 44,
} as const;

function luminance(hex: string): number {
  const canaux = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * canaux[0] + 0.7152 * canaux[1] + 0.0722 * canaux[2];
}

/** Rapport de contraste WCAG entre deux couleurs `#RRGGBB`. */
export function contrastRatio(a: string, b: string): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
}
