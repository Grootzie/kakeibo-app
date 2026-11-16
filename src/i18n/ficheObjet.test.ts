// Fiche d'objet (E8, J4.7, #86) : phrases d'histoire, accordées avec l'article et le genre du
// catalogue (Textes et ton › Messages d'explication › Fiche d'objet).
import { type NomObjet, fr } from './fr';

const NBSP = ' ';
const f = fr.ficheObjet;
const daruma: NomObjet = { nom: 'daruma', article: 'le', genre: 'm' };
const echelle: NomObjet = { nom: 'échelle', article: "l'", genre: 'f' };
const etageres: NomObjet = { nom: 'étagères', article: 'les', genre: 'f' };
const zabuton: NomObjet = { nom: 'coussins zabuton', article: 'les', genre: 'm' };
const gagne = (lundi: string) => ({ type: 'gagne' as const, lundi });
const base = (jour: string) => ({ type: 'base' as const, jour });

describe('histoire d’un objet', () => {
  it('l’exemple de la spec : gagné, fêlé puis réparé à l’or dans le même mois', () => {
    expect(
      f.histoire(daruma, {
        arrivee: gagne('2026-11-02'),
        felure: '2026-11-15',
        reparation: '2026-11-22',
      }),
    ).toBe(`Gagné la semaine du 2${NBSP}novembre. Fêlé le 15, réparé à l’or le 22.`);
  });

  it('intact : seule la semaine où il a été gagné', () => {
    expect(
      f.histoire(daruma, { arrivee: gagne('2026-11-02'), felure: null, reparation: null }),
    ).toBe(`Gagné la semaine du 2${NBSP}novembre.`);
  });

  it('fêlé, pas encore réparé : la fêlure seule', () => {
    expect(
      f.histoire(echelle, { arrivee: base('2026-11-02'), felure: '2026-11-08', reparation: null }),
    ).toBe(`Dans ta maison depuis le 2${NBSP}novembre. Fêlée le 8.`);
  });

  it('objet de base : depuis quand il est là, accordé au féminin pluriel', () => {
    expect(
      f.histoire(etageres, { arrivee: base('2026-03-01'), felure: null, reparation: null }),
    ).toBe(`Dans ta maison depuis le 1er${NBSP}mars.`);
    expect(
      f.histoire(etageres, {
        arrivee: base('2026-11-02'),
        felure: '2026-11-15',
        reparation: '2026-11-22',
      }),
    ).toBe(`Dans ta maison depuis le 2${NBSP}novembre. Fêlées le 15, réparées à l’or le 22.`);
  });

  it('masculin pluriel', () => {
    expect(
      f.histoire(zabuton, {
        arrivee: gagne('2026-02-02'),
        felure: '2026-02-15',
        reparation: '2026-02-22',
      }),
    ).toBe(`Gagnés la semaine du 2${NBSP}février. Fêlés le 15, réparés à l’or le 22.`);
  });

  it('dates à cheval sur deux mois : le mois est redit quand il change', () => {
    expect(
      f.histoire(echelle, {
        arrivee: gagne('2026-11-30'),
        felure: '2026-12-06',
        reparation: '2026-12-13',
      }),
    ).toBe(
      `Gagnée la semaine du 30${NBSP}novembre. Fêlée le 6${NBSP}décembre, réparée à l’or le 13.`,
    );
    expect(
      f.histoire(daruma, {
        arrivee: gagne('2026-10-26'),
        felure: '2026-10-31',
        reparation: '2026-11-08',
      }),
    ).toBe(`Gagné la semaine du 26${NBSP}octobre. Fêlé le 31, réparé à l’or le 8${NBSP}novembre.`);
    expect(
      f.histoire(daruma, { arrivee: gagne('2026-11-30'), felure: '2026-12-01', reparation: null }),
    ).toBe(`Gagné la semaine du 30${NBSP}novembre. Fêlé le 1er${NBSP}décembre.`);
  });

  it('semaine 1 qui commence en décembre : même jour de mois, autre année, le mois est redit', () => {
    expect(
      f.histoire(daruma, { arrivee: gagne('2025-12-29'), felure: '2026-12-13', reparation: null }),
    ).toBe(`Gagné la semaine du 29${NBSP}décembre. Fêlé le 13${NBSP}décembre.`);
  });
});

describe('nom japonais et libellés', () => {
  it('le nom japonais lu au lecteur d’écran', () => {
    expect(f.japonaisLibelle({ kanji: '達磨', romaji: 'daruma' })).toBe(
      `En japonais${NBSP}: daruma, 達磨`,
    );
  });

  it('les titres et le retour', () => {
    expect(f.auJapon).toBe('Au Japon');
    expect(f.sonHistoire).toBe('Son histoire');
    expect(f.retourLibelle).toBe('Retour à ta maison');
  });
});
