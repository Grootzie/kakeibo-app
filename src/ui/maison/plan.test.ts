// Plan de dessin de la maison (J4.4) : ce que le composant de rendu dessine, calque par calque,
// pour une scène de J4.1. Les pixels sont vérifiés à part, par Maison.rendu.test.ts.
import { catalogue } from '../../content/catalogue';
import { type CalqueObjet, calquesDeLObjet, planDeScene } from './plan';
import { objetScene, sceneNovembre } from './scenesDeTest';
import { CADRE_OBJET, SCENE, cadreDansLaScene, emplacement } from './emplacements';

const objet = objetScene;

const objets = (plan: ReturnType<typeof planDeScene>) =>
  plan.filter((c): c is CalqueObjet => c.type === 'objet');
const visuels = (plan: ReturnType<typeof planDeScene>) =>
  plan.flatMap((c) =>
    c.type === 'image' ? [c.visuel] : c.type === 'objet' ? c.calques.map((k) => k.visuel) : [],
  );

describe('planDeScene', () => {
  it('pose la vue sous le fond de la pièce, dans le cadre de la scène', () => {
    const plan = planDeScene(sceneNovembre(), catalogue);
    expect(plan.slice(0, 2)).toEqual([
      {
        type: 'image',
        cle: 'vue',
        visuel: 'rooms/room-11/view',
        cadre: { gauche: 0, haut: 0, largeur: SCENE.largeur, hauteur: SCENE.hauteur },
        opacite: 1,
      },
      {
        type: 'image',
        cle: 'fond',
        visuel: 'rooms/room-11/background',
        cadre: { gauche: 0, haut: 0, largeur: SCENE.largeur, hauteur: SCENE.hauteur },
        opacite: 1,
      },
    ]);
  });

  it('pose chaque objet à son emplacement, la base au fond puis les objets gagnés devant', () => {
    const plan = planDeScene(sceneNovembre(), catalogue);
    const poses = objets(plan);
    expect(poses.map((o) => o.cle)).toEqual([
      'etageres',
      'coffre-nagamochi',
      'echelle',
      'rateau-porte-bonheur-kumade',
    ]);
    expect(poses[3].cadre).toEqual(cadreDansLaScene(emplacement('weekly', 1)));
    expect(poses[3].ancrage).toEqual({
      x: emplacement('weekly', 1).x,
      y: emplacement('weekly', 1).y,
    });
    expect(poses[0].cadre).toEqual(cadreDansLaScene(emplacement('base', 1)));
    expect(poses[0].cadre.largeur).toBe(CADRE_OBJET.largeur);
  });

  it('dessine un objet intact sans calque, un fêlé avec sa fêlure, un réparé avec ses veines d’or', () => {
    const plan = planDeScene(
      sceneNovembre({
        items: [
          objet('etageres', 'base', 1, 'intact'),
          objet('coffre-nagamochi', 'base', 2, 'cracked'),
          objet('echelle', 'base', 3, 'repaired'),
        ],
      }),
      catalogue,
    );
    const [intact, fele, repare] = objets(plan);
    expect(intact.calques).toEqual([{ visuel: 'items/etageres/base', opacite: 1 }]);
    expect(fele.calques).toEqual([
      { visuel: 'items/coffre-nagamochi/base', opacite: 1 },
      { visuel: 'items/coffre-nagamochi/crack', opacite: 1 },
    ]);
    expect(repare.calques).toEqual([
      { visuel: 'items/echelle/base', opacite: 1 },
      { visuel: 'items/echelle/gold', opacite: 1 },
    ]);
    for (const o of [intact, fele, repare]) {
      expect(o.opacite).toBe(1);
      expect(o.echelle).toBe(1);
      expect(o.decalageX).toBe(0);
    }
  });

  it('signale discrètement chaque emplacement libre, à sa place, sous les objets', () => {
    const plan = planDeScene(sceneNovembre(), catalogue);
    const libres = plan.filter((c) => c.type === 'emplacementLibre');
    expect(libres.map((l) => l.cle)).toEqual(['libre-2', 'libre-3', 'libre-4']);
    const e = emplacement('weekly', 2);
    expect(libres[0]).toMatchObject({ x: e.x, y: e.y });
    if (libres[0].type !== 'emplacementLibre') throw new Error();
    expect(libres[0].opacite).toBeLessThanOrEqual(0.4);
    const premierObjet = plan.findIndex((c) => c.type === 'objet');
    const dernierLibre = plan.map((c) => c.type).lastIndexOf('emplacementLibre');
    expect(dernierLibre).toBeLessThan(premierObjet);
  });

  it('niveau 0 : maison propre, ni voile, ni toile, ni assombrissement', () => {
    const plan = planDeScene(sceneNovembre({ dust: 0 }), catalogue);
    expect(plan.some((c) => c.type === 'assombrissement')).toBe(false);
    expect(visuels(plan)).not.toContain('dust/veil');
    expect(visuels(plan)).not.toContain('dust/cobweb');
  });

  it('niveau 1 : un voile de poussière par-dessus toute la scène', () => {
    const plan = planDeScene(sceneNovembre({ dust: 1 }), catalogue);
    expect(plan.at(-1)).toEqual({
      type: 'image',
      cle: 'voile',
      visuel: 'dust/veil',
      cadre: { gauche: 0, haut: 0, largeur: SCENE.largeur, hauteur: SCENE.hauteur },
      opacite: 1,
    });
    expect(visuels(plan)).not.toContain('dust/cobweb');
    expect(plan.some((c) => c.type === 'assombrissement')).toBe(false);
  });

  it('niveau 2 : assombrissement de 15 %, voile et toile d’araignée, par-dessus les objets', () => {
    const plan = planDeScene(sceneNovembre({ dust: 2 }), catalogue);
    expect(plan.slice(-3).map((c) => c.cle)).toEqual(['assombrissement', 'voile', 'toile']);
    expect(plan.at(-3)).toEqual({ type: 'assombrissement', cle: 'assombrissement', opacite: 0.15 });
    expect(plan.at(-1)).toMatchObject({ visuel: 'dust/cobweb' });
  });

  it('apparition : l’objet grandit depuis son point d’ancrage en devenant opaque', () => {
    const scene = sceneNovembre();
    const debut = objets(
      planDeScene(
        scene,
        catalogue,
        new Map([['rateau-porte-bonheur-kumade', { type: 'apparition', t: 0 }]]),
      ),
    )[3];
    const milieu = objets(
      planDeScene(
        scene,
        catalogue,
        new Map([['rateau-porte-bonheur-kumade', { type: 'apparition', t: 0.5 }]]),
      ),
    )[3];
    const fin = objets(
      planDeScene(
        scene,
        catalogue,
        new Map([['rateau-porte-bonheur-kumade', { type: 'apparition', t: 1 }]]),
      ),
    )[3];
    expect(debut.opacite).toBe(0);
    expect(debut.echelle).toBeLessThan(1);
    expect(milieu.opacite).toBeGreaterThan(0);
    expect(milieu.opacite).toBeLessThan(1);
    expect(fin).toEqual(objets(planDeScene(scene, catalogue))[3]);
  });

  it('fêlure : la fêlure se dessine et l’objet vibre, puis s’immobilise', () => {
    const scene = sceneNovembre({ items: [objet('echelle', 'base', 3, 'cracked')] });
    const a = (t: number) =>
      objets(planDeScene(scene, catalogue, new Map([['echelle', { type: 'felure', t }]])))[0];
    expect(a(0).calques[1]).toEqual({ visuel: 'items/echelle/crack', opacite: 0 });
    expect(a(0.5).calques[1].opacite).toBeCloseTo(0.5);
    const decalages = [0.05, 0.1, 0.15, 0.2, 0.25].map((t) => a(t).decalageX);
    expect(Math.max(...decalages.map(Math.abs))).toBeGreaterThan(0);
    expect(decalages.some((d) => d > 0) && decalages.some((d) => d < 0)).toBe(true);
    expect(a(1)).toEqual(objets(planDeScene(scene, catalogue))[0]);
  });

  it('réparation à l’or : la fêlure s’efface pendant que les veines d’or apparaissent', () => {
    const scene = sceneNovembre({ items: [objet('echelle', 'base', 3, 'repaired')] });
    const a = (t: number) =>
      objets(planDeScene(scene, catalogue, new Map([['echelle', { type: 'reparation', t }]])))[0];
    expect(a(0).calques).toEqual([
      { visuel: 'items/echelle/base', opacite: 1 },
      { visuel: 'items/echelle/crack', opacite: 1 },
      { visuel: 'items/echelle/gold', opacite: 0 },
    ]);
    expect(a(0.5).calques[1].opacite).toBeCloseTo(0.5);
    expect(a(0.5).calques[2].opacite).toBeCloseTo(0.5);
    expect(a(0.5).decalageX).toBe(0);
    expect(a(1)).toEqual(objets(planDeScene(scene, catalogue))[0]);
  });

  it('ne dessine aucun visuel que le catalogue ou les visuels provisoires ne connaissent pas', () => {
    const { VISUELS_PROVISOIRES } =
      jest.requireActual<typeof import('./visuelsProvisoires')>('./visuelsProvisoires');
    for (const dust of [0, 1, 2] as const)
      for (const v of visuels(planDeScene(sceneNovembre({ dust }), catalogue)))
        expect(Object.keys(VISUELS_PROVISOIRES)).toContain(v);
  });
});

describe('calques d’un objet seul (fiche d’objet, J4.7)', () => {
  const visuels = { base: 'items/x/base', crack: 'items/x/crack', gold: 'items/x/gold' };
  it('intact : la base ; fêlé : la base et la fêlure ; réparé : la base et les veines d’or', () => {
    expect(calquesDeLObjet(visuels, 'intact')).toEqual(['items/x/base']);
    expect(calquesDeLObjet(visuels, 'cracked')).toEqual(['items/x/base', 'items/x/crack']);
    expect(calquesDeLObjet(visuels, 'repaired')).toEqual(['items/x/base', 'items/x/gold']);
  });
});
