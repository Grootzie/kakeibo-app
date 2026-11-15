// Rendu réel de la maison (J4.4) : le dessin Skia de CalquesMaison, avec le vrai moteur (CanvasKit)
// et les visuels provisoires, hors écran. Vérifie les pixels des trois états d'objet et des trois
// niveaux de poussière ; avec CAPTURES=1, enregistre les images dans docs/captures/83.
//
// Projet Jest « rendu » (package.json) : environnement Node, résolution web de Skia. Skia ne se
// charge qu'une fois CanvasKit prêt, d'où les `require` dans beforeAll.
/* eslint-disable @typescript-eslint/no-require-imports */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';

import { catalogue } from '../../content/catalogue';
import type { HouseScene } from '../../domain/maison';
import { emplacement } from './emplacements';
import { type Calque, planDeScene } from './plan';
import { objetScene, sceneNovembre } from './scenesDeTest';

type Headless = typeof import('@shopify/react-native-skia/lib/commonjs/headless');
type SkImage = import('@shopify/react-native-skia').SkImage;

const racine = join(__dirname, '..', '..', '..');
const ECHELLE = 2;
const L = 360 * ECHELLE;
const H = 270 * ECHELLE;

let skia: Headless;
let dessiner: (plan: Calque[]) => Promise<Uint8Array>;
let encoder: (plan: Calque[]) => Promise<Uint8Array>;

beforeAll(async () => {
  const CanvasKitInit = require('canvaskit-wasm/bin/full/canvaskit');
  (global as unknown as { CanvasKit: unknown }).CanvasKit = await CanvasKitInit({});
  await require('@shopify/react-native-skia/lib/commonjs/web').LoadSkiaWeb();
  skia = require('@shopify/react-native-skia/lib/commonjs/headless');
  const { Skia } = skia.getSkiaExports();
  const { VISUELS_PROVISOIRES } =
    jest.requireActual<typeof import('./visuelsProvisoires')>('./visuelsProvisoires');
  const images = new Map<string, SkImage>();
  for (const visuel of Object.keys(VISUELS_PROVISOIRES)) {
    if (visuel.startsWith('capsules/')) continue;
    const octets = readFileSync(join(racine, 'assets/maison-provisoire', `${visuel}@2x.webp`));
    const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(octets)));
    if (image === null) throw new Error(`visuel illisible : ${visuel}`);
    images.set(visuel, image);
  }
  const { CalquesMaison } = require('./CalquesMaison') as typeof import('./CalquesMaison');
  const image = async (plan: Calque[]) => {
    const element = createElement(CalquesMaison, { plan, images, echelle: ECHELLE });
    return skia.drawOffscreen(skia.makeOffscreenSurface(L, H), element);
  };
  dessiner = async (plan) => {
    const pixels = (await image(plan)).readPixels();
    if (!(pixels instanceof Uint8Array)) throw new Error('pixels illisibles');
    return pixels;
  };
  encoder = async (plan) => (await image(plan)).encodeToBytes();
}, 60000);

const plan = (over: Partial<HouseScene> = {}): Calque[] =>
  planDeScene(sceneNovembre(over), catalogue);
/** Une scène avec les trois états côte à côte : intact, fêlé, réparé à l'or. */
const TROIS_ETATS: Partial<HouseScene> = {
  items: [
    objetScene('etageres', 'base', 1, 'intact'),
    objetScene('coffre-nagamochi', 'base', 2, 'cracked'),
    objetScene('echelle', 'base', 3, 'repaired'),
    objetScene('rateau-porte-bonheur-kumade', 'weekly', 1),
  ],
};

/** Pixels du cadre d'un objet (en points de la scène), canal par canal. */
function cadreObjet(pixels: Uint8Array, source: 'base' | 'weekly', rang: number): number[][] {
  const e = emplacement(source, rang);
  const out: number[][] = [];
  for (let y = (e.y - 64) * ECHELLE; y < e.y * ECHELLE; y++)
    for (let x = (e.x - 32) * ECHELLE; x < (e.x + 32) * ECHELLE; x++) {
      const i = (y * L + x) * 4;
      out.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
    }
  return out;
}
const differents = (a: number[][], b: number[][]) =>
  a.filter((p, i) => p.some((c, k) => Math.abs(c - b[i][k]) > 8)).length;
const moyenne = (pixels: Uint8Array) => {
  let somme = 0;
  for (let i = 0; i < pixels.length; i += 4) somme += pixels[i] + pixels[i + 1] + pixels[i + 2];
  return somme / ((pixels.length / 4) * 3);
};

describe('rendu réel de la maison (Skia, visuels provisoires)', () => {
  it('dessine la pièce : ni vide ni transparente', async () => {
    const pixels = await dessiner(plan());
    let opaques = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] === 255) opaques++;
    expect(opaques).toBe(L * H);
  });

  it('trois états : la fêlure et les veines d’or se voient sur l’objet', async () => {
    const intact = await dessiner(plan({ items: [objetScene('echelle', 'base', 3, 'intact')] }));
    const fele = await dessiner(plan({ items: [objetScene('echelle', 'base', 3, 'cracked')] }));
    const repare = await dessiner(plan({ items: [objetScene('echelle', 'base', 3, 'repaired')] }));
    const [i, f, r] = [intact, fele, repare].map((p) => cadreObjet(p, 'base', 3));
    expect(differents(i, f)).toBeGreaterThan(50);
    expect(differents(i, r)).toBeGreaterThan(50);
    expect(differents(f, r)).toBeGreaterThan(50);
    // Veines d'or : des pixels nettement plus rouges et verts que bleus, absents de l'objet intact.
    const dores = (px: number[][]) => px.filter(([R, G, B]) => R - B > 60 && G - B > 30).length;
    expect(dores(r)).toBeGreaterThan(dores(i) + 50);
  });

  it('poussière 1 : le voile change la scène ; poussière 2 : en plus, la toile et la lumière baissée', async () => {
    const [p0, p1, p2] = await Promise.all(
      [0, 1, 2].map((d) => dessiner(plan({ dust: d as 0 | 1 | 2 }))),
    );
    const changes = (a: Uint8Array, b: Uint8Array) => {
      let n = 0;
      for (let i = 0; i < a.length; i += 4)
        if (
          Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) >
          12
        )
          n++;
      return n;
    };
    expect(changes(p0, p1)).toBeGreaterThan((L * H) / 20);
    expect(changes(p1, p2)).toBeGreaterThan((L * H) / 2);
    expect(moyenne(p2)).toBeLessThan(moyenne(p1));
  });

  it('poussière 2 : l’assombrissement baisse la lumière de 15 %', async () => {
    const sans = plan({ dust: 0 });
    const avec: Calque[] = [
      ...sans,
      { type: 'assombrissement', cle: 'assombrissement', opacite: 0.15 },
    ];
    expect(plan({ dust: 2 })).toContainEqual(avec.at(-1));
    const a = await dessiner(sans);
    const b = await dessiner(avec);
    for (let i = 0; i < a.length; i += 4 * 997)
      for (let k = 0; k < 3; k++)
        expect(Math.abs(b[i + k] - a[i + k] * 0.85)).toBeLessThanOrEqual(1.5);
  });

  it('enregistre les captures quand CAPTURES=1', async () => {
    if (process.env.CAPTURES !== '1') return;
    const dossier = join(racine, 'docs/captures/83');
    mkdirSync(dossier, { recursive: true });
    const captures: [string, Calque[]][] = [
      ['1-trois-etats-intact-fele-repare.png', plan(TROIS_ETATS)],
      ['2-poussiere-0.png', plan({ ...TROIS_ETATS, dust: 0 })],
      ['3-poussiere-1.png', plan({ ...TROIS_ETATS, dust: 1 })],
      ['4-poussiere-2.png', plan({ ...TROIS_ETATS, dust: 2 })],
    ];
    for (const [nom, p] of captures) writeFileSync(join(dossier, nom), await encoder(p));
  });
});
