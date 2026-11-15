// Lecture des WebP sans perte produits par `webp.ts`, pour les tests des visuels provisoires (J4.3) :
// en-tête, codes préfixes simples et normaux, copies LZ77 du pixel de gauche, du dessus ou à
// distance donnée. Les transformations, le cache de couleurs et les groupes de codes ne sont pas lus.
import { ORDRE_LONGUEURS, codesCanoniques } from './webp.ts';
import type { Image } from './webp.ts';

const ascii = (o: Uint8Array, d: number) => String.fromCharCode(...o.subarray(d, d + 4));

/** Taille et canal alpha déclarés dans l'en-tête VP8L. */
export function enTeteWebp(octets: Uint8Array): {
  largeur: number;
  hauteur: number;
  alpha: boolean;
} {
  if (ascii(octets, 0) !== 'RIFF' || ascii(octets, 8) !== 'WEBP' || ascii(octets, 12) !== 'VP8L')
    throw new Error('Pas un WebP sans perte');
  if (octets[20] !== 0x2f) throw new Error('Signature VP8L absente');
  const v = (octets[21] | (octets[22] << 8) | (octets[23] << 16) | (octets[24] << 24)) >>> 0;
  return {
    largeur: (v & 0x3fff) + 1,
    hauteur: ((v >>> 14) & 0x3fff) + 1,
    alpha: ((v >>> 28) & 1) === 1,
  };
}

class Lecteur {
  private pos = 0;
  private readonly octets: Uint8Array;
  constructor(octets: Uint8Array) {
    this.octets = octets;
  }

  lire(nb: number): number {
    let v = 0;
    for (let i = 0; i < nb; i++) {
      const octet = this.octets[this.pos >>> 3];
      if (octet === undefined) throw new Error('Flux tronqué');
      v |= ((octet >>> (this.pos & 7)) & 1) << i;
      this.pos++;
    }
    return v >>> 0;
  }
}

type Decodeur = (l: Lecteur) => number;

function decodeur(longueurs: number[]): Decodeur {
  const utilises = longueurs.flatMap((l, i) => (l > 0 ? [i] : []));
  if (utilises.length === 0) throw new Error('Code préfixe vide');
  if (utilises.length === 1) return () => utilises[0];
  const { codes } = codesCanoniques(longueurs);
  const table = new Map<string, number>();
  utilises.forEach((s) => table.set(`${longueurs[s]}:${codes[s]}`, s));
  return (l) => {
    let code = 0;
    for (let n = 1; n <= 15; n++) {
      code = (code << 1) | l.lire(1);
      const s = table.get(`${n}:${code}`);
      if (s !== undefined) return s;
    }
    throw new Error('Code préfixe inconnu');
  };
}

function lireCode(l: Lecteur, taille: number): Decodeur {
  const longueurs = new Array<number>(taille).fill(0);
  if (l.lire(1) === 1) {
    const nb = l.lire(1) + 1;
    longueurs[l.lire(l.lire(1) === 1 ? 8 : 1)] = 1;
    if (nb === 2) longueurs[l.lire(8)] = 1;
    return decodeur(longueurs);
  }
  const nbLongueurs = l.lire(4) + 4;
  const longueursJetons = new Array<number>(19).fill(0);
  for (let i = 0; i < nbLongueurs; i++) longueursJetons[ORDRE_LONGUEURS[i]] = l.lire(3);
  const jeton = decodeur(longueursJetons);
  let max = taille;
  if (l.lire(1) === 1) max = 2 + l.lire(2 + 2 * l.lire(3));
  let precedente = 8;
  for (let s = 0; s < taille && max-- > 0;) {
    const j = jeton(l);
    if (j < 16) {
      longueurs[s++] = j;
      if (j !== 0) precedente = j;
    } else {
      const [extra, base, valeur] =
        j === 16 ? [2, 3, precedente] : j === 17 ? [3, 3, 0] : [7, 11, 0];
      const n = l.lire(extra) + base;
      for (let k = 0; k < n; k++) longueurs[s++] = valeur;
    }
  }
  return decodeur(longueurs);
}

function copie(l: Lecteur, code: number): number {
  if (code < 4) return code + 1;
  const extra = (code - 2) >>> 1;
  return ((2 + (code & 1)) << extra) + l.lire(extra) + 1;
}

export function lireWebp(octets: Uint8Array): Image {
  const { largeur, hauteur } = enTeteWebp(octets);
  const taille = octets[16] | (octets[17] << 8) | (octets[18] << 16) | (octets[19] << 24);
  const l = new Lecteur(octets.subarray(20, 20 + taille));
  l.lire(8 + 14 + 14 + 1 + 3);
  if (l.lire(1) !== 0) throw new Error('Transformations non lues');
  if (l.lire(1) !== 0) throw new Error('Cache de couleurs non lu');
  if (l.lire(1) !== 0) throw new Error('Groupes de codes non lus');
  const vert = lireCode(l, 256 + 24);
  const rouge = lireCode(l, 256);
  const bleu = lireCode(l, 256);
  const alpha = lireCode(l, 256);
  const distance = lireCode(l, 40);

  const total = largeur * hauteur;
  const pixels = new Uint8Array(total * 4);
  for (let i = 0; i < total;) {
    const g = vert(l);
    if (g < 256) {
      pixels[i * 4 + 1] = g;
      pixels[i * 4] = rouge(l);
      pixels[i * 4 + 2] = bleu(l);
      pixels[i * 4 + 3] = alpha(l);
      i++;
      continue;
    }
    const longueur = copie(l, g - 256);
    const plan = copie(l, distance(l));
    const d = plan > 120 ? plan - 120 : plan === 1 ? largeur : plan === 2 ? 1 : NaN;
    if (Number.isNaN(d)) throw new Error(`Code de plan non lu : ${plan}`);
    if (d > i || i + longueur > total) throw new Error('Copie hors de l’image');
    for (let k = 0; k < longueur; k++, i++) pixels.copyWithin(i * 4, (i - d) * 4, (i - d) * 4 + 4);
  }
  return { largeur, hauteur, pixels };
}
