// Encodeur WebP sans perte (VP8L) des visuels provisoires (J4.3) : en-tête, transparence et aller-retour.
import { encoderWebp, type Image } from './webp';
import { enTeteWebp, lireWebp } from './lireWebp';

function image(largeur: number, hauteur: number, pixel: (x: number, y: number) => number[]): Image {
  const pixels = new Uint8Array(largeur * hauteur * 4);
  for (let y = 0; y < hauteur; y++)
    for (let x = 0; x < largeur; x++) pixels.set(pixel(x, y), (y * largeur + x) * 4);
  return { largeur, hauteur, pixels };
}

/** Suite pseudo-aléatoire fixe : le test reste déterministe. */
function suite(graine: number): () => number {
  let s = graine;
  return () => {
    s = (s * 1103515245 + 12345) >>> 0;
    return (s >>> 16) & 0xff;
  };
}

const ascii = (octets: Uint8Array, debut: number) =>
  String.fromCharCode(...octets.subarray(debut, debut + 4));

describe('encodeur WebP sans perte', () => {
  it('écrit un fichier RIFF WEBP VP8L avec la taille et le canal alpha', () => {
    const octets = encoderWebp(image(37, 5, () => [10, 20, 30, 0]));
    expect(ascii(octets, 0)).toBe('RIFF');
    expect(ascii(octets, 8)).toBe('WEBP');
    expect(ascii(octets, 12)).toBe('VP8L');
    expect(octets[20]).toBe(0x2f);
    const taille = octets[4] | (octets[5] << 8) | (octets[6] << 16) | (octets[7] << 24);
    expect(taille).toBe(octets.length - 8);
    expect(octets.length % 2).toBe(0);
    expect(enTeteWebp(octets)).toEqual({ largeur: 37, hauteur: 5, alpha: true });
  });

  const cas: [string, Image][] = [
    ['un seul pixel', image(1, 1, () => [200, 100, 50, 255])],
    ['une couleur unie', image(40, 30, () => [242, 236, 226, 255])],
    [
      'un fond transparent',
      image(20, 20, (x, y) => (x > 5 && y > 5 ? [9, 8, 7, 255] : [0, 0, 0, 0])),
    ],
    [
      'des bandes et des rangées répétées',
      image(50, 40, (x, y) => (x % 7 < 3 ? [x * 5, y * 6, 120, 255] : [30, 40, 50, 128])),
    ],
    [
      'du bruit sans répétition',
      (() => {
        const hasard = suite(42);
        return image(33, 17, () => [hasard(), hasard(), hasard(), hasard()]);
      })(),
    ],
    ['une longue plage (plus de 4 096 pixels)', image(300, 40, () => [1, 2, 3, 255])],
    ['une image très large', image(1080, 3, (x) => (x < 540 ? [1, 2, 3, 255] : [4, 5, 6, 255]))],
  ];

  it.each(cas)('rend à la lecture exactement les pixels encodés : %s', (_, img) => {
    const lu = lireWebp(encoderWebp(img));
    expect([lu.largeur, lu.hauteur]).toEqual([img.largeur, img.hauteur]);
    expect(Buffer.from(lu.pixels).equals(Buffer.from(img.pixels))).toBe(true);
  });

  it('donne toujours les mêmes octets pour la même image', () => {
    const img = cas[3][1];
    expect(Buffer.from(encoderWebp(img)).equals(Buffer.from(encoderWebp(img)))).toBe(true);
  });

  it('compresse les aplats : une scène unie de 1 080 × 810 tient en moins de 1 Ko', () => {
    expect(encoderWebp(image(1080, 810, () => [242, 236, 226, 255])).length).toBeLessThan(1024);
  });

  it('refuse une image vide ou trop grande pour le format', () => {
    expect(() => encoderWebp(image(0, 3, () => [0, 0, 0, 0]))).toThrow();
    expect(() =>
      encoderWebp({ largeur: 16385, hauteur: 1, pixels: new Uint8Array(16385 * 4) }),
    ).toThrow();
  });
});
