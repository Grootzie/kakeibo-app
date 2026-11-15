// Animations de la maison (J4.4, Fiche des visuels) : apparition d'un objet (0,3 s), fêlure
// (0,2 s, avec vibration), réparation à l'or (1 s), déduites de deux scènes successives.
import type { HouseScene, SceneItem } from '../../domain/maison';
import { DUREES_MS, changementsDeScene, enCours, progressions } from './animations';

const objet = (itemId: string, state: SceneItem['state'] = 'intact'): SceneItem => ({
  itemId,
  source: 'weekly',
  rank: 1,
  state,
  repairDays: null,
});
const scene = (items: SceneItem[], over: Partial<HouseScene> = {}): HouseScene => ({
  year: 2026,
  month: '2026-11',
  room: 'room-11',
  items,
  freeSlots: [],
  dust: 0,
  ...over,
});

describe('durées de la fiche des visuels', () => {
  it('apparition 0,3 s, fêlure 0,2 s, réparation à l’or 1 s', () => {
    expect(DUREES_MS).toEqual({ apparition: 300, felure: 200, reparation: 1000 });
  });
});

describe('changementsDeScene', () => {
  it('rien au premier affichage : la maison s’affiche telle qu’elle est', () => {
    expect(changementsDeScene(null, scene([objet('a')]))).toEqual([]);
  });

  it('un objet nouveau apparaît', () => {
    expect(changementsDeScene(scene([objet('a')]), scene([objet('a'), objet('b')]))).toEqual([
      { itemId: 'b', type: 'apparition' },
    ]);
  });

  it('un objet intact qui passe à fêlé se fêle ; un fêlé qui passe à réparé se répare', () => {
    expect(
      changementsDeScene(
        scene([objet('a'), objet('b', 'cracked')]),
        scene([objet('a', 'cracked'), objet('b', 'repaired')]),
      ),
    ).toEqual([
      { itemId: 'a', type: 'felure' },
      { itemId: 'b', type: 'reparation' },
    ]);
  });

  it('fêlé puis réparé entre deux affichages : seule la réparation se joue', () => {
    expect(changementsDeScene(scene([objet('a')]), scene([objet('a', 'repaired')]))).toEqual([
      { itemId: 'a', type: 'reparation' },
    ]);
  });

  it('rien quand on change de pièce ou d’année : ce n’est pas un événement de la maison', () => {
    expect(
      changementsDeScene(scene([objet('a')]), scene([objet('b')], { room: 'room-12' })),
    ).toEqual([]);
    expect(changementsDeScene(scene([objet('a')]), scene([objet('b')], { year: 2027 }))).toEqual(
      [],
    );
  });

  it('rien quand seule la poussière ou la réparation en cours change', () => {
    expect(
      changementsDeScene(
        scene([objet('a', 'cracked')]),
        scene([{ ...objet('a', 'cracked'), repairDays: 3 }], { dust: 2 }),
      ),
    ).toEqual([]);
  });
});

describe('progressions', () => {
  const liste = [
    { itemId: 'a', type: 'apparition' as const },
    { itemId: 'b', type: 'reparation' as const },
  ];

  it('avance chaque animation selon sa durée, sans dépasser la fin', () => {
    expect(progressions(liste, 0)).toEqual(
      new Map([
        ['a', { type: 'apparition', t: 0 }],
        ['b', { type: 'reparation', t: 0 }],
      ]),
    );
    expect(progressions(liste, 150).get('a')?.t).toBeCloseTo(0.5);
    expect(progressions(liste, 150).get('b')?.t).toBeCloseTo(0.15);
    expect(progressions(liste, 600).get('a')?.t).toBe(1);
  });

  it('s’arrête quand la plus longue est finie', () => {
    expect(enCours(liste, 999)).toBe(true);
    expect(enCours(liste, 1000)).toBe(false);
    expect(enCours([], 0)).toBe(false);
  });
});
