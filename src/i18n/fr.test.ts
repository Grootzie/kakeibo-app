import { fr, formatEuros } from './fr';

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach((v) => collectStrings(v, out));
  }
  return out;
}

describe('fr.ts', () => {
  const textes = collectStrings(fr);

  it('contient des textes', () => {
    expect(textes.length).toBeGreaterThan(30);
  });

  it('place une espace insécable avant ? ! : ;', () => {
    textes.forEach((t) => expect(t).not.toMatch(/ [?!:;]/));
  });

  it("place des espaces insécables à l'intérieur des guillemets « »", () => {
    textes.forEach((t) => {
      expect(t).not.toMatch(/« (?! )/);
      expect(t).not.toMatch(/ »/);
    });
  });

  it('ne contient ni emoji ni série de points d’exclamation', () => {
    textes.forEach((t) => {
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(t).not.toMatch(/!.*!/);
    });
  });

  it('tutoie', () => {
    textes.forEach((t) => expect(t).not.toMatch(/\bvous\b|\bvotre\b|\bvos\b/i));
  });

  it('nomme les quatre catégories avec une icône', () => {
    expect(fr.categories.essentiel.nom).toBe('Essentiel');
    expect(fr.categories.envies.nom).toBe('Envies');
    expect(fr.categories.culture.nom).toBe('Culture');
    expect(fr.categories.imprevus.nom).toBe('Imprévus');
  });

  it('formate les montants à la française', () => {
    expect(formatEuros(6300)).toBe('63 €');
    expect(formatEuros(6350)).toBe('63,50 €');
    expect(formatEuros(0)).toBe('0 €');
    expect(formatEuros(-1200)).toBe('−12 €');
  });

  it('compose les messages de l’accueil', () => {
    expect(fr.accueil.reste(6300, 'dimanche')).toBe('Il te reste 63 € jusqu’à dimanche');
    expect(fr.accueil.depassement(1200)).toBe('Tu as dépassé de 12 € cette semaine');
  });

  it('accorde les phrases avec le genre de l’objet', () => {
    const lanterne = { nom: 'lanterne', article: 'la', genre: 'f' } as const;
    const daruma = { nom: 'daruma', article: 'le', genre: 'm' } as const;
    expect(fr.messages.fele(lanterne)).toBe('La lanterne s’est fêlée.');
    expect(fr.messages.fele(daruma)).toBe('Le daruma s’est fêlé.');
    expect(fr.messages.repare(daruma)).toBe('Le daruma est réparé à l’or.');
    expect(fr.messages.repare(lanterne)).toBe('La lanterne est réparée à l’or.');
  });
});
