// Lecture du montant tapé au pavé numérique (E3) : virgule ou point, deux décimales au plus.
import { lireMontant } from './montant';

describe('montant tapé', () => {
  it('se lit en centimes, avec la virgule ou le point', () => {
    expect(lireMontant('12')).toBe(1200);
    expect(lireMontant('12,5')).toBe(1250);
    expect(lireMontant('12,50')).toBe(1250);
    expect(lireMontant('12.05')).toBe(1205);
    expect(lireMontant('0,01')).toBe(1);
    expect(lireMontant(',5')).toBe(50);
    expect(lireMontant('12,')).toBe(1200);
    expect(lireMontant('99999,99')).toBe(9_999_999);
    expect(lireMontant(' 1 234,5 ')).toBe(123450);
  });

  it('ne se lit pas s’il est vide ou mal formé', () => {
    expect(lireMontant('')).toBeNull();
    expect(lireMontant(',')).toBeNull();
    expect(lireMontant('12,345')).toBeNull();
    expect(lireMontant('1,2,3')).toBeNull();
    expect(lireMontant('-5')).toBeNull();
    expect(lireMontant('abc')).toBeNull();
  });

  it('reste exact sans erreur d’arrondi des nombres à virgule', () => {
    expect(lireMontant('0,29')).toBe(29);
    expect(lireMontant('1,15')).toBe(115);
    expect(lireMontant('4,35')).toBe(435);
  });
});
