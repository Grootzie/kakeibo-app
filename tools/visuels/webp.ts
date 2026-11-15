// Encodeur WebP sans perte (VP8L, RFC 9649), écrit pour les visuels provisoires de la maison (J4.3) :
// aucune dépendance, aucun service en ligne. Il vise des images simples, en aplats : pas de
// transformation ni de cache de couleurs, un seul groupe de codes préfixes, et des copies LZ77
// limitées au pixel de gauche et au pixel du dessus, ce qui suffit à compresser les aplats.
// Déterministe : la même image donne toujours les mêmes octets.

/** Image en RVBA, 4 octets par pixel, ligne après ligne. */
export interface Image {
  largeur: number;
  hauteur: number;
  pixels: Uint8Array;
}

/** Écriture bit à bit, du bit de poids faible au bit de poids fort (convention VP8L). */
class Bits {
  private readonly octets: number[] = [];
  private acc = 0;
  private n = 0;

  ecrire(valeur: number, nb: number): void {
    for (let i = 0; i < nb; i++) {
      this.acc |= ((valeur >>> i) & 1) << this.n;
      this.n++;
      if (this.n === 8) {
        this.octets.push(this.acc);
        this.acc = 0;
        this.n = 0;
      }
    }
  }

  /** Code préfixe : bit de poids fort d'abord, comme DEFLATE. */
  ecrireCode(code: number, longueur: number): void {
    for (let i = longueur - 1; i >= 0; i--) this.ecrire((code >>> i) & 1, 1);
  }

  fin(): Uint8Array {
    if (this.n > 0) this.octets.push(this.acc);
    this.acc = 0;
    this.n = 0;
    return Uint8Array.from(this.octets);
  }
}

/** Longueurs d'un code de Huffman limité à `limite` bits ; un symbole seul reçoit 1 (lu sur 0 bit). */
export function longueursHuffman(frequences: readonly number[], limite: number): number[] {
  const longueurs = frequences.map(() => 0);
  const utilises = frequences.flatMap((f, i) => (f > 0 ? [i] : []));
  if (utilises.length === 0) return longueurs;
  if (utilises.length === 1) {
    longueurs[utilises[0]] = 1;
    return longueurs;
  }
  // Trop profond : on relève les fréquences les plus faibles, puis on recommence.
  for (let plancher = 1; ; plancher *= 2) {
    const poids = utilises.map((i) => Math.max(frequences[i], plancher));
    const parent: number[] = [];
    const vivants = poids.map((w, i) => ({ w, id: i }));
    let prochain = poids.length;
    while (vivants.length > 1) {
      vivants.sort((a, b) => a.w - b.w || a.id - b.id);
      const [a, b] = vivants.splice(0, 2);
      const id = prochain++;
      parent[a.id] = id;
      parent[b.id] = id;
      vivants.push({ w: a.w + b.w, id });
    }
    const racine = vivants[0].id;
    const profondeur = (noeud: number): number => {
      let p = 0;
      for (let n = noeud; n !== racine; n = parent[n]) p++;
      return p;
    };
    const p = utilises.map((_, i) => profondeur(i));
    if (Math.max(...p) <= limite) {
      utilises.forEach((s, i) => (longueurs[s] = p[i]));
      return longueurs;
    }
  }
}

/** Codes canoniques (DEFLATE) ; un code à un seul symbole s'écrit sur 0 bit. */
export function codesCanoniques(longueurs: readonly number[]): {
  codes: number[];
  tailles: number[];
} {
  const utilises = longueurs.filter((l) => l > 0).length;
  if (utilises <= 1) return { codes: longueurs.map(() => 0), tailles: longueurs.map(() => 0) };
  const max = Math.max(...longueurs);
  const compte = new Array<number>(max + 1).fill(0);
  for (const l of longueurs) if (l > 0) compte[l]++;
  const suivant = new Array<number>(max + 1).fill(0);
  let code = 0;
  for (let l = 1; l <= max; l++) {
    code = (code + compte[l - 1]) << 1;
    suivant[l] = code;
  }
  const codes = longueurs.map((l) => (l > 0 ? suivant[l]++ : 0));
  return { codes, tailles: [...longueurs] };
}

/** Ordre des longueurs du code des longueurs (RFC 9649, 3.7.2.1.2). */
export const ORDRE_LONGUEURS = [17, 18, 0, 1, 2, 3, 4, 5, 16, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

interface CodePrefixe {
  codes: number[];
  tailles: number[];
}

/** Écrit un code préfixe et rend de quoi coder ses symboles. */
function ecrireCodePrefixe(bits: Bits, frequences: readonly number[]): CodePrefixe {
  const longueurs = longueursHuffman(frequences, 15);
  const utilises = longueurs.flatMap((l, i) => (l > 0 ? [i] : []));
  if (utilises.length <= 1 && (utilises[0] ?? 0) < 256) {
    // Code simple à un symbole : aucun bit par symbole.
    const s = utilises[0] ?? 0;
    bits.ecrire(1, 1);
    bits.ecrire(0, 1);
    bits.ecrire(s < 2 ? 0 : 1, 1);
    bits.ecrire(s, s < 2 ? 1 : 8);
    return codesCanoniques(longueurs);
  }

  // Code normal : les longueurs, avec les répétitions de zéros (17 et 18).
  const jetons: { s: number; extra: number; nb: number }[] = [];
  for (let i = 0; i < longueurs.length;) {
    if (longueurs[i] === 0) {
      let n = 0;
      while (i + n < longueurs.length && longueurs[i + n] === 0 && n < 138) n++;
      if (n >= 11) jetons.push({ s: 18, extra: n - 11, nb: 7 });
      else if (n >= 3) jetons.push({ s: 17, extra: n - 3, nb: 3 });
      else for (let k = 0; k < n; k++) jetons.push({ s: 0, extra: 0, nb: 0 });
      i += n;
    } else {
      jetons.push({ s: longueurs[i], extra: 0, nb: 0 });
      i++;
    }
  }
  const freqJetons = new Array<number>(19).fill(0);
  for (const j of jetons) freqJetons[j.s]++;
  const longueursJetons = longueursHuffman(freqJetons, 7);
  const codeJetons = codesCanoniques(longueursJetons);

  bits.ecrire(0, 1);
  let nb = 4;
  ORDRE_LONGUEURS.forEach((s, i) => {
    if (longueursJetons[s] > 0) nb = Math.max(nb, i + 1);
  });
  bits.ecrire(nb - 4, 4);
  for (let i = 0; i < nb; i++) bits.ecrire(longueursJetons[ORDRE_LONGUEURS[i]], 3);
  bits.ecrire(0, 1); // max_symbol = taille de l'alphabet
  for (const j of jetons) {
    bits.ecrireCode(codeJetons.codes[j.s], codeJetons.tailles[j.s]);
    bits.ecrire(j.extra, j.nb);
  }
  return codesCanoniques(longueurs);
}

/** Préfixe et bits supplémentaires d'une longueur ou d'une distance (valeur ≥ 1). */
export function prefixe(valeur: number): { code: number; extra: number; nb: number } {
  if (valeur <= 2) return { code: valeur - 1, extra: 0, nb: 0 };
  const d = valeur - 1;
  const haut = 31 - Math.clz32(d);
  const second = (d >>> (haut - 1)) & 1;
  const nb = haut - 1;
  return { code: 2 * haut + second, extra: d & ((1 << nb) - 1), nb };
}

/** Codes de plan VP8L : 1 = pixel du dessus, 2 = pixel de gauche. */
const PLAN_DESSUS = 1;
const PLAN_GAUCHE = 2;
const LONGUEUR_MAX = 4096;
const LONGUEUR_MIN = 3;

type Jeton = { copie: false; i: number } | { copie: true; longueur: number; plan: number };

export function encoderWebp(image: Image): Uint8Array {
  const { largeur, hauteur, pixels } = image;
  if (largeur < 1 || hauteur < 1 || largeur > 16384 || hauteur > 16384)
    throw new Error(`Taille impossible en WebP : ${largeur} × ${hauteur}`);
  if (pixels.length !== largeur * hauteur * 4) throw new Error('Nombre de pixels incohérent');
  const total = largeur * hauteur;
  const px = new Uint32Array(total);
  for (let i = 0; i < total; i++)
    px[i] =
      (pixels[i * 4] |
        (pixels[i * 4 + 1] << 8) |
        (pixels[i * 4 + 2] << 16) |
        (pixels[i * 4 + 3] << 24)) >>>
      0;

  // LZ77 glouton : la plus longue répétition du pixel de gauche ou de la ligne du dessus.
  const jetons: Jeton[] = [];
  const course = (i: number, distance: number) => {
    let n = 0;
    while (i + n < total && n < LONGUEUR_MAX && px[i + n] === px[i + n - distance]) n++;
    return n;
  };
  for (let i = 0; i < total;) {
    const gauche = i >= 1 ? course(i, 1) : 0;
    const dessus = i >= largeur ? course(i, largeur) : 0;
    const longueur = Math.max(gauche, dessus);
    if (longueur >= LONGUEUR_MIN) {
      jetons.push({ copie: true, longueur, plan: gauche >= dessus ? PLAN_GAUCHE : PLAN_DESSUS });
      i += longueur;
    } else {
      jetons.push({ copie: false, i });
      i++;
    }
  }

  const vert = new Array<number>(256 + 24).fill(0);
  const rouge = new Array<number>(256).fill(0);
  const bleu = new Array<number>(256).fill(0);
  const alpha = new Array<number>(256).fill(0);
  const distance = new Array<number>(40).fill(0);
  for (const j of jetons) {
    if (j.copie) {
      vert[256 + prefixe(j.longueur).code]++;
      distance[prefixe(j.plan).code]++;
    } else {
      const o = j.i * 4;
      rouge[pixels[o]]++;
      vert[pixels[o + 1]]++;
      bleu[pixels[o + 2]]++;
      alpha[pixels[o + 3]]++;
    }
  }

  const bits = new Bits();
  bits.ecrire(0x2f, 8);
  bits.ecrire(largeur - 1, 14);
  bits.ecrire(hauteur - 1, 14);
  bits.ecrire(1, 1); // canal alpha : fond transparent
  bits.ecrire(0, 3); // version
  bits.ecrire(0, 1); // aucune transformation
  bits.ecrire(0, 1); // pas de cache de couleurs
  bits.ecrire(0, 1); // un seul groupe de codes préfixes
  const cVert = ecrireCodePrefixe(bits, vert);
  const cRouge = ecrireCodePrefixe(bits, rouge);
  const cBleu = ecrireCodePrefixe(bits, bleu);
  const cAlpha = ecrireCodePrefixe(bits, alpha);
  const cDistance = ecrireCodePrefixe(bits, distance);
  const symbole = (c: CodePrefixe, s: number) => bits.ecrireCode(c.codes[s], c.tailles[s]);
  for (const j of jetons) {
    if (j.copie) {
      const l = prefixe(j.longueur);
      symbole(cVert, 256 + l.code);
      bits.ecrire(l.extra, l.nb);
      const d = prefixe(j.plan);
      symbole(cDistance, d.code);
      bits.ecrire(d.extra, d.nb);
    } else {
      const o = j.i * 4;
      symbole(cVert, pixels[o + 1]);
      symbole(cRouge, pixels[o]);
      symbole(cBleu, pixels[o + 2]);
      symbole(cAlpha, pixels[o + 3]);
    }
  }
  const flux = bits.fin();

  const bourrage = flux.length % 2;
  const sortie = new Uint8Array(20 + flux.length + bourrage);
  const ascii = (s: string, o: number) => {
    for (let k = 0; k < 4; k++) sortie[o + k] = s.charCodeAt(k);
  };
  const entier = (v: number, o: number) => {
    for (let k = 0; k < 4; k++) sortie[o + k] = (v >>> (8 * k)) & 0xff;
  };
  ascii('RIFF', 0);
  entier(sortie.length - 8, 4);
  ascii('WEBP', 8);
  ascii('VP8L', 12);
  entier(flux.length, 16);
  sortie.set(flux, 20);
  return sortie;
}
