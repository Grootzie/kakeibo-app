// Horloge de test (voir « Horloge de test » dans docs/spec.md).
// Réglage caché des builds de développement : il décale l'heure courante pour jouer une
// semaine en quelques secondes. Dans un build publié, il est inactif et `now()` rend l'heure réelle.
// Le domaine ne l'importe jamais : l'heure courante lui est passée en paramètre.

export interface Horloge {
  readonly actif: boolean;
  now(): Date;
  decalageMs(): number;
  avancerJours(n: number): void;
  avancerSemaines(n: number): void;
  avancerMois(n: number): void;
  reinitialiser(): void;
}

export interface OptionsHorloge {
  readonly actif: boolean;
  readonly reel?: () => Date;
}

export function createClock({ actif, reel = () => new Date() }: OptionsHorloge): Horloge {
  let decalage = 0;
  const now = () => new Date(reel().getTime() + decalage);
  const decaler = (ms: number) => {
    if (actif) decalage += ms;
  };
  const JOUR = 24 * 60 * 60 * 1000;

  return {
    actif,
    now,
    decalageMs: () => decalage,
    avancerJours: (n) => decaler(n * JOUR),
    avancerSemaines: (n) => decaler(n * 7 * JOUR),
    avancerMois: (n) => {
      if (!actif) return;
      const cible = now();
      cible.setUTCMonth(cible.getUTCMonth() + n);
      decalage = cible.getTime() - reel().getTime();
    },
    reinitialiser: () => {
      decalage = 0;
    },
  };
}

/** Horloge de l'appli : active seulement dans les builds de développement. */
export const horloge: Horloge = createClock({ actif: __DEV__ });
