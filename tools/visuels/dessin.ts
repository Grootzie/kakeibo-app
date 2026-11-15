// Primitives de dessin des visuels provisoires (J4.3) : formes décrites en points (1x), tracées
// au centre de chaque pixel à l'échelle demandée, sans anticrénelage. Le même dessin donne donc
// les versions 1x, 2x et 3x, alignées sur le même cadre.
import type { Image } from './webp';

/** Rouge, vert, bleu, opacité (0 à 255). */
export type Couleur = readonly [number, number, number, number];

/** Une forme : vraie pour un point (en points 1x) qui lui appartient. */
export type Forme = (x: number, y: number) => boolean;

export const TRANSPARENT: Couleur = [0, 0, 0, 0];

export function couleur(hex: string, opacite = 255): Couleur {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
    opacite,
  ];
}

export class Toile {
  readonly pixels: Uint8Array;
  readonly largeur: number;
  readonly hauteur: number;
  private readonly echelle: number;

  constructor(largeur1x: number, hauteur1x: number, echelle: number) {
    this.echelle = echelle;
    this.largeur = largeur1x * echelle;
    this.hauteur = hauteur1x * echelle;
    this.pixels = new Uint8Array(this.largeur * this.hauteur * 4);
  }

  /** Peint la forme, en remplaçant les pixels (pas de mélange). */
  peindre(forme: Forme, c: Couleur): this {
    const s = this.echelle;
    for (let py = 0; py < this.hauteur; py++)
      for (let px = 0; px < this.largeur; px++)
        if (forme((px + 0.5) / s, (py + 0.5) / s)) {
          // Un pixel transparent n'a pas de couleur : il se compresse mieux.
          this.pixels.set(c[3] === 0 ? TRANSPARENT : c, (py * this.largeur + px) * 4);
        }
    return this;
  }

  image(): Image {
    return { largeur: this.largeur, hauteur: this.hauteur, pixels: this.pixels };
  }
}

export const partout: Forme = () => true;

export const rectangle =
  (x0: number, y0: number, x1: number, y1: number): Forme =>
  (x, y) =>
    x >= x0 && x < x1 && y >= y0 && y < y1;

export const ellipse =
  (cx: number, cy: number, rx: number, ry: number): Forme =>
  (x, y) =>
    ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/** Polygone, règle pair-impair. */
export const polygone =
  (points: readonly (readonly [number, number])[]): Forme =>
  (x, y) => {
    let dedans = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
    }
    return dedans;
  };

/** Ligne brisée d'épaisseur donnée. */
export const trait =
  (points: readonly (readonly [number, number])[], epaisseur: number): Forme =>
  (x, y) => {
    const r2 = (epaisseur / 2) ** 2;
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1];
      const [bx, by] = points[i];
      const dx = bx - ax;
      const dy = by - ay;
      const t = Math.max(
        0,
        Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)),
      );
      if ((x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2 <= r2) return true;
    }
    return false;
  };

export const union =
  (...formes: Forme[]): Forme =>
  (x, y) =>
    formes.some((f) => f(x, y));

export const inter =
  (...formes: Forme[]): Forme =>
  (x, y) =>
    formes.every((f) => f(x, y));

export const sauf =
  (forme: Forme, trou: Forme): Forme =>
  (x, y) =>
    forme(x, y) && !trou(x, y);

/** Bord intérieur d'une forme, d'épaisseur donnée. */
export const contour =
  (forme: Forme, epaisseur: number): Forme =>
  (x, y) => {
    if (!forme(x, y)) return false;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      if (!forme(x + epaisseur * Math.cos(a), y + epaisseur * Math.sin(a))) return true;
    }
    return false;
  };

/** Hachures diagonales, un trait tous les `pas` points : la marque des visuels provisoires. */
export const hachures =
  (pas: number, epaisseur: number): Forme =>
  (x, y) =>
    (((x + y) % pas) + pas) % pas < epaisseur;

/** Points disposés en quinconce, tous les `pas` points. */
export const semis =
  (pas: number, rayon: number, decalage = 0): Forme =>
  (x, y) => {
    const ligne = Math.floor((y - decalage) / pas);
    const dx = ligne % 2 === 0 ? 0 : pas / 2;
    const cx = Math.floor((x - dx - decalage) / pas) * pas + pas / 2 + dx + decalage;
    const cy = ligne * pas + pas / 2 + decalage;
    return (x - cx) ** 2 + (y - cy) ** 2 <= rayon * rayon;
  };
