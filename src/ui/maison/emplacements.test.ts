// Couche de style de la maison (J4.3) : positions provisoires des emplacements, hors du domaine.
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import catalogueJson from '../../content/catalogue.json';
import type { Catalog } from '../../domain/objets';
import { CADRE_OBJET, EMPLACEMENTS, SCENE, cadreDansLaScene, emplacement } from './emplacements';

const catalogue = catalogueJson as Catalog;

describe('emplacements provisoires de la maison', () => {
  it('compte 3 emplacements de base et 5 emplacements d’objets à gagner', () => {
    expect(EMPLACEMENTS.base).toHaveLength(3);
    expect(EMPLACEMENTS.weekly).toHaveLength(5);
  });

  it('place le cadre de chaque objet entier dans la scène', () => {
    for (const source of ['base', 'weekly'] as const) {
      EMPLACEMENTS[source].forEach((_, i) => {
        const cadre = cadreDansLaScene(emplacement(source, i + 1));
        expect(cadre.gauche).toBeGreaterThanOrEqual(0);
        expect(cadre.haut).toBeGreaterThanOrEqual(0);
        expect(cadre.gauche + cadre.largeur).toBeLessThanOrEqual(SCENE.largeur);
        expect(cadre.haut + cadre.hauteur).toBeLessThanOrEqual(SCENE.hauteur);
      });
    }
  });

  it('pose le point d’ancrage en bas au milieu du cadre de l’objet', () => {
    expect(CADRE_OBJET.ancrage).toEqual({ x: CADRE_OBJET.largeur / 2, y: CADRE_OBJET.hauteur });
    const cadre = cadreDansLaScene(emplacement('base', 1));
    expect(cadre.gauche + CADRE_OBJET.ancrage.x).toBe(EMPLACEMENTS.base[0].x);
    expect(cadre.haut + CADRE_OBJET.ancrage.y).toBe(EMPLACEMENTS.base[0].y);
  });

  it('ne superpose pas deux objets d’une même rangée', () => {
    for (const source of ['base', 'weekly'] as const) {
      const cadres = EMPLACEMENTS[source].map((_, i) =>
        cadreDansLaScene(emplacement(source, i + 1)),
      );
      for (let i = 1; i < cadres.length; i++)
        expect(cadres[i].gauche).toBeGreaterThanOrEqual(
          cadres[i - 1].gauche + cadres[i - 1].largeur,
        );
    }
  });

  it('dessine les objets à gagner, devant, après les objets de base', () => {
    const fond = Math.max(...EMPLACEMENTS.base.map((e) => e.ordre));
    for (const e of EMPLACEMENTS.weekly) expect(e.ordre).toBeGreaterThan(fond);
  });

  it('donne un emplacement à chaque objet du catalogue', () => {
    for (const item of catalogue.items) {
      expect(() => emplacement(item.source, item.rank)).not.toThrow();
    }
    expect(() => emplacement('base', 4)).toThrow();
    expect(() => emplacement('weekly', 6)).toThrow();
    expect(() => emplacement('weekly', 0)).toThrow();
  });

  it('reste hors du domaine : le domaine ne lit aucune position', () => {
    const domaine = join(__dirname, '..', '..', 'domain');
    for (const f of readdirSync(domaine)) {
      const source = readFileSync(join(domaine, f), 'utf8');
      expect({ f, ui: source.includes('/ui/') }).toEqual({ f, ui: false });
    }
  });
});
