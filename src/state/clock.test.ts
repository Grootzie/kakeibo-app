import { createClock } from './clock';

const REEL = new Date('2026-11-02T10:00:00.000Z');

describe('horloge de test', () => {
  it("rend l'heure réelle tant qu'on n'avance rien", () => {
    const h = createClock({ actif: true, reel: () => REEL });
    expect(h.now().toISOString()).toBe('2026-11-02T10:00:00.000Z');
  });

  it('avance de jours et de semaines', () => {
    const h = createClock({ actif: true, reel: () => REEL });
    h.avancerJours(1);
    expect(h.now().toISOString()).toBe('2026-11-03T10:00:00.000Z');
    h.avancerSemaines(1);
    expect(h.now().toISOString()).toBe('2026-11-10T10:00:00.000Z');
  });

  it('avance d’un mois calendaire', () => {
    const h = createClock({ actif: true, reel: () => REEL });
    h.avancerMois(1);
    expect(h.now().toISOString()).toBe('2026-12-02T10:00:00.000Z');
  });

  it("suit l'heure réelle après avoir avancé", () => {
    let t = REEL;
    const h = createClock({ actif: true, reel: () => t });
    h.avancerJours(2);
    t = new Date(t.getTime() + 60_000);
    expect(h.now().toISOString()).toBe('2026-11-04T10:01:00.000Z');
  });

  it('se réinitialise', () => {
    const h = createClock({ actif: true, reel: () => REEL });
    h.avancerJours(5);
    h.reinitialiser();
    expect(h.now().toISOString()).toBe(REEL.toISOString());
    expect(h.decalageMs()).toBe(0);
  });

  it("n'existe pas dans un build publié : rien n'avance", () => {
    const h = createClock({ actif: false, reel: () => REEL });
    h.avancerJours(3);
    h.avancerSemaines(1);
    h.avancerMois(1);
    expect(h.actif).toBe(false);
    expect(h.now().toISOString()).toBe(REEL.toISOString());
  });
});
