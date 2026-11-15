// Visuels provisoires de la maison (J4.3) : liste complète, formats, tailles, transparence, et fichiers
// versionnés identiques à ce que produit le script (Fiche des visuels).
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { format, resolveConfig } from 'prettier';

import catalogueJson from '../../src/content/catalogue.json';
import { catalogue as contenu } from '../../src/content/catalogue';
import type { Catalog } from '../../src/domain/objets';
import { CADRE_OBJET, SCENE } from '../../src/ui/maison/emplacements';
import { enTeteWebp, lireWebp } from './lireWebp';
import { CADRE_CAPSULE, DOSSIER, ECHELLES, fichierVisuel, listeVisuels } from './provisoires';
import { encoderWebp } from './webp';
import { MODULE_VISUELS, moduleVisuels } from './module';
import { VISUELS_PROVISOIRES } from '../../src/ui/maison/visuelsProvisoires';

const catalogue = catalogueJson as Catalog;
const racine = join(__dirname, '..', '..');
const dossier = join(racine, DOSSIER);
const visuels = listeVisuels(catalogue);

function fichiers(dir: string, out: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) fichiers(chemin, out);
    else out.push(chemin);
  }
  return out;
}

const KO = 1024;
const lire = (chemin: string, echelle: number) =>
  readFileSync(join(dossier, fichierVisuel(chemin, echelle)));

describe('visuels provisoires de la maison', () => {
  it('liste un fond et une vue par pièce, trois calques par objet, deux poussières et douze capsules', () => {
    const chemins = visuels.map((v) => v.chemin);
    expect(new Set(chemins).size).toBe(chemins.length);
    for (const piece of catalogue.rooms) {
      expect(chemins).toContain(`rooms/${piece.id}/background`);
      expect(chemins).toContain(`rooms/${piece.id}/view`);
    }
    for (const item of catalogue.items)
      for (const calque of ['base', 'crack', 'gold'])
        expect(chemins).toContain(`items/${item.id}/${calque}`);
    expect(chemins).toContain('dust/veil');
    expect(chemins).toContain('dust/cobweb');
    for (let mois = 1; mois <= 12; mois++)
      expect(chemins).toContain(`capsules/${String(mois).padStart(2, '0')}`);
    expect(chemins).toHaveLength(12 * 2 + 95 * 3 + 2 + 12);
  });

  it('produit chaque visuel que le catalogue donne aux objets, à chaque échelle', () => {
    const chemins = new Set(visuels.map((v) => v.chemin));
    for (const item of contenu.items)
      for (const chemin of Object.values(item.visuals)) {
        expect(chemins.has(chemin)).toBe(true);
        for (const echelle of ECHELLES)
          expect(existsSync(join(dossier, fichierVisuel(chemin, echelle)))).toBe(true);
      }
  });

  it('versionne chaque visuel en WebP 1x, 2x et 3x, et rien d’autre', () => {
    const attendus = visuels.flatMap((v) => ECHELLES.map((e) => fichierVisuel(v.chemin, e)));
    const presents = fichiers(dossier)
      .map((f) => relative(dossier, f).split('\\').join('/'))
      .filter((f) => f !== 'LISEZMOI.md');
    expect(presents.sort()).toEqual([...attendus].sort());
    expect(existsSync(join(dossier, 'LISEZMOI.md'))).toBe(true);
  });

  it('dit dans son dossier que ces visuels sont provisoires', () => {
    expect(DOSSIER).toBe('assets/maison-provisoire');
    expect(readFileSync(join(dossier, 'LISEZMOI.md'), 'utf8')).toMatch(/provisoires/);
  });

  it('donne à chaque visuel la taille de son cadre, multipliée par l’échelle, et un canal alpha', () => {
    const cadre = (chemin: string) =>
      chemin.startsWith('items/')
        ? CADRE_OBJET
        : chemin.startsWith('capsules/')
          ? CADRE_CAPSULE
          : SCENE;
    for (const v of visuels)
      for (const e of ECHELLES) {
        const { largeur, hauteur } = cadre(v.chemin);
        expect([v.chemin, e, enTeteWebp(lire(v.chemin, e))]).toEqual([
          v.chemin,
          e,
          { largeur: largeur * e, hauteur: hauteur * e, alpha: true },
        ]);
      }
  });

  it('pèse au plus 60 Ko par objet en 3x (image de base, fêlure et veines d’or ensemble)', () => {
    for (const item of catalogue.items) {
      const poids = ['base', 'crack', 'gold']
        .map(
          (calque) => statSync(join(dossier, fichierVisuel(`items/${item.id}/${calque}`, 3))).size,
        )
        .reduce((a, b) => a + b, 0);
      expect([item.id, poids <= 60 * KO]).toEqual([item.id, true]);
    }
  });

  it('pèse au plus 15 Mo pour tous les visuels', () => {
    const total = fichiers(dossier).reduce((somme, f) => somme + statSync(f).size, 0);
    expect(total).toBeLessThanOrEqual(15 * KO * KO);
  });

  it('laisse transparent le fond d’un objet, d’une fêlure, de la poussière et la fenêtre de la pièce', () => {
    const alpha = (chemin: string, x: number, y: number) => {
      const img = lireWebp(lire(chemin, 1));
      return img.pixels[(y * img.largeur + x) * 4 + 3];
    };
    expect(alpha('items/kadomatsu/base', 0, 0)).toBe(0);
    expect(alpha('items/kadomatsu/crack', 0, 0)).toBe(0);
    expect(alpha('items/kadomatsu/gold', 0, 0)).toBe(0);
    expect(alpha('dust/cobweb', SCENE.largeur / 2, SCENE.hauteur / 2)).toBe(0);
    expect(alpha('rooms/room-01/background', SCENE.largeur / 2, 60)).toBe(0);
    expect(alpha('rooms/room-01/background', 5, SCENE.hauteur - 5)).toBe(255);
    expect(alpha('rooms/room-01/view', SCENE.largeur / 2, 60)).toBe(255);
    expect(alpha('dust/veil', 5, 5)).toBeGreaterThan(0);
    expect(alpha('dust/veil', 5, 5)).toBeLessThan(255);
  });

  it('pose la fêlure et les veines d’or sur l’objet, dans le même cadre', () => {
    const base = lireWebp(lire('items/daruma/base', 1));
    for (const calque of ['crack', 'gold']) {
      const img = lireWebp(lire(`items/daruma/${calque}`, 1));
      let traits = 0;
      for (let i = 3; i < img.pixels.length; i += 4)
        if (img.pixels[i] > 0) {
          traits++;
          expect(base.pixels[i]).toBe(255);
        }
      expect([calque, traits > 20]).toEqual([calque, true]);
    }
  });

  it('distingue les objets : deux objets d’une pièce n’ont jamais la même image', () => {
    for (const piece of catalogue.rooms) {
      const images = catalogue.items
        .filter((i) => i.room === piece.id)
        .map((i) => lire(`items/${i.id}/base`, 1).toString('base64'));
      expect(new Set(images).size).toBe(images.length);
    }
  });

  it('versionne exactement ce que produit le script (un échantillon)', () => {
    const echantillon = [
      'rooms/room-04/background',
      'rooms/room-06/view',
      'items/porte-coulissante/base',
      'items/teru-teru-bozu/crack',
      'items/boulier-soroban/gold',
      'dust/veil',
      'dust/cobweb',
      'capsules/09',
    ];
    for (const chemin of echantillon) {
      const v = visuels.find((x) => x.chemin === chemin);
      expect(v).toBeDefined();
      if (v === undefined) continue;
      for (const e of ECHELLES)
        expect([
          chemin,
          e,
          Buffer.from(encoderWebp(v.dessiner(e))).equals(lire(chemin, e)),
        ]).toEqual([chemin, e, true]);
    }
  });

  it('donne au rendu de la maison un module identique à ce que produit le script', async () => {
    const attendu = await format(moduleVisuels(catalogue), {
      ...(await resolveConfig(join(racine, MODULE_VISUELS))),
      parser: 'typescript',
    });
    expect(readFileSync(join(racine, MODULE_VISUELS), 'utf8')).toBe(attendu);
    expect(Object.keys(VISUELS_PROVISOIRES)).toEqual(visuels.map((v) => v.chemin));
  });
});
