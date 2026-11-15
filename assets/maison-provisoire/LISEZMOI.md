# Visuels provisoires de la maison

Ces visuels sont provisoires : neutres, sans style, hachurés. Ils servent à développer la maison avant le premier lot de visuels définitifs (spec, Direction artistique › Premier lot, point 3). Ils ne constituent pas un lot de visuels définitifs et ne partent jamais dans une version publiée.

Ils sont générés par `tools/generer-visuels-provisoires.ts` ; ne les modifie pas à la main :

```sh
node --experimental-strip-types tools/generer-visuels-provisoires.ts
```

Ils suivent la fiche des visuels :

- `rooms/<pièce>/background` : le fond (murs et sol), ouvert sur la fenêtre ; `rooms/<pièce>/view` : la vue, dessous ; cadre de la scène, 360 × 270 points ;
- `items/<objet>/base`, `crack` (fêlure) et `gold` (veines d'or) : même cadre de 64 × 64 points, point d'ancrage en bas au milieu ;
- `dust/veil` (niveau 1) et `dust/cobweb` (niveau 2, avec le voile ; l'assombrissement de 15 % revient au rendu) ;
- `capsules/<mois>` : la capsule aux couleurs du mois, 48 × 48 points.

Chaque visuel existe en WebP 1x, `@2x` et `@3x`, fond transparent. Les cadres et les emplacements viennent de `src/ui/maison/emplacements.ts`. Le script écrit aussi `src/ui/maison/visuelsProvisoires.ts`, qui donne chaque visuel au rendu de la maison.
