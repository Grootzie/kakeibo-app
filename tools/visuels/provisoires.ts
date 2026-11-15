// Visuels provisoires de la maison (J4.3) : neutres, sans style, hachurés pour qu'on ne les prenne
// jamais pour le lot définitif (Direction artistique › Premier lot, point 3). Ils suivent la fiche
// des visuels : un fond et une vue par pièce, une image de base et deux calques par objet (fêlure,
// veines d'or) dans le même cadre, un voile et une toile d'araignée, une capsule par mois.
// Les cadres viennent de la couche de style (src/ui/maison/emplacements.ts).
import type { Catalog, CatalogItem } from '../../src/domain/objets';
import { CADRE_OBJET, SCENE } from '../../src/ui/maison/emplacements.ts';
import {
  type Forme,
  TRANSPARENT,
  Toile,
  contour,
  couleur,
  ellipse,
  hachures,
  inter,
  partout,
  polygone,
  rectangle,
  sauf,
  semis,
  trait,
  union,
} from './dessin.ts';
import type { Image } from './webp.ts';

/** Dossier versionné des visuels provisoires ; le lot définitif aura le sien. */
export const DOSSIER = 'assets/maison-provisoire';

/** Densités livrées : 1x, 2x et 3x (suffixes @2x et @3x, lus par React Native). */
export const ECHELLES = [1, 2, 3] as const;

/** Cadre de la capsule gashapon, en points (1x). */
export const CADRE_CAPSULE = { largeur: 48, hauteur: 48 } as const;

export interface Visuel {
  /** Chemin sans extension ni densité, par exemple `items/daruma/base`. */
  chemin: string;
  dessiner: (echelle: number) => Image;
}

export function fichierVisuel(chemin: string, echelle: number): string {
  return echelle === 1 ? `${chemin}.webp` : `${chemin}@${echelle}x.webp`;
}

const ENCRE = couleur('#3B342C');
const MOIS = Array.from({ length: 12 }, (_, i) => i + 1);

/** Teintes provisoires par mois : mur, sol, ciel de la vue, motif de la vue, objets, capsule. */
const TEINTES: Record<
  number,
  { mur: string; sol: string; ciel: string; motif: string; objet: string; capsule: string }
> = {
  1: {
    mur: '#ECE8E1',
    sol: '#CBBFAE',
    ciel: '#C9D3DC',
    motif: '#FFFFFF',
    objet: '#C9B9A6',
    capsule: '#B4432D',
  },
  2: {
    mur: '#EAE6DD',
    sol: '#C7BCA9',
    ciel: '#D5DCE4',
    motif: '#EBC2CC',
    objet: '#BEB7AA',
    capsule: '#7A5C8E',
  },
  3: {
    mur: '#EEE7DE',
    sol: '#CDBFA8',
    ciel: '#DCE6EE',
    motif: '#F0A8B8',
    objet: '#D2B9B4',
    capsule: '#D9779A',
  },
  4: {
    mur: '#E9EBE2',
    sol: '#C3C2AC',
    ciel: '#CFE3F2',
    motif: '#F4C2CF',
    objet: '#C4C9B4',
    capsule: '#E59CB0',
  },
  5: {
    mur: '#E6EAE8',
    sol: '#C2C6BF',
    ciel: '#BFE0F5',
    motif: '#8DBF6A',
    objet: '#B6C6C3',
    capsule: '#3F7FA6',
  },
  6: {
    mur: '#E4E6E3',
    sol: '#BFC2BA',
    ciel: '#A9B4BE',
    motif: '#6F7C89',
    objet: '#B9C0BE',
    capsule: '#5B8C6E',
  },
  7: {
    mur: '#EAE7DF',
    sol: '#C9C0AE',
    ciel: '#2C3E66',
    motif: '#F4F1E6',
    objet: '#C0BBB0',
    capsule: '#2F4B7C',
  },
  8: {
    mur: '#ECE6DA',
    sol: '#CDBDA2',
    ciel: '#3A3560',
    motif: '#F2D36B',
    objet: '#CDBFA6',
    capsule: '#C27C2C',
  },
  9: {
    mur: '#EDE8DD',
    sol: '#CBC0A9',
    ciel: '#33405E',
    motif: '#F2E6B8',
    objet: '#C8BFAE',
    capsule: '#C9A227',
  },
  10: {
    mur: '#EEE6DA',
    sol: '#CDB9A0',
    ciel: '#D6E2EA',
    motif: '#C2452D',
    objet: '#CDB49E',
    capsule: '#A0522D',
  },
  11: {
    mur: '#EAE5DD',
    sol: '#C6BAA8',
    ciel: '#C8C2B4',
    motif: '#8A6A4A',
    objet: '#C2B8AA',
    capsule: '#8C6B4F',
  },
  12: {
    mur: '#E8E6E2',
    sol: '#C2BDB4',
    ciel: '#4A5468',
    motif: '#F4F4F4',
    objet: '#BDBAB3',
    capsule: '#4F6D7A',
  },
};

// ── Pièces ────────────────────────────────────────────────────────────────────────────────────

/** Ouverture de la fenêtre dans le fond : la vue se voit au travers. */
const FENETRE = { x0: 120, y0: 24, x1: 240, y1: 112 } as const;
const PLINTHE = 190;

function fond(mois: number, echelle: number): Image {
  const t = TEINTES[mois];
  const { x0, y0, x1, y1 } = FENETRE;
  const ouverture = rectangle(x0, y0, x1, y1);
  return new Toile(SCENE.largeur, SCENE.hauteur, echelle)
    .peindre(partout, couleur(t.mur))
    .peindre(hachures(24, 1), couleur(t.sol))
    .peindre(rectangle(0, PLINTHE, SCENE.largeur, SCENE.hauteur), couleur(t.sol))
    .peindre(rectangle(0, PLINTHE, SCENE.largeur, PLINTHE + 2), ENCRE)
    .peindre(sauf(rectangle(x0 - 4, y0 - 4, x1 + 4, y1 + 4), ouverture), ENCRE)
    .peindre(rectangle(x0 - 8, y1 + 4, x1 + 8, y1 + 8), ENCRE)
    .peindre(ouverture, TRANSPARENT)
    .image();
}

/** Motif d'une cellule répétée tous les `pas` points. */
const motif =
  (pas: number, f: Forme): Forme =>
  (x, y) =>
    f(((x % pas) + pas) % pas, ((y % pas) + pas) % pas);

/** Ce qu'on voit par la fenêtre, accordé au mois : neige, fleurs, pluie, étoiles, lune, feuilles. */
function vue(mois: number, echelle: number): Image {
  const t = TEINTES[mois];
  const toile = new Toile(SCENE.largeur, SCENE.hauteur, echelle).peindre(partout, couleur(t.ciel));
  const m = couleur(t.motif);
  switch (mois) {
    case 6: // pluie
      toile.peindre(
        motif(
          16,
          trait(
            [
              [4, 2],
              [8, 12],
            ],
            1.2,
          ),
        ),
        m,
      );
      break;
    case 7: // étoiles de Tanabata
    case 8: // nuit d'été
    case 12: // nuit d'hiver
      toile.peindre(semis(20, 1.2), m);
      break;
    case 9: // lune d'automne
      toile.peindre(ellipse(206, 56, 22, 22), m);
      break;
    case 4: // cerisiers
      toile.peindre(semis(10, 3), m);
      break;
    default:
      toile.peindre(semis(16, mois === 1 ? 2 : 3), m);
  }
  return toile.image();
}

// ── Objets ────────────────────────────────────────────────────────────────────────────────────

/** Silhouettes neutres, posées sur le bas du cadre (point d'ancrage), une par place dans la pièce. */
const SILHOUETTES: Forme[] = [
  rectangle(8, 22, 56, 62),
  rectangle(18, 6, 46, 62),
  polygone([
    [14, 18],
    [50, 18],
    [58, 62],
    [6, 62],
  ]),
  union(ellipse(32, 34, 22, 22), rectangle(20, 50, 44, 62)),
  polygone([
    [32, 4],
    [58, 62],
    [6, 62],
  ]),
  polygone([
    [32, 8],
    [56, 22],
    [56, 48],
    [32, 62],
    [8, 48],
    [8, 22],
  ]),
  union(ellipse(32, 44, 18, 18), rectangle(26, 8, 38, 30)),
  union(
    polygone([
      [32, 4],
      [54, 30],
      [32, 54],
      [10, 30],
    ]),
    rectangle(24, 52, 40, 62),
  ),
];

/** Fêlure provisoire : une ligne brisée dans l'axe de l'objet, toujours dans sa silhouette. */
const FELURE: [number, number][] = [
  [30, 26],
  [35, 33],
  [29, 40],
  [35, 47],
  [31, 54],
];

function silhouette(catalogue: Catalog, item: CatalogItem): Forme {
  const place = catalogue.items.filter((i) => i.room === item.room).indexOf(item);
  return SILHOUETTES[place % SILHOUETTES.length];
}

function objet(catalogue: Catalog, item: CatalogItem, calque: string, echelle: number): Image {
  const forme = silhouette(catalogue, item);
  const mois = catalogue.rooms.find((r) => r.id === item.room)?.month ?? 1;
  const toile = new Toile(CADRE_OBJET.largeur, CADRE_OBJET.hauteur, echelle);
  if (calque === 'base') {
    const teinte = item.source === 'base' ? '#D8D1C4' : TEINTES[mois].objet;
    return toile
      .peindre(forme, couleur(teinte))
      .peindre(inter(forme, hachures(8, 1.5)), couleur('#FFFFFF', 255))
      .peindre(contour(forme, 1.5), ENCRE)
      .image();
  }
  const ligne = calque === 'crack' ? trait(FELURE, 1.5) : trait(FELURE, 2.5);
  const teinte = calque === 'crack' ? couleur('#1F1B16') : couleur('#C9A227');
  return toile.peindre(inter(forme, ligne), teinte).image();
}

// ── Poussière et capsules ─────────────────────────────────────────────────────────────────────

function voile(echelle: number): Image {
  return new Toile(SCENE.largeur, SCENE.hauteur, echelle)
    .peindre(partout, couleur('#8C8273', 56))
    .peindre(semis(18, 0.8), couleur('#6E6559', 120))
    .image();
}

function toileAraignee(echelle: number): Image {
  const coin = (cx: number, cy: number, sx: number): Forme => {
    const rayons = [0, 1, 2, 3].map((k) => {
      const a = (k * Math.PI) / 6;
      return trait(
        [
          [cx, cy],
          [cx + sx * 90 * Math.cos(a), cy + 90 * Math.sin(a)],
        ],
        1,
      );
    });
    const arcs = [30, 55, 80].map((r) => (x: number, y: number) => {
      const d = Math.hypot(x - cx, y - cy);
      return Math.abs(d - r) < 0.6 && sx * (x - cx) >= 0 && y - cy >= 0;
    });
    return union(...rayons, ...arcs);
  };
  return new Toile(SCENE.largeur, SCENE.hauteur, echelle)
    .peindre(union(coin(0, 0, 1), coin(SCENE.largeur, 0, -1)), couleur('#8C877E', 210))
    .image();
}

function capsule(mois: number, echelle: number): Image {
  const c = CADRE_CAPSULE.largeur / 2;
  const boule = ellipse(c, c, 21, 21);
  return new Toile(CADRE_CAPSULE.largeur, CADRE_CAPSULE.hauteur, echelle)
    .peindre(boule, couleur('#F4F1EA'))
    .peindre(
      inter(boule, rectangle(0, 0, CADRE_CAPSULE.largeur, c)),
      couleur(TEINTES[mois].capsule),
    )
    .peindre(inter(boule, rectangle(0, c - 1, CADRE_CAPSULE.largeur, c + 1)), ENCRE)
    .peindre(contour(boule, 1.5), ENCRE)
    .image();
}

/** Tous les visuels provisoires, dans un ordre fixe. */
export function listeVisuels(catalogue: Catalog): Visuel[] {
  const mois2 = (m: number) => String(m).padStart(2, '0');
  return [
    ...catalogue.rooms.flatMap((piece) => [
      { chemin: `rooms/${piece.id}/background`, dessiner: (e: number) => fond(piece.month, e) },
      { chemin: `rooms/${piece.id}/view`, dessiner: (e: number) => vue(piece.month, e) },
    ]),
    ...catalogue.items.flatMap((item) =>
      ['base', 'crack', 'gold'].map((calque) => ({
        chemin: `items/${item.id}/${calque}`,
        dessiner: (e: number) => objet(catalogue, item, calque, e),
      })),
    ),
    { chemin: 'dust/veil', dessiner: voile },
    { chemin: 'dust/cobweb', dessiner: toileAraignee },
    ...MOIS.map((m) => ({
      chemin: `capsules/${mois2(m)}`,
      dessiner: (e: number) => capsule(m, e),
    })),
  ];
}
